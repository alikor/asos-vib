import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const corpus: Array<{ filename: string; body: string }> = [
  {
    filename: "po_amendment_policy.md",
    body: `# PO Amendment Policy

## §1 Purpose

This policy defines when an ASOS Merchandising purchase order may be amended in-place after confirmation, and when the parent PO must instead be cancelled and re-raised. It applies to all PO categories and to both Retail and Wholesale channels. The intent is to limit operational risk while keeping low-impact corrections frictionless for Merch Planners.

## §2 Amendment Preconditions

A PO may only be considered for amendment when all of the following are true:

- The PO status is one of \`confirmed\`, \`partial\`, or \`delayed\`.
- The amendment is supported by a documented variance fact (quantity, value, or ETA).
- The supplier has acknowledged the variance in writing or via the EDI confirmation channel.
- The amendment does not change supplier, category, or fulfilment channel.

POs in status \`planned\` should be firmed first, not amended. POs in status \`firmed\` should be re-firmed only with a supplier reconfirmation.

## §3 In-place Amendment Thresholds

A PO may be amended in-place — without cancellation — when all of the following hold:

- Quantity variance is less than or equal to 10% of ordered quantity.
- Value variance is less than or equal to £20,000 against the original PO value.
- ETA variance is less than or equal to 3 calendar days against the originally expected ETA.
- The PO is not subject to a category-level merchandising freeze.

In-place amendment within these thresholds does not require Head of Buying sign-off.

## §4 Sign-off Requirements

Sign-off requirements scale with the change being applied:

- Variance within §3 thresholds: Senior Merch Planner can self-approve.
- Variance above any §3 threshold but below the cancellation triggers in §5: Senior Merch Planner approval plus a Head of Buying notification.
- Variance above any cancellation trigger in §5: Head of Buying approval is mandatory and an audit note must be attached.

## §5 Cancellation and Re-raise Rules

A PO must be cancelled and re-raised — never amended in-place — when any of the following hold:

- Quantity variance is greater than 5% of ordered quantity.
- Value variance is greater than £30,000.
- ETA variance is greater than 14 calendar days.
- The supplier requests a change of category, supplier code, or fulfilment channel.
- The PO has already been amended in-place twice in the current trading season.

Cancellation and re-raise must preserve the original PO id in the audit trail.

## §6 Examples

- A retail PO for 1,000 units of \`SKU-DRESS-001\` is confirmed at 960 units (4% quantity variance), with a value of £12,000 and a 1-day ETA slip. This is within all §3 thresholds and may be amended in-place by a Senior Merch Planner.
- A wholesale PO for 2,000 pairs of \`SKU-SHOE-008\` is confirmed at 1,200 units (40% quantity variance) with a value of £125,000 and a 20-day ETA slip. Each of these breaches §5; the PO must be cancelled and re-raised, and Head of Buying approval is mandatory.
- A retail PO for 1,000 units of \`SKU-TOP-012\` is confirmed at 920 units (8% quantity variance). §3 would permit an in-place amendment at this level, while §5 requires cancellation and re-raise above 5%; this conflict must be escalated to a Merch Planner for manual resolution.
`
  },
  {
    filename: "variance_detection_sop.md",
    body: `# Variance Detection SOP

## §1 Variance Definitions

A variance is any difference between the original PO commitment and the supplier-confirmed (or delivered) values. The three tracked variances are:

- Quantity variance = \`abs(ordered_qty - confirmed_qty) / ordered_qty * 100\`, expressed as a percentage of the ordered quantity.
- Value variance = \`abs(ordered_value_gbp - confirmed_value_gbp)\`, expressed in GBP.
- ETA variance = difference between the originally expected ETA and the supplier-confirmed ETA, expressed in calendar days. Positive numbers indicate a delay.

Each variance is computed deterministically by the system, not the supplier, using the latest PO data.

## §2 Quantity Variance Severity

Quantity variance severity tiers (always measured against ordered quantity):

- Minor: 0% < variance <= 5%.
- Moderate: 5% < variance <= 10%.
- Major: 10% < variance <= 25%.
- Critical: variance > 25%.

Minor variances may be auto-actioned when amendment or backorder SOP rules support it. Moderate variances must be reviewed against the amendment policy. Major and critical variances always require human review.

## §3 Value Variance Severity

Value variance severity tiers (always measured in GBP against original PO value):

- Minor: 0 < variance <= £5,000.
- Moderate: £5,000 < variance <= £20,000.
- Major: £20,000 < variance <= £50,000.
- Critical: variance > £50,000.

Critical value variances always require Head of Buying review regardless of other indicators.

## §4 ETA Variance Severity

ETA variance severity tiers (calendar days, positive means delay):

- On track: 0 days or earlier.
- Minor: 1 to 3 days late.
- Moderate: 4 to 7 days late.
- Major: 8 to 14 days late.
- Critical: more than 14 days late.

Critical ETA variances require escalation to the relevant Head of Buying and may trigger customer communication thresholds defined in the backorder reconciliation SOP.

## §5 Auto-action Boundaries

A variance may be auto-actioned only when all of the following are true:

- Quantity variance severity is Minor.
- Value variance severity is Minor or Moderate.
- ETA variance severity is On track or Minor.
- The amendment, backorder, or split SOP explicitly supports the candidate action.
- No SOP contradiction is detected for the candidate action.

Auto-action is not the same as auto-approval. The action is still recorded against a named user.

## §6 Human Review Boundaries

Human review is required when any of the following hold:

- Quantity variance severity is Moderate or higher.
- Value variance severity is Major or Critical.
- ETA variance severity is Moderate or higher.
- Retrieved SOP guidance is silent, ambiguous, or contradictory.
- The candidate action falls outside the SOP-supported actions for the detected severities.

When in doubt, escalate. SOP silence is treated as a Major variance for routing purposes.
`
  },
  {
    filename: "child_po_split_rules.md",
    body: `# Child PO Split Rules

## §1 Purpose

This SOP defines when a parent purchase order should be subdivided into child POs, how the resulting child POs should be sized, and which splits are prohibited. The aim is to keep operational handling clean while preserving a single, traceable parent commitment.

## §2 Parent PO Eligibility

A parent PO is eligible for a split only when all of the following hold:

- The parent PO status is one of \`confirmed\`, \`partial\`, or \`delayed\`.
- The parent PO has not already been split into child POs.
- The parent PO is not subject to a cancellation rule under the PO Amendment Policy §5.
- The parent PO has a documented operational reason for separate handling, such as distinct fulfilment channels, distinct delivery windows, or distinct supplier confirmations.

Parent POs in status \`planned\` or \`firmed\` must not be split. Firm the order first, then re-evaluate.

## §3 Retail and Wholesale Split Logic

When a single parent PO carries both Retail and Wholesale allocation, the parent should be split into one Retail child PO and one Wholesale child PO when any of the following hold:

- The Retail and Wholesale allocations have different confirmed quantities.
- The Retail and Wholesale allocations have different confirmed delivery dates.
- The Retail and Wholesale allocations require different operational treatment (for example, customer communication thresholds).

The two child POs inherit the supplier and SKU of the parent and reference the parent PO id in their metadata.

## §4 Child PO Sizing Rules

Each child PO must satisfy all of the following:

- Confirmed quantity at least 100 units for non-Accessories categories.
- Confirmed quantity at least 50 units for Accessories.
- Confirmed value at least £2,000 GBP.
- Distinct ETA from any sibling child PO when the split is ETA-driven.

If any candidate child PO would breach these thresholds, the split must be re-planned or escalated.

## §5 Prohibited Splits

A parent PO must not be split when any of the following hold:

- The parent PO has already been amended in-place under the PO Amendment Policy §3.
- The split would create one or more child POs below the §4 sizing thresholds.
- The split is being requested solely to avoid a cancellation trigger under the PO Amendment Policy §5.
- The split would require a category or supplier change.

Prohibited splits must be escalated to a Senior Merch Planner with a written reason.
`
  },
  {
    filename: "backorder_reconciliation.md",
    body: `# Backorder Reconciliation

## §1 Purpose

This SOP defines when a backorder may be raised against a partially-confirmed or partially-delivered PO, how partial deliveries reconcile to the parent commitment, and the customer communication and delay thresholds that govern backorder handling.

## §2 Backorder Creation Rules

A backorder may be raised against a PO only when all of the following hold:

- The PO status is \`partial\` or \`delayed\`.
- Confirmed quantity is less than ordered quantity by more than 1% but less than or equal to 25%.
- The supplier has provided a written commitment that the residual units can be fulfilled within the maximum permissible delay window defined in §5.
- The PO is not already subject to a cancellation trigger under the PO Amendment Policy §5.

Backorders must not be raised automatically when the residual quantity exceeds 25% of the ordered quantity; those cases must be cancelled and re-raised, or split.

## §3 Partial Delivery Reconciliation

Partial deliveries reconcile to the parent PO as follows:

- The confirmed quantity field reflects the supplier commitment for the remaining drop.
- The delivered quantity is tracked in a separate ledger and is not part of the variance computation.
- A backorder, once raised, is itself a child PO and is subject to the Child PO Split Rules §4 sizing thresholds.

Reconciliation must close out the parent PO within 30 calendar days of the final partial drop.

## §4 Customer Communications Thresholds

Customer communications are required when any of the following hold:

- ETA delay is greater than 7 calendar days against the originally expected ETA.
- Value of the backordered units exceeds £10,000.
- Backorder is for an SKU on the active promotional plan.

When required, communications must be issued by the channel team within 24 hours of the backorder being raised.

## §5 Maximum Permissible Delay

The maximum permissible delay for a backorder is:

- 14 calendar days for in-season POs.
- 21 calendar days for off-season POs.
- 7 calendar days for any PO flagged for the active promotional plan.

If the supplier cannot commit to fulfilment within the permissible delay window, the backorder must not be raised. The case must be escalated to a Head of Buying for cancellation, supplier substitution, or replanning.
`
  },
  {
    filename: "merch_escalation_matrix.md",
    body: `# Merch Escalation Matrix

## §1 Escalation Principles

Escalations route to a named role, never to a personal mailbox. Personal contact details listed in this document are an operational lookup for the on-call coordinator only. Automated triage outputs must surface only the escalation role; names and email addresses must never leave the system.

Escalation is triggered when any of the following hold:

- The PO Amendment Policy §5 cancellation criteria are met.
- The Variance Detection SOP §6 human review criteria are met.
- The Backorder Reconciliation SOP §5 maximum permissible delay is exceeded.
- The retrieved SOP guidance is silent, ambiguous, or contradictory for the candidate action.

## §2 Value Band Escalation

| Category | Value Band | Escalation Role | Name | Email |
|---|---:|---|---|---|
| Dresses | £0-£20,000 | Senior Merch Planner | Alice Example | alice.example@asos.invalid |
| Dresses | £20,001+ | Head of Buying | Bob Example | bob.example@asos.invalid |
| Footwear | £0-£20,000 | Senior Merch Planner | Cara Example | cara.example@asos.invalid |
| Footwear | £20,001+ | Head of Buying | Dan Example | dan.example@asos.invalid |
| Tops | £0-£20,000 | Senior Merch Planner | Eve Example | eve.example@asos.invalid |
| Tops | £20,001+ | Head of Buying | Frank Example | frank.example@asos.invalid |
| Accessories | £0-£20,000 | Senior Merch Planner | Alice Example | alice.example@asos.invalid |
| Accessories | £20,001+ | Head of Buying | Bob Example | bob.example@asos.invalid |
| Outerwear | £0-£20,000 | Senior Merch Planner | Cara Example | cara.example@asos.invalid |
| Outerwear | £20,001+ | Head of Buying | Dan Example | dan.example@asos.invalid |

The Senior Merch Planner role owns escalations within their value band. The Head of Buying role owns escalations above £20,000, all critical severities, and all contradictory SOP cases.

## §3 Delay Escalation

Delay-driven escalations route as follows:

- ETA delay 8-14 calendar days: Senior Merch Planner.
- ETA delay 15+ calendar days: Head of Buying.
- Any breach of the Backorder Reconciliation SOP §5 permissible delay: Head of Buying.

When both value and delay criteria apply, route to the more senior of the two roles. The on-call coordinator may use the lookup table in §2 to identify the named individual for the routed role, but only the role itself may be returned to the requester.
`
  }
];

export const seedCorpus = async (corpusDir: string): Promise<void> => {
  await mkdir(corpusDir, { recursive: true });
  for (const file of corpus) {
    const path = join(corpusDir, file.filename);
    await writeFile(path, file.body, "utf-8");
    process.stdout.write(`wrote ${path}\n`);
  }
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const corpusDir = resolve(process.cwd(), "corpus");
  seedCorpus(corpusDir).catch((error) => {
    process.stderr.write(
      `seed:corpus failed: ${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exit(1);
  });
}
