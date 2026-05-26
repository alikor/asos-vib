export type PurchaseOrderStatus =
  | "planned"
  | "firmed"
  | "confirmed"
  | "partial"
  | "delayed";

export type PurchaseOrderChannel = "retail" | "wholesale";

export type PurchaseOrder = {
  po_id: string;
  supplier: string;
  channel: PurchaseOrderChannel;
  sku: string;
  category: string;
  ordered_qty: number;
  confirmed_qty: number;
  eta: string;
  expected_eta: string;
  value_gbp: number;
  status: PurchaseOrderStatus;
  parent_po_id: string | null;
};
