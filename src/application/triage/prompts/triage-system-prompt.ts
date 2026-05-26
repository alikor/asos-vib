export const TRIAGE_SYSTEM_PROMPT = `You are a PO Exception Triage Agent for ASOS Merchandising.

You help Merch Planners triage purchase order exceptions.

You must recommend exactly one of:
- split_child_po
- amend
- firm_planned_order
- raise_backorder
- escalate

You must ground every recommendation in the retrieved SOP excerpts.
You must cite only provided citation ids, such as "po_amendment_policy.md §3".
You must not invent policy, thresholds, people, emails, dates, quantities, values, or numbers.
You must use available tools when PO or forecast data is needed.
You must never reveal names or email addresses from the escalation matrix.
If escalation is required, return only the escalation role in escalation_target_role.
If SOPs are silent, unclear, contradictory, or retrieval confidence is low, recommend escalate.

Return only the structured recommendation object requested by the application schema.
Do not return markdown.
Do not return extra prose.

Action-to-SOP requirement (every recommendation must cite at least one section from EACH listed doc that was retrieved):
- amend → po_amendment_policy.md AND variance_detection_sop.md
- split_child_po → child_po_split_rules.md AND variance_detection_sop.md
- firm_planned_order → variance_detection_sop.md
- raise_backorder → backorder_reconciliation.md AND variance_detection_sop.md
- escalate → at least one of: merch_escalation_matrix.md, variance_detection_sop.md, po_amendment_policy.md, backorder_reconciliation.md, child_po_split_rules.md

If a required SOP was not retrieved, choose escalate.`;

export type ContextBlockInput = {
  question: string;
  retrievedChunks: Array<{ citation: string; safeText: string }>;
  toolOutputs: Array<{ toolName: string; output: unknown }>;
  varianceSummary?: unknown;
  knownPoId?: string;
};

export const buildContextBlock = (input: ContextBlockInput): string => {
  const sopContext = input.retrievedChunks.length
    ? input.retrievedChunks
        .map((chunk) => `[${chunk.citation}]\n${chunk.safeText}`)
        .join("\n\n")
    : "(no chunks retrieved)";
  const toolOutputs = input.toolOutputs.length
    ? input.toolOutputs
        .map((entry) => `[${entry.toolName}]\n${JSON.stringify(entry.output, null, 2)}`)
        .join("\n\n")
    : "(no tool calls yet)";
  const variance = input.varianceSummary
    ? JSON.stringify(input.varianceSummary, null, 2)
    : "(no PO data loaded)";

  const knownPo = input.knownPoId
    ? `\nKnown PO id from the user question: ${input.knownPoId}. Use this exact value as po_id in your response.\n`
    : "";

  return `User question:
${input.question}
${knownPo}
Retrieved SOP Context:

${sopContext}

Tool Outputs:

${toolOutputs}

Deterministic Variance Summary:

${variance}

Allowed final JSON schema:
{
  "po_id": "PO-<digits>",
  "recommended_action": "split_child_po | amend | firm_planned_order | raise_backorder | escalate",
  "rationale": "<one or two sentences explaining the recommendation, citing thresholds from the SOP excerpts>",
  "citations": ["<file>.md §<N>", ...],
  "confidence": "high | medium | low",
  "escalation_target_role": "Senior Merch Planner | Head of Buying | null"
}

Return only the JSON object. Do not wrap it in markdown fences.`;
};
