# PO Amendment Policy

## §1 Purpose

This policy defines when an ASOS Merchandising purchase order may be amended in-place after confirmation, and when the parent PO must instead be cancelled and re-raised. It applies to all PO categories and to both Retail and Wholesale channels. The intent is to limit operational risk while keeping low-impact corrections frictionless for Merch Planners.

## §2 Amendment Preconditions

A PO may only be considered for amendment when all of the following are true:

- The PO status is one of `confirmed`, `partial`, or `delayed`.
- The amendment is supported by a documented variance fact (quantity, value, or ETA).
- The supplier has acknowledged the variance in writing or via the EDI confirmation channel.
- The amendment does not change supplier, category, or fulfilment channel.

POs in status `planned` should be firmed first, not amended. POs in status `firmed` should be re-firmed only with a supplier reconfirmation.

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

- A retail PO for 1,000 units of `SKU-DRESS-001` is confirmed at 960 units (4% quantity variance), with a value of £12,000 and a 1-day ETA slip. This is within all §3 thresholds and may be amended in-place by a Senior Merch Planner.
- A wholesale PO for 2,000 pairs of `SKU-SHOE-008` is confirmed at 1,200 units (40% quantity variance) with a value of £125,000 and a 20-day ETA slip. Each of these breaches §5; the PO must be cancelled and re-raised, and Head of Buying approval is mandatory.
- A retail PO for 1,000 units of `SKU-TOP-012` is confirmed at 920 units (8% quantity variance). §3 would permit an in-place amendment at this level, while §5 requires cancellation and re-raise above 5%; this conflict must be escalated to a Merch Planner for manual resolution.
