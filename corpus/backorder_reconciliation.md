# Backorder Reconciliation

## §1 Purpose

This SOP defines when a backorder may be raised against a partially-confirmed or partially-delivered PO, how partial deliveries reconcile to the parent commitment, and the customer communication and delay thresholds that govern backorder handling.

## §2 Backorder Creation Rules

A backorder may be raised against a PO only when all of the following hold:

- The PO status is `partial` or `delayed`.
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
