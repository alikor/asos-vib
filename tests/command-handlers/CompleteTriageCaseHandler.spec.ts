import { rm } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CompleteTriageCaseCommand } from "../../src/application/commands/CompleteTriageCaseCommand.js";
import { CompleteTriageCaseHandler } from "../../src/application/command-handlers/CompleteTriageCaseHandler.js";
import type { TriageCaseCompleted } from "../../src/domain/triage/TriageCaseEvent.js";
import {
  FakeEventBus,
  makeTempEventStore,
  nowIso,
  sampleRecommendation,
  seedStartedCase,
  type TempStore
} from "./_helpers.js";

/**
 * CompleteTriageCaseHandler — terminates a case on the happy path with a final recommendation.
 *
 * Contract:
 *  - Requires an existing event stream; throws on missing rehydration.
 *  - Appends one TriageCaseCompleted event carrying the final recommendation.
 *  - Publishes the event to the EventBus.
 *  - Is the terminal event on the happy path (state machine: completed).
 */
describe("CompleteTriageCaseHandler", () => {
  let temp: TempStore;
  let bus: FakeEventBus;
  let handler: CompleteTriageCaseHandler;
  const caseId = "case-1";

  beforeEach(async () => {
    temp = await makeTempEventStore();
    bus = new FakeEventBus();
    handler = new CompleteTriageCaseHandler(temp.store, bus);
    await seedStartedCase(temp.store, bus, caseId);
  });

  afterEach(async () => {
    await rm(temp.dir, { recursive: true, force: true });
  });

  it("appends a TriageCaseCompleted event with the final recommendation", async () => {
    const recommendation = sampleRecommendation({ recommended_action: "amend" });
    await handler.handle(
      new CompleteTriageCaseCommand("cmd-2", nowIso(10), caseId, recommendation)
    );

    const stream = await temp.store.readStream(caseId);
    expect(stream).toHaveLength(2);
    const event = stream[1] as TriageCaseCompleted;
    expect(event.type).toBe("TriageCaseCompleted");
    expect(event.payload.finalRecommendation).toEqual(recommendation);
  });

  it("publishes the completed event to the bus", async () => {
    await handler.handle(
      new CompleteTriageCaseCommand("cmd-2", nowIso(10), caseId, sampleRecommendation())
    );
    expect(bus.published).toHaveLength(1);
    expect(bus.published[0]?.type).toBe("TriageCaseCompleted");
  });

  it("throws when the case stream does not exist", async () => {
    await expect(
      handler.handle(
        new CompleteTriageCaseCommand(
          "cmd-x",
          nowIso(),
          "case-missing",
          sampleRecommendation()
        )
      )
    ).rejects.toThrow();
  });
});
