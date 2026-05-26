import type {
  PurchaseOrder,
  PurchaseOrderStatus
} from "../../domain/purchase-orders/PurchaseOrder.js";
import type { JsonFileDataSource } from "../../infrastructure/persistence/JsonFileDataSource.js";

export class PurchaseOrderQueryBuilder {
  private poId?: string;
  private supplier?: string;
  private status?: PurchaseOrderStatus;
  private sku?: string;

  constructor(private readonly dataSource: JsonFileDataSource<PurchaseOrder>) {}

  wherePoId(poId: string): this {
    this.poId = poId;
    return this;
  }

  whereSupplier(supplier: string): this {
    this.supplier = supplier;
    return this;
  }

  whereStatus(status: PurchaseOrderStatus): this {
    this.status = status;
    return this;
  }

  whereSku(sku: string): this {
    this.sku = sku;
    return this;
  }

  async execute(): Promise<PurchaseOrder[]> {
    let rows = await this.dataSource.readAll();
    if (this.poId) rows = rows.filter((row) => row.po_id === this.poId);
    if (this.supplier) rows = rows.filter((row) => row.supplier === this.supplier);
    if (this.status) rows = rows.filter((row) => row.status === this.status);
    if (this.sku) rows = rows.filter((row) => row.sku === this.sku);
    return rows;
  }

  async executeOne(): Promise<PurchaseOrder | null> {
    const rows = await this.execute();
    return rows[0] ?? null;
  }
}
