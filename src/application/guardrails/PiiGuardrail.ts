import type { GuardrailResult } from "../../domain/triage/Recommendation.js";
import type { PiiDetector } from "../../infrastructure/security/PiiDetector.js";
import type { Guardrail, GuardrailContext } from "./Guardrail.js";

export class PiiGuardrail implements Guardrail {
  readonly name = "PiiGuardrail";

  constructor(private readonly detector: PiiDetector) {}

  evaluate(context: GuardrailContext): GuardrailResult {
    const serialised = JSON.stringify(context.recommendation);
    const email = this.detector.findEmail(serialised);
    const matchedName = this.detector.containsKnownName(serialised);
    if (!email && !matchedName) {
      return { name: this.name, passed: true, severity: "non_blocking" };
    }
    const reason = email
      ? `Detected an email address in the draft response: ${email}.`
      : `Detected a known escalation matrix name in the draft response: ${matchedName ?? ""}.`;
    return {
      name: this.name,
      passed: false,
      severity: "blocking",
      reason,
      override: {
        recommended_action: "escalate",
        confidence: "low",
        rationale:
          "The case has been escalated because the draft response attempted to expose restricted escalation contact details. Only the escalation role may be returned.",
        citations: context.retrievedCitations.slice(0, 2),
        escalation_target_role: "Senior Merch Planner"
      }
    };
  }
}
