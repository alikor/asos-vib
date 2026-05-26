import type { PurchaseOrderChannel, PurchaseOrderStatus } from "../purchase-orders/PurchaseOrder.js";

export type RecommendedAction =
  | "split_child_po"
  | "amend"
  | "firm_planned_order"
  | "raise_backorder"
  | "escalate";

export type Confidence = "high" | "medium" | "low";

export type EscalationRole = "Senior Merch Planner" | "Head of Buying" | null;

export type TriageRecommendation = {
  po_id: string;
  recommended_action: RecommendedAction;
  rationale: string;
  citations: string[];
  confidence: Confidence;
  escalation_target_role: EscalationRole;
};

export type VarianceSummary = {
  orderedQty: number;
  confirmedQty: number;
  quantityVariancePercent: number;
  expectedEta: string;
  eta: string;
  etaVarianceDays: number;
  valueGbp: number;
  channel: PurchaseOrderChannel;
  status: PurchaseOrderStatus;
};

export type GuardrailSeverity = "non_blocking" | "blocking";

export type GuardrailResult = {
  name: string;
  passed: boolean;
  severity: GuardrailSeverity;
  reason?: string;
  override?: Partial<TriageRecommendation>;
};
