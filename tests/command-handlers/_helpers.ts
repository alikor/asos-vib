import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StartTriageCaseCommand } from "../../src/application/commands/StartTriageCaseCommand.js";
import { StartTriageCaseHandler } from "../../src/application/command-handlers/StartTriageCaseHandler.js";
import type {
  GuardrailResult,
  TriageRecommendation
} from "../../src/domain/triage/Recommendation.js";
import type { TriageCaseEvent } from "../../src/domain/triage/TriageCaseEvent.js";
import type { EventBus } from "../../src/infrastructure/persistence/InProcessEventBus.js";
import { JsonlEventStore } from "../../src/infrastructure/persistence/JsonlEventStore.js";

export type TempStore = {
  store: JsonlEventStore;
  dir: string;
};

export const makeTempEventStore = async (): Promise<TempStore> => {
  const dir = await mkdtemp(join(tmpdir(), "handler-"));
  const store = new JsonlEventStore(join(dir, "events.jsonl"));
  return { store, dir };
};

export class FakeEventBus implements EventBus {
  public readonly published: TriageCaseEvent[] = [];

  subscribe(): void {
    // No-op: handler tests inspect `published`, not subscribers.
  }

  async publish(events: TriageCaseEvent[]): Promise<void> {
    for (const event of events) this.published.push(event);
  }
}

export const nowIso = (offsetMs = 0): string =>
  new Date(Date.UTC(2026, 0, 1, 0, 0, 0, offsetMs)).toISOString();

export const sampleRecommendation = (
  overrides: Partial<TriageRecommendation> = {}
): TriageRecommendation => ({
  po_id: "PO-10001",
  recommended_action: "amend",
  rationale: "Within thresholds.",
  citations: ["po_amendment_policy.md §3", "variance_detection_sop.md §2"],
  confidence: "high",
  escalation_target_role: null,
  ...overrides
});

export const sampleGuardrailResults = (): GuardrailResult[] => [
  { name: "PiiGuardrail", passed: true, severity: "non_blocking" },
  {
    name: "RetrievalConfidenceGuardrail",
    passed: true,
    severity: "non_blocking"
  },
  {
    name: "ContradictionGuardrail",
    passed: false,
    severity: "blocking",
    reason: "demo contradiction",
    override: { recommended_action: "escalate", confidence: "low" }
  }
];

export const seedStartedCase = async (
  store: JsonlEventStore,
  bus: FakeEventBus,
  caseId: string,
  options: { question?: string; poId?: string; occurredAt?: string } = {}
): Promise<void> => {
  const handler = new StartTriageCaseHandler(store, bus);
  await handler.handle(
    new StartTriageCaseCommand(
      `cmd-start-${caseId}`,
      options.occurredAt ?? nowIso(0),
      caseId,
      options.question ?? "Triage PO-10001",
      options.poId ?? "PO-10001"
    )
  );
  // Clear the start event so tests assert only on events their handler produced.
  bus.published.length = 0;
};
