import { z } from "zod";
import type { PiiDetector } from "../../infrastructure/security/PiiDetector.js";
import type { TriageRecommendation } from "../../domain/triage/Recommendation.js";

export const RecommendedActionEnum = z.enum([
  "split_child_po",
  "amend",
  "firm_planned_order",
  "raise_backorder",
  "escalate"
]);

export const ConfidenceEnum = z.enum(["high", "medium", "low"]);

export const EscalationRoleEnum = z
  .enum(["Senior Merch Planner", "Head of Buying"])
  .nullable();

export const TriageRecommendationSchema = z.object({
  po_id: z.string().regex(/^PO-\d+$/),
  recommended_action: RecommendedActionEnum,
  rationale: z.string().min(1),
  citations: z.array(z.string()).min(1),
  confidence: ConfidenceEnum,
  escalation_target_role: EscalationRoleEnum
});

export type TriageRecommendationParseResult =
  | { ok: true; recommendation: TriageRecommendation }
  | { ok: false; issues: string[] };

export type PostParseInput = {
  raw: unknown;
  retrievedCitations: string[];
  piiDetector: PiiDetector;
  knownPoId?: string;
};

const coerceForParse = (raw: unknown): unknown => {
  if (typeof raw !== "object" || raw === null) return raw;
  const clone: Record<string, unknown> = { ...(raw as Record<string, unknown>) };
  const role = clone.escalation_target_role;
  if (typeof role === "string") {
    const trimmed = role.trim();
    if (trimmed === "" || trimmed.toLowerCase() === "null" || trimmed.toLowerCase() === "none") {
      clone.escalation_target_role = null;
    }
  }
  if (Array.isArray(clone.citations)) {
    clone.citations = clone.citations
      .filter((entry: unknown): entry is string => typeof entry === "string")
      .map((entry: string) => entry.trim());
  }
  if (typeof clone.po_id === "string") {
    clone.po_id = clone.po_id.trim().toUpperCase();
  }
  return clone;
};

export const parseAndValidateRecommendation = (
  input: PostParseInput
): TriageRecommendationParseResult => {
  const coerced = coerceForParse(input.raw);
  const parsed = TriageRecommendationSchema.safeParse(coerced);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    };
  }
  const issues: string[] = [];
  const rec = parsed.data;
  if (input.knownPoId && rec.po_id !== input.knownPoId) {
    issues.push(`po_id ${rec.po_id} does not match known ${input.knownPoId}`);
  }
  const retrievedSet = new Set(input.retrievedCitations);
  const unknown = rec.citations.filter((cit) => !retrievedSet.has(cit));
  if (unknown.length > 0) {
    issues.push(`unknown citations: ${unknown.join(", ")}`);
  }
  if (rec.recommended_action === "escalate" && rec.escalation_target_role === null) {
    issues.push("escalation_target_role must be set when recommended_action is escalate");
  }
  if (rec.recommended_action !== "escalate" && rec.escalation_target_role !== null) {
    issues.push(
      `escalation_target_role must be null when recommended_action is ${rec.recommended_action}`
    );
  }
  const serialised = JSON.stringify(rec);
  if (input.piiDetector.containsEmail(serialised)) {
    issues.push("response contains an email address");
  }
  const name = input.piiDetector.containsKnownName(serialised);
  if (name) {
    issues.push(`response contains a restricted name: ${name}`);
  }
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, recommendation: rec };
};
