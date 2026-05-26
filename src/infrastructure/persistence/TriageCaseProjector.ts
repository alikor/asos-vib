import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { existsSync } from "node:fs";
import { logger } from "../../shared/logger.js";
import type { TriageCaseEvent } from "../../domain/triage/TriageCaseEvent.js";
import type { TriageCaseState, TriageCaseStatus } from "../../domain/triage/TriageCaseState.js";

const STATUS_BY_EVENT: Record<TriageCaseEvent["type"], TriageCaseStatus> = {
  TriageCaseStarted: "started",
  SopContextRetrieved: "context_retrieved",
  ToolDataLoaded: "tool_data_loaded",
  RecommendationGenerated: "recommendation_generated",
  GuardrailsEvaluated: "guardrails_evaluated",
  TriageCaseCompleted: "completed",
  TriageCaseEscalated: "escalated",
  TriageCaseFailed: "failed"
};

export class TriageCaseProjector {
  constructor(private readonly filePath: string) {}

  async handle(event: TriageCaseEvent): Promise<void> {
    const projections = await this.load();
    const existing = projections[event.caseId];
    let next: TriageCaseState;
    if (event.type === "TriageCaseStarted") {
      next = {
        caseId: event.caseId,
        status: STATUS_BY_EVENT[event.type],
        question: event.payload.question,
        poId: event.payload.poId,
        retrievedCitations: [],
        createdAt: event.occurredAt,
        updatedAt: event.occurredAt
      };
    } else {
      if (!existing) {
        logger.warn("projector_missing_state", { caseId: event.caseId, type: event.type });
        return;
      }
      next = { ...existing, status: STATUS_BY_EVENT[event.type], updatedAt: event.occurredAt };
      switch (event.type) {
        case "SopContextRetrieved":
          next.retrievedCitations = Array.from(
            new Set([...existing.retrievedCitations, ...event.payload.citations])
          );
          break;
        case "RecommendationGenerated":
          next.recommendation = event.payload.recommendation;
          break;
        case "GuardrailsEvaluated":
          next.guardrailResults = event.payload.results;
          break;
        case "TriageCaseCompleted":
        case "TriageCaseEscalated":
          next.recommendation = event.payload.finalRecommendation;
          break;
        case "ToolDataLoaded":
        case "TriageCaseFailed":
          break;
      }
    }
    projections[event.caseId] = next;
    await this.save(projections);
  }

  async readAll(): Promise<TriageCaseState[]> {
    const projections = await this.load();
    return Object.values(projections);
  }

  private async load(): Promise<Record<string, TriageCaseState>> {
    if (!existsSync(this.filePath)) return {};
    const raw = await readFile(this.filePath, "utf-8");
    if (!raw.trim()) return {};
    return JSON.parse(raw) as Record<string, TriageCaseState>;
  }

  private async save(projections: Record<string, TriageCaseState>): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(projections, null, 2), "utf-8");
  }
}
