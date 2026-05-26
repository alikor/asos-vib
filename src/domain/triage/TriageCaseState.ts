import type { GuardrailResult, TriageRecommendation } from "./Recommendation.js";

export type TriageCaseStatus =
  | "started"
  | "context_retrieved"
  | "tool_data_loaded"
  | "recommendation_generated"
  | "guardrails_evaluated"
  | "completed"
  | "escalated"
  | "failed";

export type TriageCaseState = {
  caseId: string;
  status: TriageCaseStatus;
  question: string;
  poId?: string;
  retrievedCitations: string[];
  recommendation?: TriageRecommendation;
  guardrailResults?: GuardrailResult[];
  createdAt: string;
  updatedAt: string;
};
