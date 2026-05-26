import { differenceInCalendarDays } from "date-fns";
import type { PurchaseOrder } from "../../domain/purchase-orders/PurchaseOrder.js";
import type { VarianceSummary } from "../../domain/triage/Recommendation.js";

export class VarianceCalculator {
  calculate(po: PurchaseOrder): VarianceSummary {
    const orderedQty = po.ordered_qty;
    const confirmedQty = po.confirmed_qty;
    const quantityVariancePercent =
      orderedQty === 0
        ? 0
        : roundTo2dp((Math.abs(orderedQty - confirmedQty) / orderedQty) * 100);
    const etaVarianceDays = differenceInCalendarDays(new Date(po.eta), new Date(po.expected_eta));
    return {
      orderedQty,
      confirmedQty,
      quantityVariancePercent,
      expectedEta: po.expected_eta,
      eta: po.eta,
      etaVarianceDays,
      valueGbp: po.value_gbp,
      channel: po.channel,
      status: po.status
    };
  }
}

const roundTo2dp = (value: number): number => Math.round(value * 100) / 100;
