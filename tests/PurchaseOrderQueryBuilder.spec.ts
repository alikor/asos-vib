import { describe, expect, it } from "vitest";
import { PurchaseOrderQueryBuilder } from "../src/application/queries/PurchaseOrderQueryBuilder.js";
import type { PurchaseOrder } from "../src/domain/purchase-orders/PurchaseOrder.js";

const sampleOrders: PurchaseOrder[] = [
  {
    po_id: "PO-10001",
    supplier: "Alpha Textiles",
    channel: "retail",
    sku: "SKU-1",
    category: "dresses",
    ordered_qty: 120,
    confirmed_qty: 120,
    eta: "2026-02-01",
    expected_eta: "2026-02-01",
    value_gbp: 5000,
    status: "confirmed",
    parent_po_id: null
  },
  {
    po_id: "PO-10002",
    supplier: "Alpha Textiles",
    channel: "wholesale",
    sku: "SKU-2",
    category: "tops",
    ordered_qty: 80,
    confirmed_qty: 60,
    eta: "2026-02-05",
    expected_eta: "2026-02-03",
    value_gbp: 3200,
    status: "partial",
    parent_po_id: null
  },
  {
    po_id: "PO-10003",
    supplier: "Beta Sourcing",
    channel: "retail",
    sku: "SKU-1",
    category: "dresses",
    ordered_qty: 150,
    confirmed_qty: 150,
    eta: "2026-02-10",
    expected_eta: "2026-02-10",
    value_gbp: 6400,
    status: "firmed",
    parent_po_id: "PO-09999"
  }
];

const makeDataSource = (rows: PurchaseOrder[]) => ({
  readAll: async () => rows
});

describe("PurchaseOrderQueryBuilder", () => {
  it("applies multiple filters together", async () => {
    const results = await new PurchaseOrderQueryBuilder(makeDataSource(sampleOrders))
      .whereSupplier("Alpha Textiles")
      .whereStatus("confirmed")
      .whereSku("SKU-1")
      .execute();

    expect(results).toEqual([sampleOrders[0]]);
  });

  it("filters by po id independently", async () => {
    const results = await new PurchaseOrderQueryBuilder(makeDataSource(sampleOrders))
      .wherePoId("PO-10003")
      .execute();

    expect(results).toEqual([sampleOrders[2]]);
  });

  it("returns the first matching order from executeOne", async () => {
    const result = await new PurchaseOrderQueryBuilder(makeDataSource(sampleOrders))
      .whereSupplier("Alpha Textiles")
      .executeOne();

    expect(result).toEqual(sampleOrders[0]);
  });

  it("returns null from executeOne when no orders match", async () => {
    const result = await new PurchaseOrderQueryBuilder(makeDataSource(sampleOrders))
      .whereStatus("delayed")
      .executeOne();

    expect(result).toBeNull();
  });
});