# Child PO Split Rules

## §1 Purpose

This SOP defines when a parent purchase order should be subdivided into child POs, how the resulting child POs should be sized, and which splits are prohibited. The aim is to keep operational handling clean while preserving a single, traceable parent commitment.

## §2 Parent PO Eligibility

A parent PO is eligible for a split only when all of the following hold:

- The parent PO status is one of `confirmed`, `partial`, or `delayed`.
- The parent PO has not already been split into child POs.
- The parent PO is not subject to a cancellation rule under the PO Amendment Policy §5.
- The parent PO has a documented operational reason for separate handling, such as distinct fulfilment channels, distinct delivery windows, or distinct supplier confirmations.

Parent POs in status `planned` or `firmed` must not be split. Firm the order first, then re-evaluate.

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
