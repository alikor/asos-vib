import type { GuardrailResult } from "../../domain/triage/Recommendation.js";
import type { Guardrail, GuardrailContext } from "./Guardrail.js";

const SECTION_3 = "po_amendment_policy.md §3";
const SECTION_5 = "po_amendment_policy.md §5";

export class ContradictionGuardrail implements Guardrail {
  readonly name = "ContradictionGuardrail";

  evaluate(context: GuardrailContext): GuardrailResult {
    const quantityVariance = context.varianceSummary?.quantityVariancePercent;
    if (quantityVariance === undefined) {
      return { name: this.name, passed: true, severity: "non_blocking" };
    }
    if (quantityVariance <= 5 || quantityVariance > 10) {
      return { name: this.name, passed: true, severity: "non_blocking" };
    }
    const citations = context.retrievedChunks.map((result) => result.chunk.citation);
    const hasContradictoryPair =
      citations.includes(SECTION_3) && citations.includes(SECTION_5);
    if (!hasContradictoryPair) {
      return { name: this.name, passed: true, severity: "non_blocking" };
    }
    return {
      name: this.name,
      passed: false,
      severity: "blocking",
      reason:
        "Detected contradictory SOP guidance: §3 permits in-place amendment up to 10% quantity variance, while §5 requires cancellation above 5%. This PO falls within the conflicting range.",
      override: {
        recommended_action: "escalate",
        confidence: "low",
        rationale:
          "The retrieved SOP guidance is contradictory: one policy section permits in-place amendment up to 10% quantity variance, while another requires cancellation and re-raise above 5%. Because this PO falls within the conflicting range, it must be escalated.",
        citations: [SECTION_3, SECTION_5],
        escalation_target_role: "Senior Merch Planner"
      }
    };
  }
}
