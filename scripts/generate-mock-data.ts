import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Forecast } from "../src/domain/purchase-orders/Forecast.js";
import type { PurchaseOrder } from "../src/domain/purchase-orders/PurchaseOrder.js";

const purchaseOrders: PurchaseOrder[] = [
  { po_id: "PO-10001", supplier: "Northline Textiles", channel: "retail", sku: "SKU-DRESS-001", category: "Dresses", ordered_qty: 1000, confirmed_qty: 960, expected_eta: "2026-06-10", eta: "2026-06-11", value_gbp: 12000, status: "confirmed", parent_po_id: null },
  { po_id: "PO-10002", supplier: "Brightline Apparel", channel: "retail", sku: "SKU-DRESS-002", category: "Dresses", ordered_qty: 800, confirmed_qty: 800, expected_eta: "2026-06-15", eta: "2026-06-15", value_gbp: 9500, status: "planned", parent_po_id: null },
  { po_id: "PO-10003", supplier: "Crestford Mills", channel: "wholesale", sku: "SKU-TOP-003", category: "Tops", ordered_qty: 1500, confirmed_qty: 1500, expected_eta: "2026-06-20", eta: "2026-06-20", value_gbp: 14500, status: "firmed", parent_po_id: null },
  { po_id: "PO-10004", supplier: "Dunbridge Knitwear", channel: "retail", sku: "SKU-TOP-004", category: "Tops", ordered_qty: 1200, confirmed_qty: 1140, expected_eta: "2026-06-22", eta: "2026-06-24", value_gbp: 13200, status: "confirmed", parent_po_id: null },
  { po_id: "PO-10005", supplier: "Eastvale Outerwear", channel: "retail", sku: "SKU-OUTER-005", category: "Outerwear", ordered_qty: 500, confirmed_qty: 480, expected_eta: "2026-07-01", eta: "2026-07-05", value_gbp: 17500, status: "partial", parent_po_id: null },
  { po_id: "PO-10006", supplier: "Foxglen Accessories", channel: "retail", sku: "SKU-ACC-006", category: "Accessories", ordered_qty: 2000, confirmed_qty: 1980, expected_eta: "2026-06-18", eta: "2026-06-19", value_gbp: 8000, status: "confirmed", parent_po_id: null },
  { po_id: "PO-10007", supplier: "Greylock Trading", channel: "wholesale", sku: "SKU-DRESS-007", category: "Dresses", ordered_qty: 1200, confirmed_qty: 1080, expected_eta: "2026-07-05", eta: "2026-07-12", value_gbp: 23000, status: "delayed", parent_po_id: null },
  { po_id: "PO-10008", supplier: "Atlas Footwear", channel: "wholesale", sku: "SKU-SHOE-008", category: "Footwear", ordered_qty: 2000, confirmed_qty: 1200, expected_eta: "2026-06-08", eta: "2026-06-28", value_gbp: 125000, status: "delayed", parent_po_id: null },
  { po_id: "PO-10009", supplier: "Harpswell Goods", channel: "retail", sku: "SKU-ACC-009", category: "Accessories", ordered_qty: 3000, confirmed_qty: 3000, expected_eta: "2026-06-25", eta: "2026-06-25", value_gbp: 11000, status: "planned", parent_po_id: null },
  { po_id: "PO-10010", supplier: "Inlet Apparel", channel: "retail", sku: "SKU-TOP-010", category: "Tops", ordered_qty: 1000, confirmed_qty: 700, expected_eta: "2026-06-30", eta: "2026-07-07", value_gbp: 9800, status: "partial", parent_po_id: null },
  { po_id: "PO-10011", supplier: "Jasper Mills", channel: "wholesale", sku: "SKU-OUTER-011", category: "Outerwear", ordered_qty: 600, confirmed_qty: 600, expected_eta: "2026-07-15", eta: "2026-07-15", value_gbp: 22000, status: "firmed", parent_po_id: null },
  { po_id: "PO-10012", supplier: "Cobalt Apparel", channel: "retail", sku: "SKU-TOP-012", category: "Tops", ordered_qty: 1000, confirmed_qty: 920, expected_eta: "2026-06-12", eta: "2026-06-12", value_gbp: 18000, status: "confirmed", parent_po_id: null },
  { po_id: "PO-10013", supplier: "Kingsmere Co", channel: "retail", sku: "SKU-DRESS-013", category: "Dresses", ordered_qty: 900, confirmed_qty: 855, expected_eta: "2026-07-01", eta: "2026-07-02", value_gbp: 10800, status: "confirmed", parent_po_id: null },
  { po_id: "PO-10014", supplier: "Larch Supply", channel: "wholesale", sku: "SKU-SHOE-014", category: "Footwear", ordered_qty: 1600, confirmed_qty: 1600, expected_eta: "2026-07-10", eta: "2026-07-10", value_gbp: 32000, status: "confirmed", parent_po_id: null },
  { po_id: "PO-10015", supplier: "Marigold Trading", channel: "retail", sku: "SKU-ACC-015", category: "Accessories", ordered_qty: 2500, confirmed_qty: 2375, expected_eta: "2026-06-28", eta: "2026-07-03", value_gbp: 9200, status: "partial", parent_po_id: null },
  { po_id: "PO-10016", supplier: "Northline Textiles", channel: "wholesale", sku: "SKU-OUTER-016", category: "Outerwear", ordered_qty: 750, confirmed_qty: 600, expected_eta: "2026-07-20", eta: "2026-07-22", value_gbp: 26000, status: "partial", parent_po_id: null },
  { po_id: "PO-10017", supplier: "Orchard Apparel", channel: "retail", sku: "SKU-TOP-017", category: "Tops", ordered_qty: 1100, confirmed_qty: 660, expected_eta: "2026-07-08", eta: "2026-07-08", value_gbp: 13750, status: "delayed", parent_po_id: null },
  { po_id: "PO-10018", supplier: "Penbrook Mills", channel: "retail", sku: "SKU-TOP-018", category: "Tops", ordered_qty: 600, confirmed_qty: 600, expected_eta: "2026-07-12", eta: "2026-07-12", value_gbp: 7200, status: "planned", parent_po_id: null },
  { po_id: "PO-10019", supplier: "Quayside Wholesale", channel: "wholesale", sku: "SKU-DRESS-019", category: "Dresses", ordered_qty: 1400, confirmed_qty: 1400, expected_eta: "2026-06-30", eta: "2026-06-30", value_gbp: 19500, status: "firmed", parent_po_id: null },
  { po_id: "PO-10020", supplier: "Riverbend Co", channel: "retail", sku: "SKU-OUTER-020", category: "Outerwear", ordered_qty: 400, confirmed_qty: 200, expected_eta: "2026-07-25", eta: "2026-07-25", value_gbp: 14000, status: "partial", parent_po_id: "PO-10005" }
];

const forecasts: Forecast[] = [
  { sku: "SKU-DRESS-001", po_id: "PO-10001", forecast_qty: 1000, actual_qty: 960, forecast_value_gbp: 12500, actual_value_gbp: 12000 },
  { sku: "SKU-DRESS-002", po_id: "PO-10002", forecast_qty: 800, actual_qty: 0, forecast_value_gbp: 9500, actual_value_gbp: 0 },
  { sku: "SKU-TOP-003", po_id: "PO-10003", forecast_qty: 1500, actual_qty: 0, forecast_value_gbp: 14500, actual_value_gbp: 0 },
  { sku: "SKU-TOP-004", po_id: "PO-10004", forecast_qty: 1200, actual_qty: 1140, forecast_value_gbp: 13800, actual_value_gbp: 13200 },
  { sku: "SKU-OUTER-005", po_id: "PO-10005", forecast_qty: 500, actual_qty: 480, forecast_value_gbp: 18000, actual_value_gbp: 17500 },
  { sku: "SKU-ACC-006", po_id: "PO-10006", forecast_qty: 2000, actual_qty: 1980, forecast_value_gbp: 8100, actual_value_gbp: 8000 },
  { sku: "SKU-DRESS-007", po_id: "PO-10007", forecast_qty: 1200, actual_qty: 1080, forecast_value_gbp: 24000, actual_value_gbp: 23000 },
  { sku: "SKU-SHOE-008", po_id: "PO-10008", forecast_qty: 2000, actual_qty: 1200, forecast_value_gbp: 130000, actual_value_gbp: 125000 },
  { sku: "SKU-ACC-009", po_id: "PO-10009", forecast_qty: 3000, actual_qty: 0, forecast_value_gbp: 11000, actual_value_gbp: 0 },
  { sku: "SKU-TOP-010", po_id: "PO-10010", forecast_qty: 1000, actual_qty: 700, forecast_value_gbp: 10000, actual_value_gbp: 9800 },
  { sku: "SKU-OUTER-011", po_id: "PO-10011", forecast_qty: 600, actual_qty: 0, forecast_value_gbp: 22000, actual_value_gbp: 0 },
  { sku: "SKU-TOP-012", po_id: "PO-10012", forecast_qty: 1000, actual_qty: 920, forecast_value_gbp: 18500, actual_value_gbp: 18000 },
  { sku: "SKU-DRESS-013", po_id: "PO-10013", forecast_qty: 900, actual_qty: 855, forecast_value_gbp: 11000, actual_value_gbp: 10800 },
  { sku: "SKU-SHOE-014", po_id: "PO-10014", forecast_qty: 1600, actual_qty: 1600, forecast_value_gbp: 32500, actual_value_gbp: 32000 },
  { sku: "SKU-ACC-015", po_id: "PO-10015", forecast_qty: 2500, actual_qty: 2375, forecast_value_gbp: 9500, actual_value_gbp: 9200 },
  { sku: "SKU-OUTER-016", po_id: "PO-10016", forecast_qty: 750, actual_qty: 600, forecast_value_gbp: 27000, actual_value_gbp: 26000 },
  { sku: "SKU-TOP-017", po_id: "PO-10017", forecast_qty: 1100, actual_qty: 660, forecast_value_gbp: 14000, actual_value_gbp: 13750 },
  { sku: "SKU-TOP-018", po_id: "PO-10018", forecast_qty: 600, actual_qty: 0, forecast_value_gbp: 7200, actual_value_gbp: 0 },
  { sku: "SKU-DRESS-019", po_id: "PO-10019", forecast_qty: 1400, actual_qty: 0, forecast_value_gbp: 19500, actual_value_gbp: 0 },
  { sku: "SKU-OUTER-020", po_id: "PO-10020", forecast_qty: 400, actual_qty: 200, forecast_value_gbp: 14500, actual_value_gbp: 14000 }
];

export const seedData = async (dataDir: string): Promise<void> => {
  await mkdir(dataDir, { recursive: true });
  await writeFile(
    join(dataDir, "purchase_orders.json"),
    `${JSON.stringify(purchaseOrders, null, 2)}\n`,
    "utf-8"
  );
  await writeFile(
    join(dataDir, "forecasts.json"),
    `${JSON.stringify(forecasts, null, 2)}\n`,
    "utf-8"
  );
  process.stdout.write(`wrote ${join(dataDir, "purchase_orders.json")} (${purchaseOrders.length} POs)\n`);
  process.stdout.write(`wrote ${join(dataDir, "forecasts.json")} (${forecasts.length} forecasts)\n`);
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const dataDir = resolve(process.cwd(), "data");
  seedData(dataDir).catch((error) => {
    process.stderr.write(
      `seed:data failed: ${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exit(1);
  });
}
