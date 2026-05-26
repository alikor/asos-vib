import { z } from "zod";
import { ForecastQueryBuilder } from "../../application/queries/ForecastQueryBuilder.js";
import type { Forecast } from "../../domain/purchase-orders/Forecast.js";
import type { JsonFileDataSource } from "../persistence/JsonFileDataSource.js";
import type { AgentTool, ToolDefinition } from "./AgentTool.js";

export const GetForecastInputSchema = z.object({ sku: z.string().min(1) });
export type GetForecastInput = z.infer<typeof GetForecastInputSchema>;
export type GetForecastOutput = { found: boolean; forecasts: Forecast[] };

export const getForecastToolDefinition: ToolDefinition = {
  name: "get_forecast",
  description: "Look up forecast-vs-actual data for a SKU from the local mock forecasts dataset.",
  parameters: {
    type: "object",
    additionalProperties: false,
    required: ["sku"],
    properties: {
      sku: {
        type: "string",
        description: "SKU id, for example SKU-DRESS-001"
      }
    }
  }
};

export class GetForecastTool implements AgentTool<GetForecastInput, GetForecastOutput> {
  readonly name = "get_forecast";
  readonly definition = getForecastToolDefinition;

  constructor(private readonly dataSource: JsonFileDataSource<Forecast>) {}

  async execute(input: GetForecastInput): Promise<GetForecastOutput> {
    const parsed = GetForecastInputSchema.parse(input);
    const forecasts = await new ForecastQueryBuilder(this.dataSource).whereSku(parsed.sku).execute();
    return { found: forecasts.length > 0, forecasts };
  }
}
