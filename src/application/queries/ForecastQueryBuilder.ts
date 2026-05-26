import type { Forecast } from "../../domain/purchase-orders/Forecast.js";
import type { JsonFileDataSource } from "../../infrastructure/persistence/JsonFileDataSource.js";

export class ForecastQueryBuilder {
  private sku?: string;
  private poId?: string;

  constructor(private readonly dataSource: JsonFileDataSource<Forecast>) {}

  whereSku(sku: string): this {
    this.sku = sku;
    return this;
  }

  wherePoId(poId: string): this {
    this.poId = poId;
    return this;
  }

  async execute(): Promise<Forecast[]> {
    let rows = await this.dataSource.readAll();
    if (this.sku) rows = rows.filter((row) => row.sku === this.sku);
    if (this.poId) rows = rows.filter((row) => row.po_id === this.poId);
    return rows;
  }

  async executeOne(): Promise<Forecast | null> {
    const rows = await this.execute();
    return rows[0] ?? null;
  }
}
