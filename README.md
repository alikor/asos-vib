# PO Exception Triage Agent

A TypeScript prototype that helps ASOS Merch Planners triage problem purchase orders. Ask a question in natural language; get a structured, citation-grounded recommendation back — one of `amend`, `split_child_po`, `firm_planned_order`, `raise_backorder`, or `escalate`. Built for the ASOS Sr AI Engineer technical assessment; the full brief lives in [`docs/implementation-spec.md`](docs/implementation-spec.md), and the deeper design notes are in [`WRITEUP.md`](WRITEUP.md).

```
POST /triage
{ "question": "Please triage PO-10001. Supplier confirmed fewer units than ordered." }

→ {
  "po_id": "PO-10001",
  "recommended_action": "amend",
  "rationale": "PO-10001 has a 4% quantity variance and a 1-day ETA slip, both within cited thresholds...",
  "citations": ["po_amendment_policy.md §3", "variance_detection_sop.md §2"],
  "confidence": "high",
  "escalation_target_role": null
}
```

---

## Getting started

### Prerequisites
- Node.js 22+ (or use Docker for everything)
- pnpm 9+ (`npm i -g pnpm@9`)
- An `OPENAI_API_KEY` for the LLM and embedding calls
- Docker + the Compose v2 plugin if you want the containerised path

### 1. Configure environment
```bash
cp .env.example .env
# edit .env and set OPENAI_API_KEY
```

The defaults use OpenAI's `gpt-4o-mini` and `text-embedding-3-small`. Any OpenAI-compatible provider works — point `OPENAI_BASE_URL` and `OPENAI_API_KEY` at it.

### 2. Local run
```bash
pnpm install
pnpm seed:corpus        # writes the 5 SOP markdown files (idempotent)
pnpm seed:data          # writes 20 POs + 20 forecasts (idempotent)
pnpm index              # embeds the corpus → storage/vector-index.json
pnpm dev                # tsx watch on src/main.ts
# or: pnpm build && pnpm start
```

The server listens on `:3000`. If `storage/vector-index.json` is missing at boot, it builds the index automatically before listening.

### 3. Docker run
```bash
docker compose up --build
```
Same outcome, same port. `corpus/`, `data/`, and `storage/` are bind-mounted from the host.

### 4. Try it
```bash
# Health
curl http://localhost:3000/health
# {"status":"ok"}

# Triage
curl -s -X POST http://localhost:3000/triage \
  -H 'Content-Type: application/json' \
  -d '{"question":"Please triage PO-10001. Supplier confirmed fewer units than ordered."}' | jq
```

Try these three deterministic cases:
- **PO-10001** — straightforward `amend`, high confidence.
- **PO-10008** — `escalate` to `Head of Buying` (high value + 20-day delay). Notice no names or emails leak.
- **PO-10012** — `escalate` with low confidence; rationale cites the deliberate `§3` vs `§5` policy contradiction.

### 5. Tests & evals
```bash
pnpm test               # Vitest: 76 unit tests across 18 spec files
pnpm eval               # 3 end-to-end eval cases against a running server
```

---

## High-level implementation

The system is a small Express app with a layered, dependency-inverted architecture. The interesting parts are how it grounds the LLM (RAG over the 5 SOPs), how it constrains the LLM (Zod schema + three guardrails), and how it audits each decision (event sourcing on a single `TriageCase` aggregate).

### Architecture
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ HTTP                            POST /triage  ·  GET /health                │
│                                  TriageController                           │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Application                     TriageOrchestrator                          │
│   ┌─ Queries (reads)     ─ PolicyChunkQueryBuilder · PurchaseOrderQB · ...  │
│   ├─ Commands (writes)   ─ 7 CommandHandlers → EventStore + EventBus        │
│   ├─ Guardrails          ─ Pii · RetrievalConfidence · Contradiction        │
│   └─ Triage              ─ VarianceCalculator · RecommendationSchema        │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Domain                  TriageCase (event-sourced aggregate)                │
│                         Recommendation · PolicyChunk types                  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Infrastructure                                                              │
│   LLM        ─ OpenAiCompatibleLlmClient + ToolCallingLoop                  │
│   Embeddings ─ OpenAiCompatibleEmbeddingClient                              │
│   RAG        ─ MarkdownCorpusLoader · MarkdownChunker · InMemoryVectorIndex │
│   Tools      ─ GetPoTool · GetForecastTool                                  │
│   Persistence─ JsonlEventStore · InProcessEventBus · TriageCaseProjector    │
│   Security   ─ PiiDetector · EscalationMatrixSanitizer                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Design rules
- **SOLID** — small, focused interfaces (`LlmClient`, `EmbeddingClient`, `EventStore`, `Guardrail`, `AgentTool`). Adapters are substitutable; the orchestrator depends only on abstractions.
- **CQRS** — reads use **QueryBuilder** objects, writes go through **commands and command handlers**. **No repository classes** anywhere.
- **Event sourcing** for the `TriageCase` only — its workflow has a state machine. POs and forecasts are static mock data.
- **Eventually consistent** projections — handlers append events to a JSONL event store; the projector subscribes to the in-process bus and updates `storage/triage-case-projections.json` after the response is returned.
- **No frontend** — single endpoint, `POST /triage`.

### Request flow
For each `/triage` call, `TriageOrchestrator` runs this sequence:

1. Validate the body; extract any `PO-\d+` from the question.
2. Dispatch `StartTriageCaseCommand` → `TriageCaseStarted` event (version 1).
3. First RAG pass: embed the question, cosine-search the index.
4. Dispatch `RecordRetrievedContextCommand` → `SopContextRetrieved` event.
5. Tool-calling loop (max 3 iterations). The model decides whether to call `get_po` and/or `get_forecast`. If it doesn't call `get_po` but a PO id is in the question, the orchestrator force-calls it.
6. Dispatch `RecordToolDataLoadedCommand` per tool call.
7. `VarianceCalculator` computes quantity % / ETA day-diff / value **deterministically** — the LLM never does this maths.
8. Second RAG pass with a synthesised query containing those facts; merge + de-dup with pass 1.
9. Final LLM call with `response_format: { type: "json_object" }`.
10. Zod-parse the output; one corrective retry on failure; safe-fallback to `escalate` if still invalid.
11. Run the three guardrails in order (PII → RetrievalConfidence → Contradiction). Any blocking guardrail overrides the recommendation.
12. Dispatch `RecordRecommendationGenerated` + `RecordGuardrailsEvaluated`.
13. Dispatch the terminal command — `CompleteTriageCaseCommand` (happy path) or `EscalateTriageCaseCommand`.
14. Respond with the final recommendation.

### RAG
- Five Markdown SOPs in `corpus/`, headed by `## §N` section anchors so citations like `po_amendment_policy.md §3` are stable.
- `MarkdownChunker` splits by heading; `EscalationMatrixSanitizer` redacts Names/Emails before chunks are embedded so PII never reaches the prompt or the index.
- Embeddings via `OpenAiCompatibleEmbeddingClient`, persisted to `storage/vector-index.json`.
- `InMemoryVectorIndex` does cosine similarity; `PolicyChunkQueryBuilder` is the only read path.
- The final response's citations are validated against the retrieved set — the LLM cannot invent citations.

### Tools (model-callable)
- `get_po(po_id)` — required. Backed by `PurchaseOrderQueryBuilder` over `data/purchase_orders.json`.
- `get_forecast(sku)` — optional stretch. Backed by `ForecastQueryBuilder` over `data/forecasts.json`.

Both implement the `AgentTool` interface and are wired through `AgentToolRegistry`. The model chooses when to call them.

### Guardrails
Run in order; the first blocking guardrail overrides the recommendation:

1. **PiiGuardrail** — checks the serialised response for any email or any name parsed from the raw escalation matrix. Blocks → safe `escalate` to `Senior Merch Planner`.
2. **RetrievalConfidenceGuardrail** — blocks on no chunks, fewer than two above `RAG_MIN_SCORE`, top score below threshold, unknown citations, or action-vs-citation mismatch.
3. **ContradictionGuardrail** — blocks when quantity variance is in the 5–10% band AND both `po_amendment_policy.md §3` and `§5` were retrieved. The override explicitly mentions the contradiction.

### Event sourcing — the `TriageCase`
State machine:
```
started → context_retrieved → tool_data_loaded → recommendation_generated
        → guardrails_evaluated → completed | escalated | failed
```
Each command handler reads the stream from `JsonlEventStore`, rehydrates the aggregate with `TriageCase.rehydrate(events)`, invokes one method, pulls the uncommitted events, appends them at the expected version (optimistic concurrency), and publishes them to the in-process bus. The `TriageCaseProjector` subscribes and updates the eventually-consistent projection.

Inspect the audit trail any time:
```bash
cat storage/events.jsonl | tail -20 | jq -c '{type, caseId, occurredAt}'
cat storage/triage-case-projections.json | jq .
```

### Tuning note
`RAG_MIN_SCORE` defaults to `0.4` rather than the spec's `0.68`. Empirically `text-embedding-3-small` produces cosine scores in the 0.4–0.55 range for clearly on-topic SOP chunks; 0.68 was too aggressive and would trip the retrieval-confidence guardrail on every case. Tune via `.env` if you swap embedding models.

---

## Repository layout

```
corpus/                              5 mock SOPs (one with a deliberate contradiction, one with a PII trap)
data/                                purchase_orders.json (20) + forecasts.json (20)
docs/implementation-spec.md          The full brief
scripts/                             seed:corpus · seed:data · build-index
evals/                               cases.json + run-evals.ts
src/
  interfaces/http/                   Express controller + routes
  application/
    triage/                          TriageOrchestrator, VarianceCalculator, schema, prompts
    commands/ command-handlers/      CQRS write side (7 commands, 7 handlers)
    queries/                         QueryBuilders (no repositories)
    guardrails/                      Pii · RetrievalConfidence · Contradiction
  domain/                            Types + TriageCase aggregate + events
  infrastructure/                    llm · embeddings · rag · tools · persistence · security
  shared/                            Errors, ids, logger
  main.ts                            DI wiring + startup
tests/                               18 spec files, 76 tests
Dockerfile / docker-compose.yml      Multi-stage from node:22-bookworm-slim
storage/                             Generated: vector-index.json, events.jsonl, projections.json
WRITEUP.md                           Stack · design choices · LLM provider · guardrails · RAG · tools · AI tooling used
```

## Reference

- [`docs/implementation-spec.md`](docs/implementation-spec.md) — full specification (single source of truth).
- [`WRITEUP.md`](WRITEUP.md) — narrative on stack, architecture, RAG, guardrails, event sourcing, and AI tooling used.
- [`evals/cases.json`](evals/cases.json) — the three deterministic eval cases.
