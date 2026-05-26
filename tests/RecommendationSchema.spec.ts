import { describe, expect, it } from "vitest";
import { parseAndValidateRecommendation } from "../src/application/triage/RecommendationSchema.js";
import { PiiDetector } from "../src/infrastructure/security/PiiDetector.js";

const detector = new PiiDetector(["Alice Example"]);

describe("parseAndValidateRecommendation", () => {
  it("accepts a valid amend recommendation", () => {
    const result = parseAndValidateRecommendation({
      raw: {
        po_id: "PO-10001",
        recommended_action: "amend",
        rationale: "Within thresholds.",
        citations: ["po_amendment_policy.md §3"],
        confidence: "high",
        escalation_target_role: null
      },
      retrievedCitations: ["po_amendment_policy.md §3"],
      piiDetector: detector,
      knownPoId: "PO-10001"
    });
    expect(result.ok).toBe(true);
  });

  it("rejects citations not in the retrieved set", () => {
    const result = parseAndValidateRecommendation({
      raw: {
        po_id: "PO-10001",
        recommended_action: "amend",
        rationale: "x",
        citations: ["other.md §1"],
        confidence: "medium",
        escalation_target_role: null
      },
      retrievedCitations: ["po_amendment_policy.md §3"],
      piiDetector: detector
    });
    expect(result.ok).toBe(false);
  });

  it("rejects when escalation role is set but action is not escalate", () => {
    const result = parseAndValidateRecommendation({
      raw: {
        po_id: "PO-10001",
        recommended_action: "amend",
        rationale: "x",
        citations: ["po_amendment_policy.md §3"],
        confidence: "high",
        escalation_target_role: "Head of Buying"
      },
      retrievedCitations: ["po_amendment_policy.md §3"],
      piiDetector: detector
    });
    expect(result.ok).toBe(false);
  });

  it("rejects when escalate action has null role", () => {
    const result = parseAndValidateRecommendation({
      raw: {
        po_id: "PO-10008",
        recommended_action: "escalate",
        rationale: "Critical variance.",
        citations: ["po_amendment_policy.md §5"],
        confidence: "low",
        escalation_target_role: null
      },
      retrievedCitations: ["po_amendment_policy.md §5"],
      piiDetector: detector
    });
    expect(result.ok).toBe(false);
  });

  it("rejects emails in the rationale", () => {
    const result = parseAndValidateRecommendation({
      raw: {
        po_id: "PO-10001",
        recommended_action: "amend",
        rationale: "Email alice.example@asos.invalid",
        citations: ["po_amendment_policy.md §3"],
        confidence: "high",
        escalation_target_role: null
      },
      retrievedCitations: ["po_amendment_policy.md §3"],
      piiDetector: detector
    });
    expect(result.ok).toBe(false);
  });
});
