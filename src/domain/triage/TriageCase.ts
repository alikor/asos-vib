import type { GuardrailResult, TriageRecommendation } from "./Recommendation.js";
import type { TriageCaseState, TriageCaseStatus } from "./TriageCaseState.js";
import type { TriageCaseEvent } from "./TriageCaseEvent.js";

const NEXT_STATUS: Record<TriageCaseEvent["type"], TriageCaseStatus> = {
  TriageCaseStarted: "started",
  SopContextRetrieved: "context_retrieved",
  ToolDataLoaded: "tool_data_loaded",
  RecommendationGenerated: "recommendation_generated",
  GuardrailsEvaluated: "guardrails_evaluated",
  TriageCaseCompleted: "completed",
  TriageCaseEscalated: "escalated",
  TriageCaseFailed: "failed"
};

export class TriageCase {
  private state?: TriageCaseState;
  private uncommittedEvents: TriageCaseEvent[] = [];

  private constructor() {}

  static start(input: {
    caseId: string;
    question: string;
    poId?: string;
    occurredAt: string;
  }): TriageCase {
    const aggregate = new TriageCase();
    const event: TriageCaseEvent = {
      type: "TriageCaseStarted",
      caseId: input.caseId,
      occurredAt: input.occurredAt,
      payload: { question: input.question, poId: input.poId }
    };
    aggregate.apply(event);
    aggregate.uncommittedEvents.push(event);
    return aggregate;
  }

  static rehydrate(events: TriageCaseEvent[]): TriageCase {
    if (events.length === 0) {
      throw new Error("Cannot rehydrate TriageCase from empty event stream");
    }
    const aggregate = new TriageCase();
    for (const event of events) aggregate.apply(event);
    return aggregate;
  }

  recordContextRetrieved(input: {
    citations: string[];
    scores: Array<{ citation: string; score: number }>;
    occurredAt: string;
  }): void {
    const event: TriageCaseEvent = {
      type: "SopContextRetrieved",
      caseId: this.requireState().caseId,
      occurredAt: input.occurredAt,
      payload: { citations: input.citations, scores: input.scores }
    };
    this.applyAndStage(event);
  }

  recordToolDataLoaded(input: {
    toolName: string;
    output: unknown;
    occurredAt: string;
  }): void {
    const event: TriageCaseEvent = {
      type: "ToolDataLoaded",
      caseId: this.requireState().caseId,
      occurredAt: input.occurredAt,
      payload: { toolName: input.toolName, output: input.output }
    };
    this.applyAndStage(event);
  }

  recordRecommendationGenerated(input: {
    recommendation: TriageRecommendation;
    occurredAt: string;
  }): void {
    const event: TriageCaseEvent = {
      type: "RecommendationGenerated",
      caseId: this.requireState().caseId,
      occurredAt: input.occurredAt,
      payload: { recommendation: input.recommendation }
    };
    this.applyAndStage(event);
  }

  recordGuardrailsEvaluated(input: {
    results: GuardrailResult[];
    occurredAt: string;
  }): void {
    const event: TriageCaseEvent = {
      type: "GuardrailsEvaluated",
      caseId: this.requireState().caseId,
      occurredAt: input.occurredAt,
      payload: { results: input.results }
    };
    this.applyAndStage(event);
  }

  complete(input: { finalRecommendation: TriageRecommendation; occurredAt: string }): void {
    const event: TriageCaseEvent = {
      type: "TriageCaseCompleted",
      caseId: this.requireState().caseId,
      occurredAt: input.occurredAt,
      payload: { finalRecommendation: input.finalRecommendation }
    };
    this.applyAndStage(event);
  }

  escalate(input: { finalRecommendation: TriageRecommendation; occurredAt: string }): void {
    const event: TriageCaseEvent = {
      type: "TriageCaseEscalated",
      caseId: this.requireState().caseId,
      occurredAt: input.occurredAt,
      payload: { finalRecommendation: input.finalRecommendation }
    };
    this.applyAndStage(event);
  }

  fail(input: { reason: string; occurredAt: string }): void {
    const event: TriageCaseEvent = {
      type: "TriageCaseFailed",
      caseId: this.requireState().caseId,
      occurredAt: input.occurredAt,
      payload: { reason: input.reason }
    };
    this.applyAndStage(event);
  }

  apply(event: TriageCaseEvent): void {
    if (event.type === "TriageCaseStarted") {
      this.state = {
        caseId: event.caseId,
        status: NEXT_STATUS[event.type],
        question: event.payload.question,
        poId: event.payload.poId,
        retrievedCitations: [],
        createdAt: event.occurredAt,
        updatedAt: event.occurredAt
      };
      return;
    }
    const current = this.requireState();
    const next: TriageCaseState = {
      ...current,
      status: NEXT_STATUS[event.type],
      updatedAt: event.occurredAt
    };
    switch (event.type) {
      case "SopContextRetrieved":
        next.retrievedCitations = [
          ...new Set([...current.retrievedCitations, ...event.payload.citations])
        ];
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
    this.state = next;
  }

  pullUncommittedEvents(): TriageCaseEvent[] {
    const events = this.uncommittedEvents;
    this.uncommittedEvents = [];
    return events;
  }

  getState(): TriageCaseState {
    return this.requireState();
  }

  private applyAndStage(event: TriageCaseEvent): void {
    this.apply(event);
    this.uncommittedEvents.push(event);
  }

  private requireState(): TriageCaseState {
    if (!this.state) throw new Error("TriageCase has no state — start or rehydrate first");
    return this.state;
  }
}
