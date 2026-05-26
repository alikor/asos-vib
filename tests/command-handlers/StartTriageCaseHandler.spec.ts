import { rm } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { StartTriageCaseCommand } from "../../src/application/commands/StartTriageCaseCommand.js";
import { StartTriageCaseHandler } from "../../src/application/command-handlers/StartTriageCaseHandler.js";
import { ConcurrencyError } from "../../src/shared/errors.js";
import type { TriageCaseStarted } from "../../src/domain/triage/TriageCaseEvent.js";
import { FakeEventBus, makeTempEventStore, nowIso, type TempStore } from "./_helpers.js";

/**
 * StartTriageCaseHandler — opens a new event-sourced TriageCase.
 *
 * Contract:
 *  - Treats the case stream as empty (version 0) when it appends.
 *  - Appends exactly one TriageCaseStarted event whose payload mirrors the command.
 *  - Publishes that event to the EventBus exactly once.
 *  - Rejects re-starting an existing case with ConcurrencyError.
 */
describe("StartTriageCaseHandler", () => {
  let temp: TempStore;
  let bus: FakeEventBus;
  let handler: StartTriageCaseHandler;

  beforeEach(async () => {
    temp = await makeTempEventStore();
    bus = new FakeEventBus();
    handler = new StartTriageCaseHandler(temp.store, bus);
  });

  afterEach(async () => {
    await rm(temp.dir, { recursive: true, force: true });
  });

  it("appends exactly one TriageCaseStarted event at version 1", async () => {
    await handler.handle(
      new StartTriageCaseCommand(
        "cmd-1",
        nowIso(),
        "case-1",
        "Triage PO-10001",
        "PO-10001"
      )
    );

    const stream = await temp.store.readStream("case-1");
    expect(stream).toHaveLength(1);
    expect(stream[0]?.type).toBe("TriageCaseStarted");
  });

  it("copies the command's question and poId into the event payload", async () => {
    await handler.handle(
      new StartTriageCaseCommand(
        "cmd-1",
        nowIso(),
        "case-1",
        "Triage PO-10001",
        "PO-10001"
      )
    );

    const [event] = await temp.store.readStream("case-1");
    const started = event as TriageCaseStarted;
    expect(started.payload).toEqual({ question: "Triage PO-10001", poId: "PO-10001" });
    expect(started.caseId).toBe("case-1");
    expect(started.occurredAt).toBe(nowIso());
  });

  it("supports questions without a poId (poId is optional)", async () => {
    await handler.handle(
      new StartTriageCaseCommand("cmd-1", nowIso(), "case-1", "General question")
    );

    const [event] = await temp.store.readStream("case-1");
    const started = event as TriageCaseStarted;
    expect(started.payload.poId).toBeUndefined();
    expect(started.payload.question).toBe("General question");
  });

  it("publishes the started event to the event bus exactly once", async () => {
    await handler.handle(
      new StartTriageCaseCommand("cmd-1", nowIso(), "case-1", "q", "PO-10001")
    );

    expect(bus.published).toHaveLength(1);
    expect(bus.published[0]?.type).toBe("TriageCaseStarted");
    expect(bus.published[0]?.caseId).toBe("case-1");
  });

  it("rejects starting the same case twice with ConcurrencyError", async () => {
    await handler.handle(
      new StartTriageCaseCommand("cmd-1", nowIso(0), "case-1", "q", "PO-10001")
    );
    await expect(
      handler.handle(
        new StartTriageCaseCommand("cmd-2", nowIso(1), "case-1", "q", "PO-10001")
      )
    ).rejects.toBeInstanceOf(ConcurrencyError);
  });

  it("isolates streams by caseId — two different cases coexist", async () => {
    await handler.handle(
      new StartTriageCaseCommand("cmd-1", nowIso(0), "case-A", "qA", "PO-A")
    );
    await handler.handle(
      new StartTriageCaseCommand("cmd-2", nowIso(1), "case-B", "qB", "PO-B")
    );

    expect(await temp.store.readStream("case-A")).toHaveLength(1);
    expect(await temp.store.readStream("case-B")).toHaveLength(1);
    expect(bus.published).toHaveLength(2);
    expect(bus.published.map((e) => e.caseId)).toEqual(["case-A", "case-B"]);
  });
});
