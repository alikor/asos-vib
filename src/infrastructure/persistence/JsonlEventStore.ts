import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { existsSync } from "node:fs";
import { ConcurrencyError } from "../../shared/errors.js";
import type { TriageCaseEvent } from "../../domain/triage/TriageCaseEvent.js";

export interface EventStore {
  append(streamId: string, expectedVersion: number, events: TriageCaseEvent[]): Promise<void>;
  readStream(streamId: string): Promise<TriageCaseEvent[]>;
}

type StoredEvent = {
  streamId: string;
  version: number;
  type: TriageCaseEvent["type"];
  occurredAt: string;
  payload: unknown;
  caseId: string;
};

export class JsonlEventStore implements EventStore {
  constructor(private readonly filePath: string) {}

  async append(
    streamId: string,
    expectedVersion: number,
    events: TriageCaseEvent[]
  ): Promise<void> {
    if (events.length === 0) return;
    const stream = await this.readRawStream(streamId);
    if (stream.length !== expectedVersion) {
      throw new ConcurrencyError(streamId, expectedVersion, stream.length);
    }
    await mkdir(dirname(this.filePath), { recursive: true });
    const lines = events
      .map((event, index): StoredEvent => ({
        streamId,
        version: expectedVersion + index + 1,
        type: event.type,
        occurredAt: event.occurredAt,
        caseId: event.caseId,
        payload: (event as { payload: unknown }).payload
      }))
      .map((record) => JSON.stringify(record))
      .join("\n");
    await appendFile(this.filePath, `${lines}\n`, "utf-8");
  }

  async readStream(streamId: string): Promise<TriageCaseEvent[]> {
    const raw = await this.readRawStream(streamId);
    return raw.map((record) => ({
      type: record.type,
      caseId: record.caseId,
      occurredAt: record.occurredAt,
      payload: record.payload
    }) as TriageCaseEvent);
  }

  private async readRawStream(streamId: string): Promise<StoredEvent[]> {
    if (!existsSync(this.filePath)) return [];
    const raw = await readFile(this.filePath, "utf-8");
    const records: StoredEvent[] = [];
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const record = JSON.parse(trimmed) as StoredEvent;
      if (record.streamId === streamId) records.push(record);
    }
    records.sort((a, b) => a.version - b.version);
    return records;
  }
}
