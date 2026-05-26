import type { Command } from "./Command.js";

export class RecordRetrievedContextCommand implements Command {
  constructor(
    public readonly commandId: string,
    public readonly occurredAt: string,
    public readonly caseId: string,
    public readonly citations: string[],
    public readonly scores: Array<{ citation: string; score: number }>
  ) {}
}
