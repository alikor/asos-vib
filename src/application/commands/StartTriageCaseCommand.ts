import type { Command } from "./Command.js";

export class StartTriageCaseCommand implements Command {
  constructor(
    public readonly commandId: string,
    public readonly occurredAt: string,
    public readonly caseId: string,
    public readonly question: string,
    public readonly poId?: string
  ) {}
}
