import { describe, expect, it } from "vitest";
import { ContradictionGuardrail } from "../src/application/guardrails/ContradictionGuardrail.js";
import { PiiGuardrail } from "../src/application/guardrails/PiiGuardrail.js";
import { RetrievalConfidenceGuardrail } from "../src/application/guardrails/RetrievalConfidenceGuardrail.js";
import { PiiDetector } from "../src/infrastructure/security/PiiDetector.js";
import type { GuardrailContext } from "../src/application/guardrails/Guardrail.js";
import type { PolicyChunkSearchResult } from "../src/domain/rag/PolicyChunk.js";
import type { TriageRecommendation } from "../src/domain/triage/Recommendation.js";

const mockChunk = (
  citation: string,
  score: number
): PolicyChunkSearchResult => ({
  chunk: {
    id: citation,
    docName: citation.split(" ")[0] ?? "",
    section: citation.split(" ")[1] ?? "",
    citation,
    rawText: "",
    safeText: "",
    embedding: []
  },
  score
});

const baseRecommendation: TriageRecommendation = {
  po_id: "PO-10001",
  recommended_action: "amend",
  rationale: "Within thresholds.",
  citations: ["po_amendment_policy.md §3", "variance_detection_sop.md §2"],
  confidence: "high",
  escalation_target_role: null
};

const baseContext = (overrides: Partial<GuardrailContext> = {}): GuardrailContext => {
  const retrievedChunks = overrides.retrievedChunks ?? [
    mockChunk("po_amendment_policy.md §3", 0.92),
    mockChunk("variance_detection_sop.md §2", 0.88)
  ];
  return {
    question: "Triage PO-10001",
    recommendation: overrides.recommendation ?? baseRecommendation,
    retrievedChunks,
    retrievedCitations: retrievedChunks.map((r) => r.chunk.citation),
    minScore: overrides.minScore ?? 0.68,
    varianceSummary: overrides.varianceSummary,
    po: overrides.po,
    forecast: overrides.forecast
  };
};

describe("ContradictionGuardrail", () => {
  const guardrail = new ContradictionGuardrail();

  it("blocks when both §3 and §5 are present and variance is in the 5-10% band", async () => {
    const result = await guardrail.evaluate(
      baseContext({
        retrievedChunks: [
          mockChunk("po_amendment_policy.md §3", 0.9),
          mockChunk("po_amendment_policy.md §5", 0.88)
        ],
        varianceSummary: {
          orderedQty: 1000,
          confirmedQty: 920,
          quantityVariancePercent: 8,
          expectedEta: "2026-06-12",
          eta: "2026-06-12",
          etaVarianceDays: 0,
          valueGbp: 18000,
          channel: "retail",
          status: "confirmed"
        }
      })
    );
    expect(result.passed).toBe(false);
    expect(result.override?.recommended_action).toBe("escalate");
    expect(result.override?.citations).toEqual([
      "po_amendment_policy.md §3",
      "po_amendment_policy.md §5"
    ]);
  });

  it("passes when variance is outside the 5-10% band", async () => {
    const result = await guardrail.evaluate(
      baseContext({
        varianceSummary: {
          orderedQty: 1000,
          confirmedQty: 960,
          quantityVariancePercent: 4,
          expectedEta: "2026-06-10",
          eta: "2026-06-11",
          etaVarianceDays: 1,
          valueGbp: 12000,
          channel: "retail",
          status: "confirmed"
        }
      })
    );
    expect(result.passed).toBe(true);
  });
});

describe("RetrievalConfidenceGuardrail", () => {
  const guardrail = new RetrievalConfidenceGuardrail();

  it("blocks when there are fewer than two chunks above min_score", async () => {
    const result = await guardrail.evaluate(
      baseContext({
        retrievedChunks: [mockChunk("po_amendment_policy.md §3", 0.7)]
      })
    );
    expect(result.passed).toBe(false);
    expect(result.override?.recommended_action).toBe("escalate");
  });

  it("blocks when citations are not in retrieved set", async () => {
    const result = await guardrail.evaluate(
      baseContext({
        recommendation: {
          ...baseRecommendation,
          citations: ["unknown_doc.md §1"]
        }
      })
    );
    expect(result.passed).toBe(false);
  });

  it("blocks when action and citation docs are mismatched", async () => {
    const result = await guardrail.evaluate(
      baseContext({
        recommendation: {
          ...baseRecommendation,
          recommended_action: "raise_backorder",
          citations: ["po_amendment_policy.md §3"]
        },
        retrievedChunks: [
          mockChunk("po_amendment_policy.md §3", 0.92),
          mockChunk("variance_detection_sop.md §2", 0.88)
        ]
      })
    );
    expect(result.passed).toBe(false);
  });

  it("passes when retrievals and citations are aligned", async () => {
    const result = await guardrail.evaluate(baseContext());
    expect(result.passed).toBe(true);
  });
});

describe("PiiGuardrail", () => {
  const guardrail = new PiiGuardrail(new PiiDetector(["Alice Example"]));

  it("blocks when an email appears in the recommendation", async () => {
    const result = await guardrail.evaluate(
      baseContext({
        recommendation: {
          ...baseRecommendation,
          rationale: "Escalate to alice.example@asos.invalid"
        }
      })
    );
    expect(result.passed).toBe(false);
    expect(result.override?.recommended_action).toBe("escalate");
  });

  it("blocks when a known name appears", async () => {
    const result = await guardrail.evaluate(
      baseContext({
        recommendation: {
          ...baseRecommendation,
          rationale: "Forward to Alice Example for review"
        }
      })
    );
    expect(result.passed).toBe(false);
  });

  it("passes a clean recommendation", async () => {
    const result = await guardrail.evaluate(baseContext());
    expect(result.passed).toBe(true);
  });
});
