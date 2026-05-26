import { rm } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RecordGuardrailsEvaluatedCommand } from "../../src/application/commands/RecordGuardrailsEvaluatedCommand.js";
import { RecordGuardrailsEvaluatedHandler } from "../../src/application/command-handlers/RecordGuardrailsEvaluatedHandler.js";
import type { GuardrailsEvaluated } from "../../src/domain/triage/TriageCaseEvent.js";
import {
  FakeEventBus,
  makeTempEventStore,
  nowIso,
  sampleGuardrailResults,
  seedStartedCase,
  type TempStore
} from "./_helpers.js";

/**
 * RecordGuardrailsEvaluatedHandler — records the outcome of the guardrail chain.
 *
 * Contract:
 *  - Requires an existing event stream; throws on missing rehydration.
 *  - Appends one GuardrailsEvaluated event whose payload preserves the full
 *    results[] array, including blocking flags, reasons, and overrides.
 *  - Publishes the event to the EventBus.
 */
describe("RecordGuardrailsEvaluatedHandler", () => {
  let temp: TempStore;
  let bus: FakeEventBus;
  let handler: RecordGuardrailsEvaluatedHandler;
  const caseId = "case-1";

  beforeEach(async () => {
    temp = await makeTempEventStore();
    bus = new FakeEventBus();
    handler = new RecordGuardrailsEvaluatedHandler(temp.store, bus);
    await seedStartedCase(temp.store, bus, caseId);
  });

  afterEach(async () => {
    await rm(temp.dir, { recursive: true, force: true });
  });

  it("appends a GuardrailsEvaluated event with the full results array", async () => {
    const results = sampleGuardrailResults();
    await handler.handle(
      new RecordGuardrailsEvaluatedCommand("cmd-2", nowIso(10), caseId, results)
    );

    const stream = await temp.store.readStream(caseId);
    expect(stream).toHaveLength(2);
    const event = stream[1] as GuardrailsEvaluated;
    expect(event.type).toBe("GuardrailsEvaluated");
    expect(event.payload.results).toEqual(results);
  });

  it("preserves blocking entries including reason and override fields", async () => {
    const results = sampleGuardrailResults();
    await handler.handle(
      new RecordGuardrailsEvaluatedCommand("cmd-2", nowIso(10), caseId, results)
    );

    const [, event] = await temp.store.readStream(caseId);
    const blocking = (event as GuardrailsEvaluated).payload.results.find(
      (r) => !r.passed
    );
    expect(blocking?.severity).toBe("blocking");
    expect(blocking?.reason).toBe("demo contradiction");
    expect(blocking?.override?.recommended_action).toBe("escalate");
  });

  it("supports an empty results array (no guardrails fired)", async () => {
    await handler.handle(
      new RecordGuardrailsEvaluatedCommand("cmd-2", nowIso(10), caseId, [])
    );
    const [, event] = await temp.store.readStream(caseId);
    expect((event as GuardrailsEvaluated).payload.results).toEqual([]);
  });

  it("publishes the event to the bus", async () => {
    await handler.handle(
      new RecordGuardrailsEvaluatedCommand("cmd-2", nowIso(10), caseId, sampleGuardrailResults())
    );
    expect(bus.published).toHaveLength(1);
    expect(bus.published[0]?.type).toBe("GuardrailsEvaluated");
  });

  it("throws when the case stream does not exist", async () => {
    await expect(
      handler.handle(
        new RecordGuardrailsEvaluatedCommand("cmd-x", nowIso(), "case-missing", [])
      )
    ).rejects.toThrow();
  });
});
