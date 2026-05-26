import { rm } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RecordRecommendationGeneratedCommand } from "../../src/application/commands/RecordRecommendationGeneratedCommand.js";
import { RecordRecommendationGeneratedHandler } from "../../src/application/command-handlers/RecordRecommendationGeneratedHandler.js";
import type { RecommendationGenerated } from "../../src/domain/triage/TriageCaseEvent.js";
import {
  FakeEventBus,
  makeTempEventStore,
  nowIso,
  sampleRecommendation,
  seedStartedCase,
  type TempStore
} from "./_helpers.js";

/**
 * RecordRecommendationGeneratedHandler — records the LLM's structured recommendation.
 *
 * Contract:
 *  - Requires an existing event stream; throws on missing rehydration.
 *  - Appends one RecommendationGenerated event whose payload is the full
 *    TriageRecommendation, untouched.
 *  - Publishes the new event to the EventBus.
 */
describe("RecordRecommendationGeneratedHandler", () => {
  let temp: TempStore;
  let bus: FakeEventBus;
  let handler: RecordRecommendationGeneratedHandler;
  const caseId = "case-1";

  beforeEach(async () => {
    temp = await makeTempEventStore();
    bus = new FakeEventBus();
    handler = new RecordRecommendationGeneratedHandler(temp.store, bus);
    await seedStartedCase(temp.store, bus, caseId);
  });

  afterEach(async () => {
    await rm(temp.dir, { recursive: true, force: true });
  });

  it("appends a RecommendationGenerated event carrying the full recommendation", async () => {
    const recommendation = sampleRecommendation({
      recommended_action: "amend",
      confidence: "high"
    });
    await handler.handle(
      new RecordRecommendationGeneratedCommand("cmd-2", nowIso(10), caseId, recommendation)
    );

    const stream = await temp.store.readStream(caseId);
    expect(stream).toHaveLength(2);
    const event = stream[1] as RecommendationGenerated;
    expect(event.type).toBe("RecommendationGenerated");
    expect(event.payload.recommendation).toEqual(recommendation);
  });

  it("preserves escalation_target_role when set", async () => {
    const recommendation = sampleRecommendation({
      recommended_action: "escalate",
      escalation_target_role: "Head of Buying",
      confidence: "low"
    });
    await handler.handle(
      new RecordRecommendationGeneratedCommand("cmd-2", nowIso(10), caseId, recommendation)
    );
    const [, event] = await temp.store.readStream(caseId);
    expect((event as RecommendationGenerated).payload.recommendation.escalation_target_role).toBe(
      "Head of Buying"
    );
  });

  it("publishes the recommendation event to the bus", async () => {
    await handler.handle(
      new RecordRecommendationGeneratedCommand(
        "cmd-2",
        nowIso(10),
        caseId,
        sampleRecommendation()
      )
    );
    expect(bus.published).toHaveLength(1);
    expect(bus.published[0]?.type).toBe("RecommendationGenerated");
  });

  it("throws when the case stream does not exist", async () => {
    await expect(
      handler.handle(
        new RecordRecommendationGeneratedCommand(
          "cmd-x",
          nowIso(),
          "case-missing",
          sampleRecommendation()
        )
      )
    ).rejects.toThrow();
  });
});
