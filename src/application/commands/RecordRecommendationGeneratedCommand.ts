import type { TriageRecommendation } from "../../domain/triage/Recommendation.js";
import type { Command } from "./Command.js";

export class RecordRecommendationGeneratedCommand implements Command {
  constructor(
    public readonly commandId: string,
    public readonly occurredAt: string,
    public readonly caseId: string,
    public readonly recommendation: TriageRecommendation
  ) {}
}
