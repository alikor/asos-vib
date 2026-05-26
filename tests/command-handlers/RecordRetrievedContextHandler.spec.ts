import { rm } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RecordRetrievedContextCommand } from "../../src/application/commands/RecordRetrievedContextCommand.js";
import { RecordRetrievedContextHandler } from "../../src/application/command-handlers/RecordRetrievedContextHandler.js";
import type { SopContextRetrieved } from "../../src/domain/triage/TriageCaseEvent.js";
import {
  FakeEventBus,
  makeTempEventStore,
  nowIso,
  seedStartedCase,
  type TempStore
} from "./_helpers.js";

/**
 * RecordRetrievedContextHandler — records the SOP chunks returned by retrieval.
 *
 * Contract:
 *  - Requires an existing event stream; throws if rehydration is impossible.
 *  - Appends one SopContextRetrieved event whose payload preserves citations
 *    and per-citation scores verbatim.
 *  - Increments the stream version (no overwrites of earlier events).
 *  - Publishes the appended event to the EventBus.
 *  - Tolerates empty citations[] (orchestrator's "no chunks retrieved" path).
 */
describe("RecordRetrievedContextHandler", () => {
  let temp: TempStore;
  let bus: FakeEventBus;
  let handler: RecordRetrievedContextHandler;
  const caseId = "case-1";

  beforeEach(async () => {
    temp = await makeTempEventStore();
    bus = new FakeEventBus();
    handler = new RecordRetrievedContextHandler(temp.store, bus);
    await seedStartedCase(temp.store, bus, caseId);
  });

  afterEach(async () => {
    await rm(temp.dir, { recursive: true, force: true });
  });

  it("appends a SopContextRetrieved event with citations and scores", async () => {
    await handler.handle(
      new RecordRetrievedContextCommand(
        "cmd-2",
        nowIso(10),
        caseId,
        ["po_amendment_policy.md §3"],
        [{ citation: "po_amendment_policy.md §3", score: 0.91 }]
      )
    );

    const stream = await temp.store.readStream(caseId);
    expect(stream).toHaveLength(2);
    expect(stream[1]?.type).toBe("SopContextRetrieved");

    const retrieved = stream[1] as SopContextRetrieved;
    expect(retrieved.payload.citations).toEqual(["po_amendment_policy.md §3"]);
    expect(retrieved.payload.scores).toEqual([
      { citation: "po_amendment_policy.md §3", score: 0.91 }
    ]);
  });

  it("publishes the new event to the bus", async () => {
    await handler.handle(
      new RecordRetrievedContextCommand("cmd-2", nowIso(10), caseId, [], [])
    );
    expect(bus.published).toHaveLength(1);
    expect(bus.published[0]?.type).toBe("SopContextRetrieved");
  });

  it("preserves the start event when appending (no overwrite, version sequence is maintained)", async () => {
    await handler.handle(
      new RecordRetrievedContextCommand("cmd-2", nowIso(10), caseId, ["a §1"], [])
    );
    await handler.handle(
      new RecordRetrievedContextCommand("cmd-3", nowIso(20), caseId, ["b §1"], [])
    );

    const stream = await temp.store.readStream(caseId);
    expect(stream.map((e) => e.type)).toEqual([
      "TriageCaseStarted",
      "SopContextRetrieved",
      "SopContextRetrieved"
    ]);
  });

  it("accepts an empty citations array (still appends an event)", async () => {
    await handler.handle(
      new RecordRetrievedContextCommand("cmd-2", nowIso(10), caseId, [], [])
    );
    const [, retrieved] = await temp.store.readStream(caseId);
    expect((retrieved as SopContextRetrieved).payload.citations).toEqual([]);
    expect((retrieved as SopContextRetrieved).payload.scores).toEqual([]);
  });

  it("throws when no prior stream exists (cannot rehydrate)", async () => {
    await expect(
      handler.handle(
        new RecordRetrievedContextCommand("cmd-x", nowIso(), "case-missing", [], [])
      )
    ).rejects.toThrow();
  });
});
