export type ToolDefinition = {
  name: string;
  description: string;
  parameters: unknown;
};

export interface AgentTool<TInput = unknown, TOutput = unknown> {
  readonly name: string;
  readonly definition: ToolDefinition;
  execute(input: TInput): Promise<TOutput>;
}
