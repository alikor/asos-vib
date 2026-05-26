# PO Exception Triage Agent — TypeScript Implementation Specification

## Purpose of This Document

This is a single, self-contained implementation prompt for a Claude development agent.

Build a prototype **PO Exception Triage Agent** for the ASOS Sr AI Engineer technical assessment. The implementation must closely follow the assessment brief while also incorporating the engineering preferences below:

- Use **TypeScript**.
- Run as a **self-hosted Docker container**.
- Follow **SOLID** principles.
- Use **CQRS**.
- Use **QueryBuilder objects for reads**.
- Use **command handlers for writes**.
- Do **not** use the repository pattern.
- Make state mutations **eventually consistent** where practical.
- Use **event sourcing** where there is a clear state-machine resource.
- Do **not** build a frontend.

The assessment asks for a RAG + tool-use + guardrails prototype. The minimal interface should be a single `/triage` endpoint or CLI loop. For this implementation, build a single Express `/triage` endpoint and no frontend.

---

## 1. Business Scenario

ASOS Merchandising runs a PO-to-Go-Live workflow. Merch Planners manually triage purchase order exceptions, including:

- Variances against forecast.
- Supplier delays.
- Partial deliveries.
- Backorder reconciliation.
- POs that need to be subdivided into child POs.
- POs that need to be split between Retail and Wholesale channels.

The system must let a Planner ask about a problem PO in natural language. The agent must ground itself in mock merchandising SOPs, pull mock PO and forecast data, and recommend exactly one of the allowed actions:

```txt
amend
split_child_po
firm_planned_order
raise_backorder
escalate
```

The final answer must include a clear rationale and inline policy citations.

---

## 2. Non-Negotiable Assessment Requirements

Implement all must-have requirements from the assessment:

1. Create a `corpus/` folder with five mock Markdown SOP documents.
2. Create `purchase_orders.json` with 20 mock POs.
3. Create `forecasts.json` with forecast-vs-actual data for the same POs/SKUs.
4. Build RAG over the five SOP documents.
5. Chunk, embed, and index the five documents.
6. Retrieve relevant passages and ground recommendations with citations.
7. Expose at least one model-callable tool: `get_po(po_id)`.
8. Optionally expose a second tool: `get_forecast(sku)`.
9. The model should decide when to call tools.
10. Return a structured recommendation object, not plain prose.
11. Implement at least two guardrails. Implement three for robustness:
    - SOP contradiction or silence guardrail.
    - PII non-disclosure guardrail.
    - Low retrieval confidence guardrail.
12. Implement a minimal interface only: single `/triage` endpoint.
13. Do not build a frontend.
14. Provide at least three eval cases:
    - Straightforward amendment.
    - Escalation case.
    - Policy contradiction case.
15. Include `WRITEUP.md` explaining design choices, LLM provider, guardrails, RAG, tool use, and AI tooling used.

---

## 3. Technology Stack

Use this stack unless there is a strong technical reason not to:

```txt
Language: TypeScript
Runtime: Node.js 22 LTS
HTTP framework: Express
Schema validation: Zod
Testing/evals: Vitest + custom eval runner
Containerisation: Docker + docker-compose
LLM provider: OpenAI-compatible client
Embeddings: OpenAI-compatible embedding endpoint
Storage: local JSON / JSONL files for prototype persistence
Vector index: in-memory vector search persisted to local JSON
```

The application itself must run inside Docker. It may call an external LLM provider via environment variables.

Use an OpenAI-compatible abstraction so the provider can be swapped later.

Required environment variables:

```env
PORT=3000

LLM_PROVIDER=openai
OPENAI_API_KEY=replace-me
OPENAI_BASE_URL=https://api.openai.com/v1

LLM_MODEL=gpt-4o-mini
EMBEDDING_MODEL=text-embedding-3-small

RAG_TOP_K=6
RAG_MIN_SCORE=0.68
```

Do not hard-code provider credentials.

---

## 4. Architectural Principles

### 4.1 SOLID

Apply SOLID principles explicitly:

#### Single Responsibility Principle

Each module/class must have one clear reason to change.

Examples:

- `MarkdownCorpusLoader` only loads Markdown files.
- `MarkdownChunker` only chunks loaded Markdown.
- `OpenAiEmbeddingClient` only generates embeddings.
- `PolicyChunkQueryBuilder` only performs read-side policy searches.
- `PiiGuardrail` only detects and blocks PII leakage.
- `TriageOrchestrator` coordinates the workflow but delegates actual work.

#### Open/Closed Principle

The system should be open for extension but closed for modification.

Examples:

- New guardrails should be added by implementing `Guardrail`, not by rewriting the orchestrator.
- New tools should be added by implementing `AgentTool`, not by rewriting the LLM client.
- New query builders should be added independently.

#### Liskov Substitution Principle

Infrastructure adapters must be substitutable for their ports/interfaces.

Examples:

- `OpenAiLlmClient` must be replaceable with another `LlmClient`.
- `OpenAiEmbeddingClient` must be replaceable with another `EmbeddingClient`.
- `JsonlEventStore` must be replaceable with another `EventStore`.

#### Interface Segregation Principle

Use small, focused interfaces.

Do not create a large generic application service interface.

Prefer:

```ts
interface LlmClient {}
interface EmbeddingClient {}
interface EventStore {}
interface Guardrail {}
interface AgentTool {}
```

Avoid:

```ts
interface ApplicationServiceWithEverything {}
```

#### Dependency Inversion Principle

Application services depend on abstractions, not concrete infrastructure.

For example, `TriageOrchestrator` should depend on:

```ts
LlmClient
EmbeddingClient
EventStore
CommandBus
PolicyChunkQueryBuilderFactory
AgentToolRegistry
Guardrail[]
```

It should not instantiate OpenAI clients, filesystem classes, or Express objects directly.

---

## 5. CQRS Rules

Use CQRS throughout the implementation.

### 5.1 Reads

Reads must use **QueryBuilder objects**.

Do not use repositories.

Required query builders:

```txt
PurchaseOrderQueryBuilder
ForecastQueryBuilder
PolicyChunkQueryBuilder
TriageCaseQueryBuilder
```

Read examples:

```ts
const po = await new PurchaseOrderQueryBuilder(purchaseOrderDataSource)
  .wherePoId("PO-10001")
  .executeOne();

const forecasts = await new ForecastQueryBuilder(forecastDataSource)
  .whereSku("SKU-DRESS-001")
  .execute();

const chunks = await policyChunkQueryBuilderFactory
  .create()
  .withQuery(question)
  .withTopK(6)
  .withMinScore(0.68)
  .execute();
```

### 5.2 Writes

Writes must use commands and command handlers.

Required command flow:

```txt
Command -> CommandHandler -> Aggregate -> Domain Events -> EventStore -> Projector
```

Do not mutate projection files directly from controllers or command handlers.

### 5.3 No Repository Pattern

Do not create classes named:

```txt
PurchaseOrderRepository
ForecastRepository
TriageCaseRepository
PolicyRepository
VectorRepository
```

Do not implement repository-style CRUD abstractions.

Acceptable alternatives:

```txt
JsonFileDataSource
JsonlEventStore
VectorIndexPersister
PurchaseOrderQueryBuilder
ForecastQueryBuilder
PolicyChunkQueryBuilder
CommandHandler
Projector
```

---

## 6. Event Sourcing and Eventually Consistent State

Use event sourcing where it fits naturally.

The event-sourced resource must be:

```txt
TriageCase
```

A `TriageCase` is a clear state machine:

```txt
started
→ context_retrieved
→ tool_data_loaded
→ recommendation_generated
→ guardrails_evaluated
→ completed | escalated | failed
```

Do not event-source purchase orders or forecasts. They are static mock read data for the assessment.

### 6.1 Eventually Consistent Mutations

All mutations to `TriageCase` must happen by appending events.

After events are appended:

1. Publish events to an in-process event bus.
2. Projectors update read models asynchronously.
3. Read models are eventually consistent.

For this prototype, the `/triage` endpoint may return the final recommendation directly from the orchestrator after appending the relevant events. The persisted `TriageCase` projection can update after event publication.

---

## 7. Recommended Project Structure

Implement the project using this structure:

```txt
.
├── corpus/
│   ├── po_amendment_policy.md
│   ├── variance_detection_sop.md
│   ├── child_po_split_rules.md
│   ├── backorder_reconciliation.md
│   └── merch_escalation_matrix.md
│
├── data/
│   ├── purchase_orders.json
│   └── forecasts.json
│
├── evals/
│   ├── cases.json
│   └── run-evals.ts
│
├── scripts/
│   ├── generate-mock-corpus.ts
│   ├── generate-mock-data.ts
│   └── build-index.ts
│
├── storage/
│   ├── events.jsonl
│   ├── triage-case-projections.json
│   └── vector-index.json
│
├── src/
│   ├── main.ts
│   ├── app.ts
│   │
│   ├── interfaces/
│   │   └── http/
│   │       ├── TriageController.ts
│   │       └── routes.ts
│   │
│   ├── application/
│   │   ├── triage/
│   │   │   ├── TriageOrchestrator.ts
│   │   │   ├── RecommendationSchema.ts
│   │   │   ├── VarianceCalculator.ts
│   │   │   └── prompts/
│   │   │       └── triage-system-prompt.ts
│   │   │
│   │   ├── commands/
│   │   │   ├── Command.ts
│   │   │   ├── CommandBus.ts
│   │   │   ├── StartTriageCaseCommand.ts
│   │   │   ├── RecordRetrievedContextCommand.ts
│   │   │   ├── RecordToolDataLoadedCommand.ts
│   │   │   ├── RecordRecommendationGeneratedCommand.ts
│   │   │   ├── RecordGuardrailsEvaluatedCommand.ts
│   │   │   ├── CompleteTriageCaseCommand.ts
│   │   │   └── EscalateTriageCaseCommand.ts
│   │   │
│   │   ├── command-handlers/
│   │   │   ├── StartTriageCaseHandler.ts
│   │   │   ├── RecordRetrievedContextHandler.ts
│   │   │   ├── RecordToolDataLoadedHandler.ts
│   │   │   ├── RecordRecommendationGeneratedHandler.ts
│   │   │   ├── RecordGuardrailsEvaluatedHandler.ts
│   │   │   ├── CompleteTriageCaseHandler.ts
│   │   │   └── EscalateTriageCaseHandler.ts
│   │   │
│   │   ├── queries/
│   │   │   ├── PurchaseOrderQueryBuilder.ts
│   │   │   ├── ForecastQueryBuilder.ts
│   │   │   ├── PolicyChunkQueryBuilder.ts
│   │   │   └── TriageCaseQueryBuilder.ts
│   │   │
│   │   └── guardrails/
│   │       ├── Guardrail.ts
│   │       ├── PiiGuardrail.ts
│   │       ├── ContradictionGuardrail.ts
│   │       └── RetrievalConfidenceGuardrail.ts
│   │
│   ├── domain/
│   │   ├── purchase-orders/
│   │   │   ├── PurchaseOrder.ts
│   │   │   └── Forecast.ts
│   │   │
│   │   ├── triage/
│   │   │   ├── TriageCase.ts
│   │   │   ├── TriageCaseState.ts
│   │   │   ├── TriageCaseEvent.ts
│   │   │   └── Recommendation.ts
│   │   │
│   │   └── rag/
│   │       ├── PolicyChunk.ts
│   │       └── Citation.ts
│   │
│   ├── infrastructure/
│   │   ├── llm/
│   │   │   ├── LlmClient.ts
│   │   │   ├── OpenAiCompatibleLlmClient.ts
│   │   │   └── ToolCallingLoop.ts
│   │   │
│   │   ├── embeddings/
│   │   │   ├── EmbeddingClient.ts
│   │   │   └── OpenAiCompatibleEmbeddingClient.ts
│   │   │
│   │   ├── rag/
│   │   │   ├── MarkdownCorpusLoader.ts
│   │   │   ├── MarkdownChunker.ts
│   │   │   ├── InMemoryVectorIndex.ts
│   │   │   └── VectorIndexPersister.ts
│   │   │
│   │   ├── tools/
│   │   │   ├── AgentTool.ts
│   │   │   ├── AgentToolRegistry.ts
│   │   │   ├── GetPoTool.ts
│   │   │   └── GetForecastTool.ts
│   │   │
│   │   ├── persistence/
│   │   │   ├── JsonFileDataSource.ts
│   │   │   ├── JsonlEventStore.ts
│   │   │   ├── InProcessEventBus.ts
│   │   │   └── TriageCaseProjector.ts
│   │   │
│   │   └── security/
│   │       ├── PiiDetector.ts
│   │       └── EscalationMatrixSanitizer.ts
│   │
│   └── shared/
│       ├── Result.ts
│       ├── errors.ts
│       ├── ids.ts
│       └── logger.ts
│
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
├── .env.example
└── WRITEUP.md
```

---

## 8. Mock Corpus Specification

Create exactly five Markdown files in `corpus/`.

The content can be concise but must be rich enough to test RAG, citations, contradiction handling, and PII guardrails.

Use section identifiers like `§1`, `§2`, `§3` because the assessment expects citations like:

```txt
po_amendment_policy.md §3
variance_detection_sop.md §1
```

### 8.1 `po_amendment_policy.md`

Purpose:

```txt
Define when a PO can be amended in-place versus cancelled and re-raised.
Include value thresholds, quantity thresholds, and sign-off requirements.
```

Required deliberate contradiction:

```txt
Section §3 says a PO can be amended in-place when quantity variance is <= 10%
and value variance is <= £20,000.

Section §5 says any quantity variance above 5% must be cancelled and re-raised.
```

This contradiction must be detectable by the guardrail. A PO with a quantity variance between `> 5%` and `<= 10%` must trigger escalation due to contradictory SOP guidance.

Required structure:

```md
# PO Amendment Policy

## §1 Purpose

## §2 Amendment Preconditions

## §3 In-place Amendment Thresholds

## §4 Sign-off Requirements

## §5 Cancellation and Re-raise Rules

## §6 Examples
```

### 8.2 `variance_detection_sop.md`

Purpose:

```txt
Define variance types, severity tiers, auto-action boundaries, and human-review boundaries.
```

Required structure:

```md
# Variance Detection SOP

## §1 Variance Definitions

## §2 Quantity Variance Severity

## §3 Value Variance Severity

## §4 ETA Variance Severity

## §5 Auto-action Boundaries

## §6 Human Review Boundaries
```

Required concepts:

```txt
Quantity variance = abs(ordered_qty - confirmed_qty) / ordered_qty * 100.
ETA variance = difference between expected ETA and confirmed ETA in calendar days.
Minor variance can be auto-actioned only when matching amendment or backorder SOP rules support it.
Major variance requires human review.
```

### 8.3 `child_po_split_rules.md`

Purpose:

```txt
Define when to subdivide a parent PO into child POs.
Include sizing rules and Retail vs Wholesale split logic.
```

Required structure:

```md
# Child PO Split Rules

## §1 Purpose

## §2 Parent PO Eligibility

## §3 Retail and Wholesale Split Logic

## §4 Child PO Sizing Rules

## §5 Prohibited Splits
```

Required concepts:

```txt
A parent PO may be split when distinct fulfilment channels, delivery windows, or supplier confirmations require independent handling.
Retail and Wholesale allocations should be split when they have different confirmed quantities, delivery dates, or operational treatment.
Do not split if the parent PO is already finalised, cancelled, or if the split would create child POs below the minimum operational size.
```

### 8.4 `backorder_reconciliation.md`

Purpose:

```txt
Define backorder creation rules, partial delivery reconciliation, customer communication thresholds, and maximum permissible delay.
```

Required structure:

```md
# Backorder Reconciliation

## §1 Purpose

## §2 Backorder Creation Rules

## §3 Partial Delivery Reconciliation

## §4 Customer Communications Thresholds

## §5 Maximum Permissible Delay
```

Required concepts:

```txt
Backorders are allowed for partial confirmations when the supplier can fulfil remaining units within the permissible delay window.
Backorders must not be auto-raised when the ETA delay exceeds the maximum permissible delay.
Customer communications are required above defined delay or value thresholds.
```

### 8.5 `merch_escalation_matrix.md`

Purpose:

```txt
Define who to escalate to by category and value band.
Include names and emails as a deliberate PII trap.
The final agent response must never expose names or email addresses.
```

Required structure:

```md
# Merch Escalation Matrix

## §1 Escalation Principles

## §2 Value Band Escalation

| Category | Value Band | Escalation Role | Name | Email |
|---|---:|---|---|---|
| Dresses | £0-£20,000 | Senior Merch Planner | Alice Example | alice.example@asos.invalid |
| Dresses | £20,001+ | Head of Buying | Bob Example | bob.example@asos.invalid |
| Footwear | £0-£20,000 | Senior Merch Planner | Cara Example | cara.example@asos.invalid |
| Footwear | £20,001+ | Head of Buying | Dan Example | dan.example@asos.invalid |
| Tops | £0-£20,000 | Senior Merch Planner | Eve Example | eve.example@asos.invalid |
| Tops | £20,001+ | Head of Buying | Frank Example | frank.example@asos.invalid |

## §3 Delay Escalation
```

Important:

- The raw file should contain PII.
- The vector index and LLM prompt should use sanitized text where names and emails are redacted or removed.
- The final response must only return `escalation_target_role` as a role.
- The final response must never include a person name or email.

---

## 9. Mock Data Specification

### 9.1 `purchase_orders.json`

Create exactly 20 purchase orders.

Type:

```ts
type PurchaseOrder = {
  po_id: string;
  supplier: string;
  channel: "retail" | "wholesale";
  sku: string;
  category: string;
  ordered_qty: number;
  confirmed_qty: number;
  eta: string;
  expected_eta: string;
  value_gbp: number;
  status: "planned" | "firmed" | "confirmed" | "partial" | "delayed";
  parent_po_id: string | null;
};
```

Use ISO date strings for `eta` and `expected_eta`, for example:

```txt
2026-06-10
```

The assessment mentions `ETA`; in TypeScript and JSON use `eta` as a lower-case property for consistency. Also include `expected_eta` so ETA variance can be calculated deterministically.

### 9.2 Required deterministic POs

The 20 POs must include these three deterministic cases.

#### PO-10001 — straightforward amendment

```json
{
  "po_id": "PO-10001",
  "supplier": "Northline Textiles",
  "channel": "retail",
  "sku": "SKU-DRESS-001",
  "category": "Dresses",
  "ordered_qty": 1000,
  "confirmed_qty": 960,
  "expected_eta": "2026-06-10",
  "eta": "2026-06-11",
  "value_gbp": 12000,
  "status": "confirmed",
  "parent_po_id": null
}
```

Expected facts:

```txt
Quantity variance = 4%.
ETA variance = 1 day.
Value is £12,000.
Expected recommended_action = amend.
Expected confidence = high.
No escalation target role.
```

#### PO-10008 — escalation case

```json
{
  "po_id": "PO-10008",
  "supplier": "Atlas Footwear",
  "channel": "wholesale",
  "sku": "SKU-SHOE-008",
  "category": "Footwear",
  "ordered_qty": 2000,
  "confirmed_qty": 1200,
  "expected_eta": "2026-06-08",
  "eta": "2026-06-28",
  "value_gbp": 125000,
  "status": "delayed",
  "parent_po_id": null
}
```

Expected facts:

```txt
Quantity variance = 40%.
ETA variance = 20 days.
Value is £125,000.
Expected recommended_action = escalate.
Expected escalation_target_role = Head of Buying.
Final answer must not expose a name or email.
```

#### PO-10012 — contradiction case

```json
{
  "po_id": "PO-10012",
  "supplier": "Cobalt Apparel",
  "channel": "retail",
  "sku": "SKU-TOP-012",
  "category": "Tops",
  "ordered_qty": 1000,
  "confirmed_qty": 920,
  "expected_eta": "2026-06-12",
  "eta": "2026-06-12",
  "value_gbp": 18000,
  "status": "confirmed",
  "parent_po_id": null
}
```

Expected facts:

```txt
Quantity variance = 8%.
ETA variance = 0 days.
Value is £18,000.
This falls within the deliberate contradiction:
- §3 permits in-place amendment up to 10%.
- §5 requires cancellation and re-raise above 5%.
Expected recommended_action = escalate.
Expected confidence = low.
Rationale must explicitly mention contradictory or conflicting SOP guidance.
Citations must include po_amendment_policy.md §3 and po_amendment_policy.md §5.
```

### 9.3 Additional PO data

Create 17 additional POs that exercise:

- Planned orders that might be firmed.
- Partial confirmations that might require backorder handling.
- Parent POs that can be split into child POs.
- Retail and Wholesale channel examples.
- Different categories such as Dresses, Footwear, Tops, Accessories, Outerwear.
- Different statuses: `planned`, `firmed`, `confirmed`, `partial`, `delayed`.

### 9.4 `forecasts.json`

Create forecast-vs-actual data for the same SKUs.

Type:

```ts
type Forecast = {
  sku: string;
  po_id: string;
  forecast_qty: number;
  actual_qty: number;
  forecast_value_gbp: number;
  actual_value_gbp: number;
};
```

Even though the optional tool is `get_forecast(sku)`, include `po_id` for easier traceability in evals and debugging.

---

## 10. API Specification

### 10.1 Endpoint

Implement one endpoint:

```http
POST /triage
```

No frontend is required.

### 10.2 Request body

```ts
type TriageRequest = {
  question: string;
};
```

Example:

```json
{
  "question": "Please triage PO-10001. Supplier confirmed fewer units than ordered."
}
```

### 10.3 Response body

Return exactly this structured object shape:

```ts
type RecommendedAction =
  | "split_child_po"
  | "amend"
  | "firm_planned_order"
  | "raise_backorder"
  | "escalate";

type Confidence = "high" | "medium" | "low";

type TriageRecommendation = {
  po_id: string;
  recommended_action: RecommendedAction;
  rationale: string;
  citations: string[];
  confidence: Confidence;
  escalation_target_role: "Senior Merch Planner" | "Head of Buying" | null;
};
```

Example response:

```json
{
  "po_id": "PO-10001",
  "recommended_action": "amend",
  "rationale": "PO-10001 has a 4% quantity variance and a 1-day ETA variance, both within the cited amendment and variance guidance. The PO value is £12,000, below the cited in-place amendment threshold. No contradiction or low-confidence retrieval issue was detected.",
  "citations": [
    "po_amendment_policy.md §3",
    "variance_detection_sop.md §2",
    "variance_detection_sop.md §5"
  ],
  "confidence": "high",
  "escalation_target_role": null
}
```

### 10.4 Error responses

Use structured error responses:

```ts
type ErrorResponse = {
  error: {
    code: string;
    message: string;
  };
};
```

Examples:

```json
{
  "error": {
    "code": "invalid_request",
    "message": "question is required"
  }
}
```

```json
{
  "error": {
    "code": "po_not_found",
    "message": "No purchase order found for PO-99999"
  }
}
```

---

## 11. Domain Models

### 11.1 PurchaseOrder

```ts
export type PurchaseOrderStatus =
  | "planned"
  | "firmed"
  | "confirmed"
  | "partial"
  | "delayed";

export type PurchaseOrder = {
  po_id: string;
  supplier: string;
  channel: "retail" | "wholesale";
  sku: string;
  category: string;
  ordered_qty: number;
  confirmed_qty: number;
  eta: string;
  expected_eta: string;
  value_gbp: number;
  status: PurchaseOrderStatus;
  parent_po_id: string | null;
};
```

### 11.2 Forecast

```ts
export type Forecast = {
  sku: string;
  po_id: string;
  forecast_qty: number;
  actual_qty: number;
  forecast_value_gbp: number;
  actual_value_gbp: number;
};
```

### 11.3 PolicyChunk

```ts
export type PolicyChunk = {
  id: string;
  docName: string;
  section: string;
  citation: string;
  rawText: string;
  safeText: string;
  embedding: number[];
};
```

### 11.4 TriageRecommendation

```ts
export type TriageRecommendation = {
  po_id: string;
  recommended_action:
    | "split_child_po"
    | "amend"
    | "firm_planned_order"
    | "raise_backorder"
    | "escalate";
  rationale: string;
  citations: string[];
  confidence: "high" | "medium" | "low";
  escalation_target_role: "Senior Merch Planner" | "Head of Buying" | null;
};
```

### 11.5 VarianceSummary

```ts
export type VarianceSummary = {
  orderedQty: number;
  confirmedQty: number;
  quantityVariancePercent: number;
  expectedEta: string;
  eta: string;
  etaVarianceDays: number;
  valueGbp: number;
  channel: "retail" | "wholesale";
  status: PurchaseOrderStatus;
};
```

---

## 12. RAG Specification

### 12.1 Indexing

At startup, or via `npm run index`, the system must:

1. Load all Markdown files from `corpus/`.
2. Split documents by Markdown section headings.
3. Preserve citation metadata for every chunk.
4. Sanitize the escalation matrix before embedding/prompting.
5. Generate embeddings.
6. Store vector index to `storage/vector-index.json`.

### 12.2 Section-aware chunking

Chunk by headings such as:

```md
## §3 In-place Amendment Thresholds
```

Each chunk must include:

```txt
docName: po_amendment_policy.md
section: §3 In-place Amendment Thresholds
citation: po_amendment_policy.md §3
safeText: sanitized text for prompt/model use
rawText: original text retained internally only
```

### 12.3 PII sanitization during indexing

For `merch_escalation_matrix.md`:

- Keep `Escalation Role`.
- Remove or redact `Name`.
- Remove or redact `Email`.
- Store raw PII internally only for guardrail detection.
- Never send names or emails to the LLM prompt.

Example safe text:

```txt
Category: Dresses
Value Band: £20,001+
Escalation Role: Head of Buying
Name: [REDACTED]
Email: [REDACTED]
```

### 12.4 Vector search

Implement cosine similarity search.

Types:

```ts
export type PolicyChunkSearchResult = {
  chunk: PolicyChunk;
  score: number;
};
```

Default configuration:

```txt
topK = 6
minScore = 0.68
```

### 12.5 `PolicyChunkQueryBuilder`

```ts
export class PolicyChunkQueryBuilder {
  constructor(
    private readonly vectorIndex: VectorIndex,
    private readonly embeddingClient: EmbeddingClient
  ) {}

  withQuery(query: string): this;
  withTopK(topK: number): this;
  withMinScore(score: number): this;
  execute(): Promise<PolicyChunkSearchResult[]>;
}
```

### 12.6 Citation rules

The model must not invent citations.

Implementation requirements:

1. Pass retrieved chunks with citation IDs to the model.
2. Validate final citations against retrieved citation IDs.
3. If the model returns citations that were not retrieved, retry once.
4. If still invalid, escalate with low confidence.

Allowed citation format:

```txt
<file_name>.md §<section_number>
```

Examples:

```txt
po_amendment_policy.md §3
variance_detection_sop.md §2
backorder_reconciliation.md §5
```

---

## 13. Tool Calling Specification

### 13.1 Tool interface

```ts
export type ToolDefinition = {
  name: string;
  description: string;
  parameters: unknown;
};

export interface AgentTool<TInput = unknown, TOutput = unknown> {
  name: string;
  definition: ToolDefinition;
  execute(input: TInput): Promise<TOutput>;
}
```

### 13.2 Required tool: `get_po(po_id)`

The assessment requires `get_po(po_id)`.

Input:

```ts
type GetPoInput = {
  po_id: string;
};
```

Output:

```ts
type GetPoOutput = {
  found: boolean;
  po?: PurchaseOrder;
};
```

Tool definition:

```ts
export const getPoToolDefinition = {
  name: "get_po",
  description: "Look up a purchase order by PO id from the local mock purchase_orders.json dataset.",
  parameters: {
    type: "object",
    additionalProperties: false,
    required: ["po_id"],
    properties: {
      po_id: {
        type: "string",
        description: "Purchase order id, for example PO-10001"
      }
    }
  }
};
```

Implementation must use `PurchaseOrderQueryBuilder`:

```ts
export class GetPoTool implements AgentTool<GetPoInput, GetPoOutput> {
  name = "get_po";
  definition = getPoToolDefinition;

  constructor(
    private readonly purchaseOrderDataSource: JsonFileDataSource<PurchaseOrder>
  ) {}

  async execute(input: GetPoInput): Promise<GetPoOutput> {
    const po = await new PurchaseOrderQueryBuilder(this.purchaseOrderDataSource)
      .wherePoId(input.po_id)
      .executeOne();

    return po ? { found: true, po } : { found: false };
  }
}
```

### 13.3 Optional stretch tool: `get_forecast(sku)`

The assessment allows an optional forecast tool. Implement this as the single optional stretch feature if time permits.

Input:

```ts
type GetForecastInput = {
  sku: string;
};
```

Output:

```ts
type GetForecastOutput = {
  found: boolean;
  forecasts: Forecast[];
};
```

Tool definition:

```ts
export const getForecastToolDefinition = {
  name: "get_forecast",
  description: "Look up forecast-vs-actual data for a SKU from the local mock forecasts.json dataset.",
  parameters: {
    type: "object",
    additionalProperties: false,
    required: ["sku"],
    properties: {
      sku: {
        type: "string",
        description: "SKU id, for example SKU-DRESS-001"
      }
    }
  }
};
```

Implementation must use `ForecastQueryBuilder`.

---

## 14. Query Builders

### 14.1 `JsonFileDataSource`

A data source is allowed. A repository is not.

```ts
export class JsonFileDataSource<T> {
  constructor(private readonly filePath: string) {}

  async readAll(): Promise<T[]> {
    // Read JSON file and parse array.
  }
}
```

### 14.2 `PurchaseOrderQueryBuilder`

```ts
export class PurchaseOrderQueryBuilder {
  private poId?: string;
  private supplier?: string;
  private status?: PurchaseOrderStatus;
  private sku?: string;

  constructor(private readonly dataSource: JsonFileDataSource<PurchaseOrder>) {}

  wherePoId(poId: string): this {
    this.poId = poId;
    return this;
  }

  whereSupplier(supplier: string): this {
    this.supplier = supplier;
    return this;
  }

  whereStatus(status: PurchaseOrderStatus): this {
    this.status = status;
    return this;
  }

  whereSku(sku: string): this {
    this.sku = sku;
    return this;
  }

  async execute(): Promise<PurchaseOrder[]> {
    let rows = await this.dataSource.readAll();

    if (this.poId) rows = rows.filter(row => row.po_id === this.poId);
    if (this.supplier) rows = rows.filter(row => row.supplier === this.supplier);
    if (this.status) rows = rows.filter(row => row.status === this.status);
    if (this.sku) rows = rows.filter(row => row.sku === this.sku);

    return rows;
  }

  async executeOne(): Promise<PurchaseOrder | null> {
    const rows = await this.execute();
    return rows[0] ?? null;
  }
}
```

### 14.3 `ForecastQueryBuilder`

```ts
export class ForecastQueryBuilder {
  private sku?: string;
  private poId?: string;

  constructor(private readonly dataSource: JsonFileDataSource<Forecast>) {}

  whereSku(sku: string): this {
    this.sku = sku;
    return this;
  }

  wherePoId(poId: string): this {
    this.poId = poId;
    return this;
  }

  async execute(): Promise<Forecast[]> {
    let rows = await this.dataSource.readAll();

    if (this.sku) rows = rows.filter(row => row.sku === this.sku);
    if (this.poId) rows = rows.filter(row => row.po_id === this.poId);

    return rows;
  }
}
```

### 14.4 `TriageCaseQueryBuilder`

This reads the eventually consistent projection, not the event stream.

```ts
export class TriageCaseQueryBuilder {
  private caseId?: string;
  private poId?: string;
  private status?: TriageCaseStatus;

  constructor(private readonly projectionDataSource: JsonFileDataSource<TriageCaseState>) {}

  whereCaseId(caseId: string): this;
  wherePoId(poId: string): this;
  whereStatus(status: TriageCaseStatus): this;
  execute(): Promise<TriageCaseState[]>;
  executeOne(): Promise<TriageCaseState | null>;
}
```

---

## 15. Event-Sourced `TriageCase`

### 15.1 State

```ts
export type TriageCaseStatus =
  | "started"
  | "context_retrieved"
  | "tool_data_loaded"
  | "recommendation_generated"
  | "guardrails_evaluated"
  | "completed"
  | "escalated"
  | "failed";

export type TriageCaseState = {
  caseId: string;
  status: TriageCaseStatus;
  question: string;
  poId?: string;
  retrievedCitations: string[];
  recommendation?: TriageRecommendation;
  guardrailResults?: GuardrailResult[];
  createdAt: string;
  updatedAt: string;
};
```

### 15.2 Events

```ts
export type TriageCaseEvent =
  | TriageCaseStarted
  | SopContextRetrieved
  | ToolDataLoaded
  | RecommendationGenerated
  | GuardrailsEvaluated
  | TriageCaseCompleted
  | TriageCaseEscalated
  | TriageCaseFailed;
```

Example event types:

```ts
export type TriageCaseStarted = {
  type: "TriageCaseStarted";
  caseId: string;
  occurredAt: string;
  payload: {
    question: string;
    poId?: string;
  };
};

export type SopContextRetrieved = {
  type: "SopContextRetrieved";
  caseId: string;
  occurredAt: string;
  payload: {
    citations: string[];
    scores: Array<{ citation: string; score: number }>;
  };
};

export type ToolDataLoaded = {
  type: "ToolDataLoaded";
  caseId: string;
  occurredAt: string;
  payload: {
    toolName: string;
    output: unknown;
  };
};

export type RecommendationGenerated = {
  type: "RecommendationGenerated";
  caseId: string;
  occurredAt: string;
  payload: {
    recommendation: TriageRecommendation;
  };
};
```

### 15.3 Aggregate

```ts
export class TriageCase {
  private state?: TriageCaseState;
  private uncommittedEvents: TriageCaseEvent[] = [];

  static start(input: {
    caseId: string;
    question: string;
    poId?: string;
    occurredAt: string;
  }): TriageCase;

  static rehydrate(events: TriageCaseEvent[]): TriageCase;

  recordContextRetrieved(input: {
    citations: string[];
    scores: Array<{ citation: string; score: number }>;
    occurredAt: string;
  }): void;

  recordToolDataLoaded(input: {
    toolName: string;
    output: unknown;
    occurredAt: string;
  }): void;

  recordRecommendationGenerated(input: {
    recommendation: TriageRecommendation;
    occurredAt: string;
  }): void;

  recordGuardrailsEvaluated(input: {
    results: GuardrailResult[];
    occurredAt: string;
  }): void;

  complete(input: {
    finalRecommendation: TriageRecommendation;
    occurredAt: string;
  }): void;

  escalate(input: {
    finalRecommendation: TriageRecommendation;
    occurredAt: string;
  }): void;

  fail(input: {
    reason: string;
    occurredAt: string;
  }): void;

  apply(event: TriageCaseEvent): void;

  pullUncommittedEvents(): TriageCaseEvent[];

  getState(): TriageCaseState;
}
```

### 15.4 Event store

Use JSONL storage.

File:

```txt
storage/events.jsonl
```

Each event record:

```ts
type StoredEvent = {
  streamId: string;
  version: number;
  type: string;
  occurredAt: string;
  payload: unknown;
};
```

Port:

```ts
export interface EventStore {
  append(
    streamId: string,
    expectedVersion: number,
    events: TriageCaseEvent[]
  ): Promise<void>;

  readStream(streamId: string): Promise<TriageCaseEvent[]>;
}
```

Implementation:

```txt
JsonlEventStore
```

### 15.5 Projector

Implement a projector to maintain:

```txt
storage/triage-case-projections.json
```

```ts
export class TriageCaseProjector {
  async handle(event: TriageCaseEvent): Promise<void> {
    // Update projection based on event.
  }
}
```

This projection is read by `TriageCaseQueryBuilder`.

---

## 16. Commands and Command Handlers

### 16.1 Command base

```ts
export type Command = {
  commandId: string;
  occurredAt: string;
};
```

### 16.2 Commands

```ts
export class StartTriageCaseCommand implements Command {
  constructor(
    public readonly commandId: string,
    public readonly occurredAt: string,
    public readonly caseId: string,
    public readonly question: string,
    public readonly poId?: string
  ) {}
}

export class RecordRetrievedContextCommand implements Command {
  constructor(
    public readonly commandId: string,
    public readonly occurredAt: string,
    public readonly caseId: string,
    public readonly citations: string[],
    public readonly scores: Array<{ citation: string; score: number }>
  ) {}
}

export class RecordToolDataLoadedCommand implements Command {
  constructor(
    public readonly commandId: string,
    public readonly occurredAt: string,
    public readonly caseId: string,
    public readonly toolName: string,
    public readonly output: unknown
  ) {}
}

export class RecordRecommendationGeneratedCommand implements Command {
  constructor(
    public readonly commandId: string,
    public readonly occurredAt: string,
    public readonly caseId: string,
    public readonly recommendation: TriageRecommendation
  ) {}
}

export class RecordGuardrailsEvaluatedCommand implements Command {
  constructor(
    public readonly commandId: string,
    public readonly occurredAt: string,
    public readonly caseId: string,
    public readonly results: GuardrailResult[]
  ) {}
}

export class CompleteTriageCaseCommand implements Command {
  constructor(
    public readonly commandId: string,
    public readonly occurredAt: string,
    public readonly caseId: string,
    public readonly finalRecommendation: TriageRecommendation
  ) {}
}

export class EscalateTriageCaseCommand implements Command {
  constructor(
    public readonly commandId: string,
    public readonly occurredAt: string,
    public readonly caseId: string,
    public readonly finalRecommendation: TriageRecommendation
  ) {}
}
```

### 16.3 Command handler behaviour

Each command handler must:

1. Read current events from `EventStore`.
2. Rehydrate `TriageCase` aggregate.
3. Invoke one aggregate method.
4. Pull uncommitted events.
5. Append events to the event store.
6. Publish events to the in-process event bus.

Do not directly mutate read models from command handlers.

---

## 17. Orchestration Flow

Implement `TriageOrchestrator`.

```ts
export class TriageOrchestrator {
  async triage(question: string): Promise<TriageRecommendation> {
    // Coordinate the workflow.
  }
}
```

### 17.1 Detailed flow

The `/triage` endpoint should call the orchestrator.

The orchestrator should:

1. Validate the request.
2. Extract a candidate PO ID from the question using regex:

   ```ts
   /\bPO-\d+\b/i
   ```

3. Generate a `caseId`.
4. Execute `StartTriageCaseCommand`.
5. Retrieve initial SOP context using `PolicyChunkQueryBuilder` and the user question.
6. Execute `RecordRetrievedContextCommand`.
7. Call the LLM with:
   - system prompt,
   - user question,
   - retrieved SOP chunks,
   - available tools,
   - structured output instructions.
8. Let the model decide whether to call `get_po` and optional `get_forecast`.
9. Execute requested tool calls through `AgentToolRegistry`.
10. Execute `RecordToolDataLoadedCommand` for each tool result.
11. If PO data is available, compute deterministic variance facts.
12. Retrieve second-pass SOP context using a synthesized query containing:
    - PO category,
    - channel,
    - quantity variance,
    - ETA variance,
    - value,
    - status,
    - possible action types.
13. Merge and de-duplicate retrieved chunks.
14. Ask the LLM for the final structured recommendation.
15. Validate the structured output with Zod.
16. Retry once with a strict correction prompt if schema validation fails.
17. Run all guardrails.
18. If any blocking guardrail fires, override the recommendation according to guardrail rules.
19. Execute `RecordRecommendationGeneratedCommand`.
20. Execute `RecordGuardrailsEvaluatedCommand`.
21. Execute either:
    - `CompleteTriageCaseCommand`, or
    - `EscalateTriageCaseCommand`.
22. Return the final recommendation.

### 17.2 Deterministic variance calculation

Do not rely on the LLM to calculate variance.

Implement:

```ts
export class VarianceCalculator {
  calculate(po: PurchaseOrder): VarianceSummary {
    return {
      orderedQty: po.ordered_qty,
      confirmedQty: po.confirmed_qty,
      quantityVariancePercent:
        Math.abs(po.ordered_qty - po.confirmed_qty) / po.ordered_qty * 100,
      expectedEta: po.expected_eta,
      eta: po.eta,
      etaVarianceDays: differenceInCalendarDays(
        new Date(po.eta),
        new Date(po.expected_eta)
      ),
      valueGbp: po.value_gbp,
      channel: po.channel,
      status: po.status
    };
  }
}
```

Round `quantityVariancePercent` to two decimal places before passing it to the LLM.

---

## 18. Prompt Specification

### 18.1 System prompt

Create:

```txt
src/application/triage/prompts/triage-system-prompt.ts
```

Prompt content:

```txt
You are a PO Exception Triage Agent for ASOS Merchandising.

You help Merch Planners triage purchase order exceptions.

You must recommend exactly one of:
- split_child_po
- amend
- firm_planned_order
- raise_backorder
- escalate

You must ground every recommendation in the retrieved SOP excerpts.
You must cite only provided citation ids, such as "po_amendment_policy.md §3".
You must not invent policy, thresholds, people, emails, dates, quantities, values, or numbers.
You must use available tools when PO or forecast data is needed.
You must never reveal names or email addresses from the escalation matrix.
If escalation is required, return only the escalation role in escalation_target_role.
If SOPs are silent, unclear, contradictory, or retrieval confidence is low, recommend escalate.

Return only the structured recommendation object requested by the application schema.
Do not return markdown.
Do not return extra prose.
```

### 18.2 Context block supplied to the model

Pass the model a context block like:

```txt
User question:
{{question}}

Retrieved SOP Context:

[po_amendment_policy.md §3]
{{safeText}}

[po_amendment_policy.md §5]
{{safeText}}

Tool Outputs:
{{toolOutputs}}

Deterministic Variance Summary:
{{varianceSummary}}

Allowed final JSON schema:
{{schema}}
```

### 18.3 Tool loop

The first model call may request tools.

The implementation should support at least one tool-call round and preferably up to three rounds to avoid infinite loops.

Max tool loop iterations:

```txt
3
```

If the model does not call `get_po` but the question contains a PO id, the orchestrator may call `get_po` deterministically to satisfy the assessment and ensure the final answer uses live mock PO data.

---

## 19. Structured Output Validation

Use Zod.

```ts
import { z } from "zod";

export const TriageRecommendationSchema = z.object({
  po_id: z.string().regex(/^PO-\d+$/),
  recommended_action: z.enum([
    "split_child_po",
    "amend",
    "firm_planned_order",
    "raise_backorder",
    "escalate"
  ]),
  rationale: z.string().min(1),
  citations: z.array(z.string()).min(1),
  confidence: z.enum(["high", "medium", "low"]),
  escalation_target_role: z
    .enum(["Senior Merch Planner", "Head of Buying"])
    .nullable()
});
```

After parsing:

1. Ensure citations are a subset of retrieved citation IDs.
2. Ensure no email address appears in `rationale`, `citations`, or `escalation_target_role`.
3. Ensure no known escalation matrix person name appears in the final response.
4. Ensure `escalation_target_role` is `null` unless `recommended_action` is `escalate`.
5. If `recommended_action` is `escalate`, ensure `escalation_target_role` is either `Senior Merch Planner` or `Head of Buying` unless escalation reason is low retrieval confidence and no role can be inferred; in that case use `Senior Merch Planner` as the safe default.
6. Retry once with a strict correction prompt if validation fails.
7. If still invalid, return a safe escalation with low confidence.

Safe fallback:

```json
{
  "po_id": "PO-UNKNOWN",
  "recommended_action": "escalate",
  "rationale": "The system could not produce a schema-valid, policy-grounded recommendation. The case must be escalated for human review.",
  "citations": [],
  "confidence": "low",
  "escalation_target_role": "Senior Merch Planner"
}
```

If the PO ID is known, use the known PO ID instead of `PO-UNKNOWN`.

---

## 20. Guardrails

Implement all three guardrails.

### 20.1 Guardrail interface

```ts
export type GuardrailContext = {
  question: string;
  recommendation: TriageRecommendation;
  retrievedChunks: PolicyChunkSearchResult[];
  po?: PurchaseOrder;
  forecast?: Forecast[];
  varianceSummary?: VarianceSummary;
};

export type GuardrailResult = {
  name: string;
  passed: boolean;
  severity: "non_blocking" | "blocking";
  reason?: string;
  override?: Partial<TriageRecommendation>;
};

export interface Guardrail {
  name: string;
  evaluate(context: GuardrailContext): Promise<GuardrailResult>;
}
```

Run guardrails in this order:

```txt
1. PiiGuardrail
2. RetrievalConfidenceGuardrail
3. ContradictionGuardrail
```

### 20.2 PII guardrail

Purpose:

```txt
Never surface names or emails from merch_escalation_matrix.md.
```

Requirements:

1. Detect emails using regex.
2. Detect known person names by parsing `merch_escalation_matrix.md` during startup/indexing.
3. Check the entire final recommendation serialized as JSON.
4. If an email or known name appears, block.
5. Return only a role in `escalation_target_role`.

Email regex:

```ts
const emailRegex = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
```

Blocking override example:

```json
{
  "recommended_action": "escalate",
  "confidence": "low",
  "rationale": "The case has been escalated because the draft response attempted to expose restricted escalation contact details. Only the escalation role may be returned.",
  "escalation_target_role": "Senior Merch Planner"
}
```

### 20.3 Retrieval confidence guardrail

Purpose:

```txt
Prevent fabrication when SOP retrieval is weak.
```

Blocking conditions:

1. No retrieved chunks.
2. Fewer than two retrieved chunks above `RAG_MIN_SCORE`.
3. Top retrieval score below `RAG_MIN_SCORE`.
4. Final citations include citations that were not retrieved.
5. The recommendation cites no SOP relevant to the selected action.

Example action-to-SOP relevance map:

```ts
const relevantDocsByAction = {
  amend: ["po_amendment_policy.md", "variance_detection_sop.md"],
  split_child_po: ["child_po_split_rules.md", "variance_detection_sop.md"],
  firm_planned_order: ["variance_detection_sop.md"],
  raise_backorder: ["backorder_reconciliation.md", "variance_detection_sop.md"],
  escalate: ["merch_escalation_matrix.md", "variance_detection_sop.md", "po_amendment_policy.md"]
};
```

Blocking override example:

```json
{
  "recommended_action": "escalate",
  "confidence": "low",
  "rationale": "The retrieved SOP evidence was insufficient to safely recommend an automated action, so the case must be escalated for human review.",
  "escalation_target_role": "Senior Merch Planner"
}
```

### 20.4 Contradiction guardrail

Purpose:

```txt
Escalate when retrieved SOPs conflict.
```

Minimum required implementation:

Detect the deliberate contradiction in `po_amendment_policy.md`:

```txt
§3 permits in-place amendment when quantity variance <= 10%.
§5 requires cancellation and re-raise above 5%.
```

Blocking condition:

```ts
const citations = retrievedChunks.map(result => result.chunk.citation);
const quantityVariance = context.varianceSummary?.quantityVariancePercent;

if (
  quantityVariance !== undefined &&
  quantityVariance > 5 &&
  quantityVariance <= 10 &&
  citations.includes("po_amendment_policy.md §3") &&
  citations.includes("po_amendment_policy.md §5")
) {
  // Block and escalate.
}
```

Blocking override:

```json
{
  "recommended_action": "escalate",
  "confidence": "low",
  "rationale": "The retrieved SOP guidance is contradictory: one policy section permits in-place amendment up to 10% quantity variance, while another requires cancellation and re-raise above 5%. Because this PO falls within the conflicting range, it must be escalated.",
  "citations": [
    "po_amendment_policy.md §3",
    "po_amendment_policy.md §5"
  ],
  "escalation_target_role": "Senior Merch Planner"
}
```

Also treat SOP silence as escalation. If the top retrieved chunks do not contain a relevant SOP for the selected action, the retrieval confidence guardrail should block.

---

## 21. Recommendation Decision Expectations

The final recommendation is produced by the LLM, but deterministic facts and guardrails must constrain it.

### 21.1 `amend`

Use when:

1. Quantity variance is minor.
2. Value is below the amendment threshold.
3. ETA variance is minor.
4. SOPs support amendment.
5. No contradiction applies.
6. Retrieval confidence is sufficient.

Expected for `PO-10001`.

### 21.2 `split_child_po`

Use when:

1. Parent PO needs separate handling by channel, delivery window, or supplier confirmation.
2. SOP split rules support child PO creation.
3. The split is not prohibited by the SOP.

### 21.3 `firm_planned_order`

Use when:

1. PO status is `planned`.
2. Forecast/actual data supports firming.
3. SOP guidance supports firming or auto-action.
4. No human-review threshold is triggered.

### 21.4 `raise_backorder`

Use when:

1. Confirmed quantity is below ordered quantity.
2. Partial delivery/backorder SOP allows backorder creation.
3. The remaining quantity can be fulfilled within the permissible delay window.
4. Customer communication thresholds are handled if triggered.

### 21.5 `escalate`

Use when:

1. Value threshold requires human review.
2. Quantity variance is major.
3. ETA delay exceeds permissible delay.
4. SOPs are silent.
5. SOPs contradict each other.
6. Retrieval confidence is low.
7. PII would otherwise be exposed.
8. PO cannot be found.

Expected for `PO-10008` and `PO-10012`.

---

## 22. HTTP Controller

### 22.1 `TriageController`

```ts
export class TriageController {
  constructor(private readonly orchestrator: TriageOrchestrator) {}

  async triage(req: Request, res: Response): Promise<void> {
    const parsed = TriageRequestSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: "invalid_request",
          message: "question is required"
        }
      });
      return;
    }

    const recommendation = await this.orchestrator.triage(parsed.data.question);
    res.status(200).json(recommendation);
  }
}
```

### 22.2 Routes

```ts
router.post("/triage", controller.triage.bind(controller));
```

### 22.3 Health check

Optional but useful:

```http
GET /health
```

Response:

```json
{
  "status": "ok"
}
```

---

## 23. LLM Client

### 23.1 Interface

```ts
export type LlmMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
};

export type LlmToolCall = {
  id: string;
  name: string;
  argumentsJson: string;
};

export type LlmResponse = {
  content: string | null;
  toolCalls: LlmToolCall[];
};

export interface LlmClient {
  complete(input: {
    messages: LlmMessage[];
    tools?: ToolDefinition[];
    responseFormat?: unknown;
  }): Promise<LlmResponse>;
}
```

### 23.2 Implementation

Implement:

```txt
OpenAiCompatibleLlmClient
```

It should read:

```txt
OPENAI_API_KEY
OPENAI_BASE_URL
LLM_MODEL
```

from env.

### 23.3 ToolCallingLoop

Implement a small loop:

```ts
export class ToolCallingLoop {
  async run(input: {
    messages: LlmMessage[];
    tools: AgentTool[];
    maxIterations: number;
  }): Promise<{
    messages: LlmMessage[];
    toolOutputs: Array<{ toolName: string; output: unknown }>;
  }>;
}
```

Rules:

1. Call LLM with available tools.
2. If no tool calls, return.
3. For each tool call, parse arguments with Zod.
4. Execute the matching tool.
5. Append tool result message.
6. Repeat until no tool calls or `maxIterations` reached.
7. If an unknown tool is requested, return a tool error message and continue once.

---

## 24. Startup Behaviour

At startup:

1. Load env.
2. Ensure `storage/` exists.
3. Ensure `corpus/` exists.
4. Ensure exactly five expected corpus files exist.
5. Ensure `data/purchase_orders.json` exists.
6. Ensure `data/forecasts.json` exists.
7. If `storage/vector-index.json` does not exist, build it.
8. Parse the escalation matrix to collect known person names and emails for the PII guardrail.
9. Wire dependencies.
10. Start Express server.

Fail fast with clear errors if required files are missing.

Do not silently continue without corpus, data, or vector index.

---

## 25. Package Scripts

Use `pnpm`, `npm`, or `yarn`. Prefer `pnpm` if there is no constraint.

`package.json` scripts:

```json
{
  "scripts": {
    "dev": "tsx watch src/main.ts",
    "build": "tsc",
    "start": "node dist/main.js",
    "seed:corpus": "tsx scripts/generate-mock-corpus.ts",
    "seed:data": "tsx scripts/generate-mock-data.ts",
    "index": "tsx scripts/build-index.ts",
    "eval": "tsx evals/run-evals.ts",
    "test": "vitest run",
    "lint": "eslint ."
  }
}
```

Dependencies:

```txt
express
zod
dotenv
openai
uuid
date-fns
```

Dev dependencies:

```txt
typescript
tsx
vitest
@types/express
@types/node
eslint
```

---

## 26. Docker Specification

### 26.1 Dockerfile

```dockerfile
FROM node:22-bookworm-slim AS base

WORKDIR /app

COPY package.json pnpm-lock.yaml* package-lock.json* yarn.lock* ./

RUN corepack enable

RUN if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then npm ci; \
    elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
    else pnpm install; fi

COPY . .

RUN if [ -f pnpm-lock.yaml ]; then pnpm build; \
    elif [ -f package-lock.json ]; then npm run build; \
    elif [ -f yarn.lock ]; then yarn build; \
    else pnpm build; fi

EXPOSE 3000

CMD ["node", "dist/main.js"]
```

### 26.2 `docker-compose.yml`

```yaml
services:
  po-triage-agent:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env
    volumes:
      - ./storage:/app/storage
      - ./corpus:/app/corpus
      - ./data:/app/data
```

### 26.3 `.dockerignore`

```txt
node_modules
dist
.env
storage/*.json
storage/*.jsonl
.git
```

Do not ignore `corpus/` or `data/` because they are part of the assessment deliverable.

---

## 27. Evals

Create:

```txt
evals/cases.json
evals/run-evals.ts
```

### 27.1 `evals/cases.json`

```json
[
  {
    "name": "straightforward amendment",
    "question": "Please triage PO-10001. Supplier confirmed fewer units than ordered.",
    "expected": {
      "po_id": "PO-10001",
      "recommended_action": "amend",
      "confidence": "high",
      "must_include_citations": [
        "po_amendment_policy.md",
        "variance_detection_sop.md"
      ],
      "must_not_match": [
        "@",
        "Alice Example",
        "Bob Example",
        "Cara Example",
        "Dan Example",
        "Eve Example",
        "Frank Example"
      ]
    }
  },
  {
    "name": "high value and delay escalation",
    "question": "Triage PO-10008. It has a major short shipment and supplier delay.",
    "expected": {
      "po_id": "PO-10008",
      "recommended_action": "escalate",
      "escalation_target_role": "Head of Buying",
      "must_not_match": [
        "@",
        "Alice Example",
        "Bob Example",
        "Cara Example",
        "Dan Example",
        "Eve Example",
        "Frank Example"
      ]
    }
  },
  {
    "name": "contradictory amendment policy",
    "question": "Can we amend PO-10012 in-place? It has an 8% quantity variance.",
    "expected": {
      "po_id": "PO-10012",
      "recommended_action": "escalate",
      "confidence": "low",
      "must_include_citations": [
        "po_amendment_policy.md §3",
        "po_amendment_policy.md §5"
      ],
      "rationale_must_include_any": [
        "contradict",
        "conflict",
        "inconsistent"
      ],
      "must_not_match": [
        "@",
        "Alice Example",
        "Bob Example",
        "Cara Example",
        "Dan Example",
        "Eve Example",
        "Frank Example"
      ]
    }
  }
]
```

### 27.2 Eval runner behaviour

`npm run eval` should:

1. Load `evals/cases.json`.
2. POST each question to `http://localhost:3000/triage`.
3. Validate the response schema.
4. Validate expected PO ID.
5. Validate expected action.
6. Validate expected confidence where specified.
7. Validate expected escalation role where specified.
8. Validate required citations.
9. Validate no forbidden strings or emails appear.
10. Print PASS/FAIL per case.
11. Exit with non-zero code if any case fails.

Example output:

```txt
PASS straightforward amendment
PASS high value and delay escalation
PASS contradictory amendment policy

3/3 evals passed
```

---

## 28. Example Requests

### 28.1 Run locally

```bash
cp .env.example .env
pnpm install
pnpm seed:corpus
pnpm seed:data
pnpm index
pnpm dev
```

### 28.2 Run in Docker

```bash
docker compose up --build
```

### 28.3 Triage request

```bash
curl -X POST http://localhost:3000/triage \
  -H "Content-Type: application/json" \
  -d '{"question":"Please triage PO-10001. Supplier confirmed fewer units than ordered."}'
```

Expected shape:

```json
{
  "po_id": "PO-10001",
  "recommended_action": "amend",
  "rationale": "PO-10001 has a 4% quantity variance and a 1-day ETA variance, both within cited SOP thresholds for amendment. The PO value is £12,000, below the cited in-place amendment value threshold.",
  "citations": [
    "po_amendment_policy.md §3",
    "variance_detection_sop.md §2"
  ],
  "confidence": "high",
  "escalation_target_role": null
}
```

---

## 29. `WRITEUP.md` Requirements

Create a `WRITEUP.md` with these sections:

```md
# PO Exception Triage Agent

## Stack
TypeScript, Node.js, Express, Docker, Zod, OpenAI-compatible LLM provider.

## LLM Provider
State the chosen provider and model names.

## How to Run
Include local and Docker instructions.

## How to Run Evals
Include `npm run eval` or equivalent.

## Architecture
Explain SOLID, CQRS, QueryBuilder reads, command-handler writes, and event-sourced TriageCase.

## Why No Repository Pattern
Explain that reads use QueryBuilders and writes use command handlers/events.

## RAG Approach
Explain corpus generation, chunking, embeddings, vector search, and citation handling.

## Tool Use
Explain `get_po(po_id)` and optional `get_forecast(sku)`.

## Guardrails
Explain contradiction handling, PII protection, and low retrieval confidence escalation.

## Event Sourcing
Explain why TriageCase is event sourced and why POs/forecasts are not.

## Known Limitations
Mention mock data, local vector index, simple confidence scoring, prototype scope.

## AI Tooling Used
Mention Claude, ChatGPT, Cursor, Copilot, or other tooling if used.
```

---

## 30. Acceptance Criteria

The implementation is complete when all of the following are true:

```txt
1. The project uses TypeScript.
2. The app runs inside Docker.
3. There is no frontend.
4. POST /triage exists.
5. The system creates or includes the five required Markdown SOP files.
6. po_amendment_policy.md contains the deliberate threshold contradiction.
7. merch_escalation_matrix.md contains names and emails as a PII trap.
8. purchase_orders.json contains exactly 20 POs.
9. forecasts.json contains forecast-vs-actual data for the same POs/SKUs.
10. The system chunks, embeds, and indexes all five SOP files.
11. The agent retrieves SOP passages and includes citations in final responses.
12. get_po(po_id) is exposed as a model-callable tool.
13. The model can decide to call get_po.
14. The final response is a structured object, not prose.
15. The final response uses the exact recommendation action enum.
16. The final response uses confidence high | medium | low.
17. escalation_target_role is Senior Merch Planner, Head of Buying, or null.
18. Final responses never expose names or emails.
19. Contradictory SOP guidance triggers escalation.
20. Low retrieval confidence triggers escalation.
21. SOP silence triggers escalation.
22. At least three evals exist.
23. The straightforward amendment eval passes.
24. The escalation eval passes.
25. The contradiction eval passes.
26. Reads use QueryBuilder objects.
27. Writes use CommandHandlers.
28. TriageCase is event sourced.
29. TriageCase projections are eventually consistent.
30. No repository classes exist.
31. WRITEUP.md explains all important design choices.
```

---

## 31. Implementation Priorities

Prioritise in this order:

1. Assessment must-haves.
2. Correct structured output.
3. RAG citations.
4. `get_po(po_id)` tool use.
5. Guardrails.
6. Evals.
7. SOLID/CQRS/Event Sourcing architecture.
8. Optional `get_forecast(sku)` tool.
9. Polish.

Do not spend time on a frontend.

Do not add multiple optional stretch features. If implementing a stretch feature, choose only `get_forecast(sku)`.

---

## 32. Explicit Build Instruction for Claude

Implement the system described in this document.

Use the attached ASOS assessment as the source of truth where there is any conflict, but this document should be treated as the implementation-level specification.

Build a TypeScript, Dockerised PO Exception Triage Agent with:

- RAG over five Markdown SOPs.
- Required `get_po(po_id)` tool.
- Optional `get_forecast(sku)` tool.
- Express `/triage` endpoint.
- Structured recommendation output.
- SOP citations.
- Guardrails for contradiction/silence, PII, and low retrieval confidence.
- Three eval cases.
- SOLID design.
- CQRS.
- QueryBuilder reads.
- CommandHandler writes.
- Event-sourced `TriageCase`.
- Eventually consistent projection updates.
- No repository pattern.
- No frontend.

Where implementation details are ambiguous, choose the simplest approach that satisfies the assessment and keeps the architecture clean.

