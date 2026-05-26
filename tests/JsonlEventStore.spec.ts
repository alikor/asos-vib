import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { JsonlEventStore } from "../src/infrastructure/persistence/JsonlEventStore.js";
import { ConcurrencyError } from "../src/shared/errors.js";
import type { TriageCaseEvent } from "../src/domain/triage/TriageCaseEvent.js";

let dir: string;
let store: JsonlEventStore;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "evstore-"));
  store = new JsonlEventStore(join(dir, "events.jsonl"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const startEvent = (caseId: string, at: string): TriageCaseEvent => ({
  type: "TriageCaseStarted",
  caseId,
  occurredAt: at,
  payload: { question: "q" }
});

describe("JsonlEventStore", () => {
  it("appends and reads back a stream", async () => {
    await store.append("case-1", 0, [startEvent("case-1", "2026-01-01T00:00:00.000Z")]);
    const events = await store.readStream("case-1");
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("TriageCaseStarted");
  });

  it("throws on concurrency conflict", async () => {
    await store.append("case-1", 0, [startEvent("case-1", "2026-01-01T00:00:00.000Z")]);
    await expect(
      store.append("case-1", 0, [startEvent("case-1", "2026-01-01T00:00:01.000Z")])
    ).rejects.toBeInstanceOf(ConcurrencyError);
  });

  it("isolates streams by streamId", async () => {
    await store.append("case-1", 0, [startEvent("case-1", "2026-01-01T00:00:00.000Z")]);
    await store.append("case-2", 0, [startEvent("case-2", "2026-01-01T00:00:01.000Z")]);
    const a = await store.readStream("case-1");
    const b = await store.readStream("case-2");
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    expect(a[0]?.caseId).toBe("case-1");
    expect(b[0]?.caseId).toBe("case-2");
  });
});
