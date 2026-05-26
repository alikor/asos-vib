import type { Command } from "./Command.js";

export class RecordToolDataLoadedCommand implements Command {
  constructor(
    public readonly commandId: string,
    public readonly occurredAt: string,
    public readonly caseId: string,
    public readonly toolName: string,
    public readonly output: unknown
  ) {}
}
