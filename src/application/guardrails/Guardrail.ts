import type { Forecast } from "../../domain/purchase-orders/Forecast.js";
import type { PurchaseOrder } from "../../domain/purchase-orders/PurchaseOrder.js";
import type { PolicyChunkSearchResult } from "../../domain/rag/PolicyChunk.js";
import type {
  GuardrailResult,
  TriageRecommendation,
  VarianceSummary
} from "../../domain/triage/Recommendation.js";

export type GuardrailContext = {
  question: string;
  recommendation: TriageRecommendation;
  retrievedChunks: PolicyChunkSearchResult[];
  retrievedCitations: string[];
  po?: PurchaseOrder;
  forecast?: Forecast[];
  varianceSummary?: VarianceSummary;
  minScore: number;
};

export interface Guardrail {
  readonly name: string;
  evaluate(context: GuardrailContext): Promise<GuardrailResult> | GuardrailResult;
}
