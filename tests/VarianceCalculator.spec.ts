import { describe, expect, it } from "vitest";
import { VarianceCalculator } from "../src/application/triage/VarianceCalculator.js";

describe("VarianceCalculator", () => {
  const calc = new VarianceCalculator();

  it("computes a 4% quantity variance and 1-day ETA slip for PO-10001", () => {
    const v = calc.calculate({
      po_id: "PO-10001",
      supplier: "X",
      channel: "retail",
      sku: "SKU-DRESS-001",
      category: "Dresses",
      ordered_qty: 1000,
      confirmed_qty: 960,
      expected_eta: "2026-06-10",
      eta: "2026-06-11",
      value_gbp: 12000,
      status: "confirmed",
      parent_po_id: null
    });
    expect(v.quantityVariancePercent).toBe(4);
    expect(v.etaVarianceDays).toBe(1);
    expect(v.valueGbp).toBe(12000);
  });

  it("computes a 40% quantity variance and 20-day delay for PO-10008", () => {
    const v = calc.calculate({
      po_id: "PO-10008",
      supplier: "Atlas",
      channel: "wholesale",
      sku: "SKU-SHOE-008",
      category: "Footwear",
      ordered_qty: 2000,
      confirmed_qty: 1200,
      expected_eta: "2026-06-08",
      eta: "2026-06-28",
      value_gbp: 125000,
      status: "delayed",
      parent_po_id: null
    });
    expect(v.quantityVariancePercent).toBe(40);
    expect(v.etaVarianceDays).toBe(20);
  });

  it("computes an 8% quantity variance and 0-day ETA for PO-10012", () => {
    const v = calc.calculate({
      po_id: "PO-10012",
      supplier: "Cobalt",
      channel: "retail",
      sku: "SKU-TOP-012",
      category: "Tops",
      ordered_qty: 1000,
      confirmed_qty: 920,
      expected_eta: "2026-06-12",
      eta: "2026-06-12",
      value_gbp: 18000,
      status: "confirmed",
      parent_po_id: null
    });
    expect(v.quantityVariancePercent).toBe(8);
    expect(v.etaVarianceDays).toBe(0);
  });

  it("rounds variance to two decimal places", () => {
    const v = calc.calculate({
      po_id: "PO-X",
      supplier: "X",
      channel: "retail",
      sku: "X",
      category: "X",
      ordered_qty: 333,
      confirmed_qty: 300,
      expected_eta: "2026-01-01",
      eta: "2026-01-01",
      value_gbp: 1000,
      status: "confirmed",
      parent_po_id: null
    });
    expect(v.quantityVariancePercent).toBe(9.91);
  });
});
