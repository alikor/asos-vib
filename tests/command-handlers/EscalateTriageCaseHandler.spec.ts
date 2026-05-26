import { rm } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EscalateTriageCaseCommand } from "../../src/application/commands/EscalateTriageCaseCommand.js";
import { EscalateTriageCaseHandler } from "../../src/application/command-handlers/EscalateTriageCaseHandler.js";
import type { TriageCaseEscalated } from "../../src/domain/triage/TriageCaseEvent.js";
import {
  FakeEventBus,
  makeTempEventStore,
  nowIso,
  sampleRecommendation,
  seedStartedCase,
  type TempStore
} from "./_helpers.js";

/**
 * EscalateTriageCaseHandler — terminates a case when guardrails or policy require human review.
 *
 * Contract:
 *  - Requires an existing event stream; throws on missing rehydration.
 *  - Appends one TriageCaseEscalated event carrying the final (potentially
 *    guardrail-overridden) recommendation.
 *  - Publishes the event to the EventBus.
 *  - The carried recommendation is expected to have recommended_action = "escalate"
 *    and a non-null escalation_target_role, though this handler does not validate
 *    those fields itself — the schema and guardrails already do.
 */
describe("EscalateTriageCaseHandler", () => {
  let temp: TempStore;
  let bus: FakeEventBus;
  let handler: EscalateTriageCaseHandler;
  const caseId = "case-1";

  beforeEach(async () => {
    temp = await makeTempEventStore();
    bus = new FakeEventBus();
    handler = new EscalateTriageCaseHandler(temp.store, bus);
    await seedStartedCase(temp.store, bus, caseId);
  });

  afterEach(async () => {
    await rm(temp.dir, { recursive: true, force: true });
  });

  it("appends a TriageCaseEscalated event with the final recommendation", async () => {
    const recommendation = sampleRecommendation({
      recommended_action: "escalate",
      confidence: "low",
      escalation_target_role: "Head of Buying"
    });
    await handler.handle(
      new EscalateTriageCaseCommand("cmd-2", nowIso(10), caseId, recommendation)
    );

    const stream = await temp.store.readStream(caseId);
    expect(stream).toHaveLength(2);
    const event = stream[1] as TriageCaseEscalated;
    expect(event.type).toBe("TriageCaseEscalated");
    expect(event.payload.finalRecommendation).toEqual(recommendation);
  });

  it("preserves the escalation_target_role in the appended event", async () => {
    const recommendation = sampleRecommendation({
      recommended_action: "escalate",
      confidence: "low",
      escalation_target_role: "Senior Merch Planner"
    });
    await handler.handle(
      new EscalateTriageCaseCommand("cmd-2", nowIso(10), caseId, recommendation)
    );
    const [, event] = await temp.store.readStream(caseId);
    expect(
      (event as TriageCaseEscalated).payload.finalRecommendation.escalation_target_role
    ).toBe("Senior Merch Planner");
  });

  it("publishes the escalated event to the bus", async () => {
    await handler.handle(
      new EscalateTriageCaseCommand(
        "cmd-2",
        nowIso(10),
        caseId,
        sampleRecommendation({
          recommended_action: "escalate",
          confidence: "low",
          escalation_target_role: "Senior Merch Planner"
        })
      )
    );
    expect(bus.published).toHaveLength(1);
    expect(bus.published[0]?.type).toBe("TriageCaseEscalated");
  });

  it("throws when the case stream does not exist", async () => {
    await expect(
      handler.handle(
        new EscalateTriageCaseCommand(
          "cmd-x",
          nowIso(),
          "case-missing",
          sampleRecommendation({
            recommended_action: "escalate",
            confidence: "low",
            escalation_target_role: "Senior Merch Planner"
          })
        )
      )
    ).rejects.toThrow();
  });
});
