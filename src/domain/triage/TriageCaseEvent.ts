import type { GuardrailResult, TriageRecommendation } from "./Recommendation.js";

export type TriageCaseStarted = {
  type: "TriageCaseStarted";
  caseId: string;
  occurredAt: string;
  payload: {
    question: string;
    poId?: string;
  };
};

export type SopContextRetrieved = {
  type: "SopContextRetrieved";
  caseId: string;
  occurredAt: string;
  payload: {
    citations: string[];
    scores: Array<{ citation: string; score: number }>;
  };
};

export type ToolDataLoaded = {
  type: "ToolDataLoaded";
  caseId: string;
  occurredAt: string;
  payload: {
    toolName: string;
    output: unknown;
  };
};

export type RecommendationGenerated = {
  type: "RecommendationGenerated";
  caseId: string;
  occurredAt: string;
  payload: {
    recommendation: TriageRecommendation;
  };
};

export type GuardrailsEvaluated = {
  type: "GuardrailsEvaluated";
  caseId: string;
  occurredAt: string;
  payload: {
    results: GuardrailResult[];
  };
};

export type TriageCaseCompleted = {
  type: "TriageCaseCompleted";
  caseId: string;
  occurredAt: string;
  payload: {
    finalRecommendation: TriageRecommendation;
  };
};

export type TriageCaseEscalated = {
  type: "TriageCaseEscalated";
  caseId: string;
  occurredAt: string;
  payload: {
    finalRecommendation: TriageRecommendation;
  };
};

export type TriageCaseFailed = {
  type: "TriageCaseFailed";
  caseId: string;
  occurredAt: string;
  payload: {
    reason: string;
  };
};

export type TriageCaseEvent =
  | TriageCaseStarted
  | SopContextRetrieved
  | ToolDataLoaded
  | RecommendationGenerated
  | GuardrailsEvaluated
  | TriageCaseCompleted
  | TriageCaseEscalated
  | TriageCaseFailed;
