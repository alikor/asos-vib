# PO Exception Triage Agent Build Rules

This project must fully implement `docs/implementation-spec.md`.

The implementation must satisfy the ASOS PO Exception Triage Agent assessment.

Non-negotiable rules:

- Use TypeScript.
- Use Node.js 22.
- Use Express.
- Use Docker and docker-compose.
- No frontend.
- Minimal interface only: POST /triage and optional GET /health.
- Build the five SOP Markdown files in corpus/.
- Build purchase_orders.json with exactly 20 POs.
- Build forecasts.json for the same POs/SKUs.
- Implement RAG over the five SOP files.
- Expose get_po(po_id) as a model-callable tool.
- Optional second tool: get_forecast.
- Return the exact structured recommendation object.
- Implement guardrails for:
  - SOP contradiction or silence.
  - PII non-disclosure.
  - Low retrieval confidence.
- Implement at least three eval cases:
  - straightforward amendment,
  - escalation,
  - contradiction.
- Use SOLID principles.
- Use CQRS.
- Reads must use QueryBuilder objects.
- Writes must use CommandHandlers.
- Do not create repository classes.
- Event-source only the TriageCase state machine.
- Use eventually consistent projections for TriageCase.
- Include WRITEUP.md.
- Prefer pnpm unless blocked.
- Keep the implementation simple enough to complete; do not add unnecessary optional features.
- If the assessment and implementation spec conflict, follow the assessment.
- Do not ask me whether to build a UI. There must be no UI.
- Continue until the project builds, tests pass, evals pass, and Docker runs.

Required verification commands:

pnpm build
pnpm test
pnpm eval
docker compose build
docker compose up
