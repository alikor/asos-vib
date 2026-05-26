import type { GuardrailResult, RecommendedAction } from "../../domain/triage/Recommendation.js";
import type { Guardrail, GuardrailContext } from "./Guardrail.js";

const RELEVANT_DOCS_BY_ACTION: Record<RecommendedAction, string[]> = {
  amend: ["po_amendment_policy.md", "variance_detection_sop.md"],
  split_child_po: ["child_po_split_rules.md", "variance_detection_sop.md"],
  firm_planned_order: ["variance_detection_sop.md"],
  raise_backorder: ["backorder_reconciliation.md", "variance_detection_sop.md"],
  escalate: [
    "merch_escalation_matrix.md",
    "variance_detection_sop.md",
    "po_amendment_policy.md",
    "backorder_reconciliation.md",
    "child_po_split_rules.md"
  ]
};

export class RetrievalConfidenceGuardrail implements Guardrail {
  readonly name = "RetrievalConfidenceGuardrail";

  evaluate(context: GuardrailContext): GuardrailResult {
    const chunks = context.retrievedChunks;
    if (chunks.length === 0) {
      return this.block(context, "No SOP chunks were retrieved for this question.");
    }
    const topScore = chunks[0]?.score ?? 0;
    if (topScore < context.minScore) {
      return this.block(
        context,
        `Top retrieval score ${topScore.toFixed(3)} is below the minimum ${context.minScore}.`
      );
    }
    const aboveThreshold = chunks.filter((chunk) => chunk.score >= context.minScore);
    if (aboveThreshold.length < 2) {
      return this.block(
        context,
        `Only ${aboveThreshold.length} chunk(s) above min_score; need at least 2.`
      );
    }
    const retrievedSet = new Set(context.retrievedCitations);
    const unknownCitations = context.recommendation.citations.filter(
      (cit) => !retrievedSet.has(cit)
    );
    if (unknownCitations.length > 0) {
      return this.block(
        context,
        `Final response cites citations that were not retrieved: ${unknownCitations.join(", ")}.`
      );
    }
    const relevantDocs = RELEVANT_DOCS_BY_ACTION[context.recommendation.recommended_action];
    const citationDocs = context.recommendation.citations.map((cit) => cit.split(" ")[0] ?? "");
    const hasRelevant = citationDocs.some((doc) => relevantDocs.includes(doc));
    if (!hasRelevant) {
      return this.block(
        context,
        `No citation supports recommended_action "${context.recommendation.recommended_action}".`
      );
    }
    return { name: this.name, passed: true, severity: "non_blocking" };
  }

  private block(context: GuardrailContext, reason: string): GuardrailResult {
    return {
      name: this.name,
      passed: false,
      severity: "blocking",
      reason,
      override: {
        recommended_action: "escalate",
        confidence: "low",
        rationale:
          "The retrieved SOP evidence was insufficient to safely recommend an automated action, so the case must be escalated for human review.",
        citations: context.retrievedCitations.slice(0, 2),
        escalation_target_role: "Senior Merch Planner"
      }
    };
  }
}
