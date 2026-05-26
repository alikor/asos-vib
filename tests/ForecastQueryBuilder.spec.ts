import { describe, expect, it } from "vitest";
import { ForecastQueryBuilder } from "../src/application/queries/ForecastQueryBuilder.js";
import type { Forecast } from "../src/domain/purchase-orders/Forecast.js";

const sampleForecasts: Forecast[] = [
  {
    sku: "SKU-1",
    po_id: "PO-10001",
    forecast_qty: 120,
    actual_qty: 100,
    forecast_value_gbp: 1200,
    actual_value_gbp: 1000
  },
  {
    sku: "SKU-1",
    po_id: "PO-10002",
    forecast_qty: 140,
    actual_qty: 135,
    forecast_value_gbp: 1400,
    actual_value_gbp: 1350
  },
  {
    sku: "SKU-2",
    po_id: "PO-10001",
    forecast_qty: 80,
    actual_qty: 70,
    forecast_value_gbp: 800,
    actual_value_gbp: 700
  }
];

const makeDataSource = (rows: Forecast[]) => ({
  readAll: async () => rows
});

describe("ForecastQueryBuilder", () => {
  it("filters forecasts by sku and po id", async () => {
    const results = await new ForecastQueryBuilder(makeDataSource(sampleForecasts))
      .whereSku("SKU-1")
      .wherePoId("PO-10001")
      .execute();

    expect(results).toEqual([sampleForecasts[0]]);
  });

  it("returns all rows when no filters are provided", async () => {
    const results = await new ForecastQueryBuilder(makeDataSource(sampleForecasts)).execute();

    expect(results).toEqual(sampleForecasts);
  });

  it("returns the first matching row from executeOne", async () => {
    const result = await new ForecastQueryBuilder(makeDataSource(sampleForecasts))
      .whereSku("SKU-1")
      .executeOne();

    expect(result).toEqual(sampleForecasts[0]);
  });

  it("returns null from executeOne when nothing matches", async () => {
    const result = await new ForecastQueryBuilder(makeDataSource(sampleForecasts))
      .wherePoId("PO-99999")
      .executeOne();

    expect(result).toBeNull();
  });
});