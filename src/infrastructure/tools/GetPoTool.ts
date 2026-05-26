import { z } from "zod";
import { PurchaseOrderQueryBuilder } from "../../application/queries/PurchaseOrderQueryBuilder.js";
import type { PurchaseOrder } from "../../domain/purchase-orders/PurchaseOrder.js";
import type { JsonFileDataSource } from "../persistence/JsonFileDataSource.js";
import type { AgentTool, ToolDefinition } from "./AgentTool.js";

export const GetPoInputSchema = z.object({ po_id: z.string().regex(/^PO-\d+$/i) });
export type GetPoInput = z.infer<typeof GetPoInputSchema>;
export type GetPoOutput = { found: boolean; po?: PurchaseOrder };

export const getPoToolDefinition: ToolDefinition = {
  name: "get_po",
  description:
    "Look up a purchase order by PO id from the local mock purchase_orders.json dataset.",
  parameters: {
    type: "object",
    additionalProperties: false,
    required: ["po_id"],
    properties: {
      po_id: {
        type: "string",
        description: "Purchase order id, for example PO-10001"
      }
    }
  }
};

export class GetPoTool implements AgentTool<GetPoInput, GetPoOutput> {
  readonly name = "get_po";
  readonly definition = getPoToolDefinition;

  constructor(private readonly dataSource: JsonFileDataSource<PurchaseOrder>) {}

  async execute(input: GetPoInput): Promise<GetPoOutput> {
    const parsed = GetPoInputSchema.parse(input);
    const po = await new PurchaseOrderQueryBuilder(this.dataSource)
      .wherePoId(parsed.po_id.toUpperCase())
      .executeOne();
    return po ? { found: true, po } : { found: false };
  }
}
