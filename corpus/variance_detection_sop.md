# Variance Detection SOP

## §1 Variance Definitions

A variance is any difference between the original PO commitment and the supplier-confirmed (or delivered) values. The three tracked variances are:

- Quantity variance = `abs(ordered_qty - confirmed_qty) / ordered_qty * 100`, expressed as a percentage of the ordered quantity.
- Value variance = `abs(ordered_value_gbp - confirmed_value_gbp)`, expressed in GBP.
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
