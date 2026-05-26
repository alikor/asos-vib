import { describe, expect, it } from "vitest";
import { TriageCase } from "../src/domain/triage/TriageCase.js";
import type { TriageRecommendation } from "../src/domain/triage/Recommendation.js";

const recommendation: TriageRecommendation = {
  po_id: "PO-10001",
  recommended_action: "amend",
  rationale: "ok",
  citations: ["po_amendment_policy.md §3"],
  confidence: "high",
  escalation_target_role: null
};

describe("TriageCase aggregate", () => {
  it("transitions through start → context_retrieved → recommendation_generated → guardrails_evaluated → completed", () => {
    const aggregate = TriageCase.start({
      caseId: "case-1",
      question: "Triage PO-10001",
      poId: "PO-10001",
      occurredAt: "2026-01-01T00:00:00.000Z"
    });
    aggregate.recordContextRetrieved({
      citations: ["po_amendment_policy.md §3"],
      scores: [{ citation: "po_amendment_policy.md §3", score: 0.9 }],
      occurredAt: "2026-01-01T00:00:01.000Z"
    });
    aggregate.recordRecommendationGenerated({
      recommendation,
      occurredAt: "2026-01-01T00:00:02.000Z"
    });
    aggregate.recordGuardrailsEvaluated({
      results: [{ name: "x", passed: true, severity: "non_blocking" }],
      occurredAt: "2026-01-01T00:00:03.000Z"
    });
    aggregate.complete({
      finalRecommendation: recommendation,
      occurredAt: "2026-01-01T00:00:04.000Z"
    });

    const state = aggregate.getState();
    expect(state.status).toBe("completed");
    expect(state.retrievedCitations).toEqual(["po_amendment_policy.md §3"]);
    expect(state.recommendation?.po_id).toBe("PO-10001");

    const events = aggregate.pullUncommittedEvents();
    expect(events.map((e) => e.type)).toEqual([
      "TriageCaseStarted",
      "SopContextRetrieved",
      "RecommendationGenerated",
      "GuardrailsEvaluated",
      "TriageCaseCompleted"
    ]);
    expect(aggregate.pullUncommittedEvents()).toEqual([]);
  });

  it("can be rehydrated from a stored event stream", () => {
    const aggregate = TriageCase.start({
      caseId: "case-1",
      question: "Triage PO-10001",
      occurredAt: "2026-01-01T00:00:00.000Z"
    });
    aggregate.escalate({
      finalRecommendation: { ...recommendation, recommended_action: "escalate", escalation_target_role: "Head of Buying", confidence: "low" },
      occurredAt: "2026-01-01T00:00:05.000Z"
    });
    const events = aggregate.pullUncommittedEvents();
    const rehydrated = TriageCase.rehydrate(events);
    expect(rehydrated.getState().status).toBe("escalated");
  });
});
