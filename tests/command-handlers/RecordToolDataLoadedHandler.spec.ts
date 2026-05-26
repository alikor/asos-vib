import { rm } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RecordToolDataLoadedCommand } from "../../src/application/commands/RecordToolDataLoadedCommand.js";
import { RecordToolDataLoadedHandler } from "../../src/application/command-handlers/RecordToolDataLoadedHandler.js";
import type { ToolDataLoaded } from "../../src/domain/triage/TriageCaseEvent.js";
import {
  FakeEventBus,
  makeTempEventStore,
  nowIso,
  seedStartedCase,
  type TempStore
} from "./_helpers.js";

/**
 * RecordToolDataLoadedHandler — records the output of a single agent tool call.
 *
 * Contract:
 *  - Requires an existing event stream; throws on missing rehydration.
 *  - Appends one ToolDataLoaded event preserving toolName and output verbatim.
 *  - Supports multiple invocations: each call produces a new event without
 *    mutating earlier ones.
 *  - Publishes each new event to the EventBus.
 */
describe("RecordToolDataLoadedHandler", () => {
  let temp: TempStore;
  let bus: FakeEventBus;
  let handler: RecordToolDataLoadedHandler;
  const caseId = "case-1";

  beforeEach(async () => {
    temp = await makeTempEventStore();
    bus = new FakeEventBus();
    handler = new RecordToolDataLoadedHandler(temp.store, bus);
    await seedStartedCase(temp.store, bus, caseId);
  });

  afterEach(async () => {
    await rm(temp.dir, { recursive: true, force: true });
  });

  it("appends a ToolDataLoaded event with the supplied toolName and output", async () => {
    const output = { found: true, po: { po_id: "PO-10001", value_gbp: 12000 } };
    await handler.handle(
      new RecordToolDataLoadedCommand("cmd-2", nowIso(10), caseId, "get_po", output)
    );

    const stream = await temp.store.readStream(caseId);
    expect(stream).toHaveLength(2);
    const event = stream[1] as ToolDataLoaded;
    expect(event.type).toBe("ToolDataLoaded");
    expect(event.payload.toolName).toBe("get_po");
    expect(event.payload.output).toEqual(output);
  });

  it("preserves output verbatim, including nested objects and arrays", async () => {
    const output = {
      forecasts: [{ sku: "X", actual_qty: 10 }, { sku: "Y", actual_qty: 0 }]
    };
    await handler.handle(
      new RecordToolDataLoadedCommand("cmd-2", nowIso(10), caseId, "get_forecast", output)
    );

    const [, event] = await temp.store.readStream(caseId);
    expect((event as ToolDataLoaded).payload.output).toEqual(output);
  });

  it("supports multiple invocations — each call adds one new event in order", async () => {
    await handler.handle(
      new RecordToolDataLoadedCommand("cmd-a", nowIso(10), caseId, "get_po", { found: true })
    );
    await handler.handle(
      new RecordToolDataLoadedCommand("cmd-b", nowIso(20), caseId, "get_forecast", {
        found: true
      })
    );

    const stream = await temp.store.readStream(caseId);
    expect(stream.map((e) => e.type)).toEqual([
      "TriageCaseStarted",
      "ToolDataLoaded",
      "ToolDataLoaded"
    ]);
    expect((stream[1] as ToolDataLoaded).payload.toolName).toBe("get_po");
    expect((stream[2] as ToolDataLoaded).payload.toolName).toBe("get_forecast");
  });

  it("publishes each new event to the event bus", async () => {
    await handler.handle(
      new RecordToolDataLoadedCommand("cmd-a", nowIso(10), caseId, "get_po", {})
    );
    await handler.handle(
      new RecordToolDataLoadedCommand("cmd-b", nowIso(20), caseId, "get_forecast", {})
    );
    expect(bus.published.map((e) => e.type)).toEqual(["ToolDataLoaded", "ToolDataLoaded"]);
  });

  it("throws when the case stream does not exist", async () => {
    await expect(
      handler.handle(
        new RecordToolDataLoadedCommand("cmd-x", nowIso(), "case-missing", "get_po", {})
      )
    ).rejects.toThrow();
  });
});
