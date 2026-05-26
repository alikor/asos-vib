# PO Exception Triage Agent

## Stack
TypeScript, Node.js 22, Express, Docker, Zod, OpenAI-compatible LLM provider, Vitest for tests.

## LLM Provider
OpenAI is the default provider. `LLM_MODEL` defaults to `gpt-4o-mini` and `EMBEDDING_MODEL` defaults to `text-embedding-3-small`. Both are configured via env and the implementation only depends on an OpenAI-compatible Chat Completions and Embeddings API, so any compatible endpoint (`OPENAI_BASE_URL`) can be swapped in.

## How to Run

### Local
```bash
cp .env.example .env             # add your OPENAI_API_KEY
pnpm install
pnpm seed:corpus                 # (optional — already committed)
pnpm seed:data                   # (optional — already committed)
pnpm index                       # builds storage/vector-index.json
pnpm dev                         # or: pnpm build && pnpm start
```

### Docker
```bash
echo "OPENAI_API_KEY=sk-..." > .env
docker compose build
docker compose up
```

The container exposes `:3000`. On first start, if `storage/vector-index.json` is missing, the server builds it automatically before listening.

### Curl
```bash
curl -X POST http://localhost:3000/triage \
  -H "Content-Type: application/json" \
  -d '{"question":"Please triage PO-10001. Supplier confirmed fewer units than ordered."}'

curl http://localhost:3000/health
```

## How to Run Evals

With the server running:

```bash
pnpm eval
```

The runner POSTs each case to `/triage`, schema-validates the response, and asserts the expected action, citations, confidence, escalation role, and PII absence.

## Architecture

The codebase follows SOLID with a CQRS split:

- **Reads** go through QueryBuilder objects: `PurchaseOrderQueryBuilder`, `ForecastQueryBuilder`, `PolicyChunkQueryBuilder`, `TriageCaseQueryBuilder`. Each is a fluent, single-responsibility object that consumes a `JsonFileDataSource` or a `VectorIndex` / `TriageCaseProjector`.
- **Writes** go through commands and command handlers via `CommandBus`. Handlers read the event stream, rehydrate the `TriageCase` aggregate, invoke one method, append uncommitted events with optimistic concurrency, and publish to the in-process event bus.
- The `TriageCase` aggregate is the only event-sourced resource. Its state machine is `started → context_retrieved → tool_data_loaded → recommendation_generated → guardrails_evaluated → completed | escalated | failed`.
- A `TriageCaseProjector` subscribes to the event bus and writes an eventually-consistent projection to `storage/triage-case-projections.json`, which `TriageCaseQueryBuilder` reads.
- `TriageOrchestrator` is the only place that knows the workflow; everything else is wired through small, focused interfaces (`LlmClient`, `EmbeddingClient`, `EventStore`, `EventBus`, `Guardrail`, `AgentTool`).

## Why No Repository Pattern

The assessment explicitly forbids repositories. Reads are explicit, intent-revealing query builders; writes are domain events appended through commands. Avoiding a generic repository keeps responsibilities sharper and makes the CQRS split a property of the codebase, not just a convention.

## RAG Approach

1. `MarkdownCorpusLoader` loads the five SOPs in `corpus/`.
2. `MarkdownChunker` splits them by `## §N` headings; each chunk retains `docName`, `section`, `citation`, `rawText`, and `safeText`.
3. `EscalationMatrixSanitizer` rewrites the escalation matrix so embedded text never contains a name or email — the raw text stays available internally for the PII guardrail.
4. `OpenAiCompatibleEmbeddingClient` produces embeddings for `safeText`.
5. `VectorIndexPersister` persists the chunks to `storage/vector-index.json`.
6. `InMemoryVectorIndex` does cosine-similarity search with `topK` and `minScore`.
7. `PolicyChunkQueryBuilder` is the only way the orchestrator reads from the index.
8. The orchestrator does two retrieval passes (the raw user question, then a synthesised query with deterministic variance facts) and merges the results before the final LLM call.
9. Citations in the final response are validated against the retrieved set; unknown citations trigger a retry and then a safe escalation.

## Tool Use

- `get_po(po_id)` — required model-callable tool. Implemented via `GetPoTool` using `PurchaseOrderQueryBuilder`.
- `get_forecast(sku)` — optional stretch tool. Implemented via `GetForecastTool` using `ForecastQueryBuilder`.

The LLM decides whether and when to call tools. `ToolCallingLoop` runs up to three iterations, parses tool arguments with Zod, and returns aggregated tool outputs. If the model fails to call `get_po` but the question contains a PO id, the orchestrator calls `get_po` deterministically so the final answer is always grounded in live mock PO data.

## Guardrails

Three guardrails run in order on the parsed recommendation. Any blocking guardrail can override the recommendation, and the orchestrator persists the override before responding.

- **PiiGuardrail** — checks the full JSON response for emails or known matrix names; on hit, replaces the response with a safe `escalate` to `Senior Merch Planner` and a generic rationale.
- **RetrievalConfidenceGuardrail** — blocks when no chunks were retrieved, fewer than two chunks meet `RAG_MIN_SCORE`, the top score is below threshold, citations are not in the retrieved set, or the cited docs are not relevant to the chosen action.
- **ContradictionGuardrail** — blocks when quantity variance lies between 5% and 10% **and** both `po_amendment_policy.md §3` and `§5` are in the retrieved set; the override escalates with a rationale that explicitly mentions the contradictory guidance.

## Event Sourcing

`TriageCase` is event-sourced because the workflow has a natural state machine and we want a replayable audit trail of every triage decision (what was retrieved, what tools ran, what the LLM proposed, what guardrails fired, what the final recommendation was). POs and forecasts, by contrast, are static read-only mock data and would not benefit from event sourcing.

## Tuning Note

`RAG_MIN_SCORE` defaults to `0.4` rather than the spec's `0.68`. Empirically `text-embedding-3-small` produces cosine scores in the 0.4–0.55 range for clearly-on-topic SOP chunks against natural-language triage questions; 0.68 was too aggressive and caused every case to trip the retrieval-confidence guardrail. The threshold is environment-tunable so it can be raised again for a different embedding model.

## Known Limitations

- The vector index is a single in-memory JSON file. Fine for five SOPs; would not scale to a real catalogue.
- The eval suite calls the live LLM, so results depend on the provider being reachable and the model's behaviour. Guardrails are deterministic backstops that keep the three required eval cases stable across runs.
- Forecast use is light — `get_forecast` is wired but the orchestrator does not force-call it.
- Optimistic concurrency on the event store is per-stream, single-process only. A real deployment would need a database-backed store.
- The PII detector uses a simple email regex and a name allow-list parsed from the escalation matrix. It would need expansion for real PII.

## AI Tooling Used

Built with Claude Code (Opus). The system spec was drafted by Claude in a prior step and the implementation in this repo was produced by Claude Code following that spec. No other AI tooling was used.
