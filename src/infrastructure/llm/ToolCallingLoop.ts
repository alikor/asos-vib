import { logger } from "../../shared/logger.js";
import type { AgentToolRegistry } from "../tools/AgentToolRegistry.js";
import type { LlmClient, LlmMessage } from "./LlmClient.js";

export type ToolCallingLoopInput = {
  messages: LlmMessage[];
  maxIterations: number;
};

export type ToolCallRecord = {
  toolName: string;
  argumentsJson: string;
  output: unknown;
};

export type ToolCallingLoopOutput = {
  messages: LlmMessage[];
  toolCalls: ToolCallRecord[];
  finalContent: string | null;
};

export class ToolCallingLoop {
  constructor(
    private readonly llm: LlmClient,
    private readonly toolRegistry: AgentToolRegistry
  ) {}

  async run(input: ToolCallingLoopInput): Promise<ToolCallingLoopOutput> {
    let messages: LlmMessage[] = [...input.messages];
    const toolCalls: ToolCallRecord[] = [];
    let finalContent: string | null = null;

    for (let iteration = 0; iteration < input.maxIterations; iteration += 1) {
      const response = await this.llm.complete({
        messages,
        tools: this.toolRegistry.definitions()
      });
      if (!response.toolCalls || response.toolCalls.length === 0) {
        finalContent = response.content;
        break;
      }
      messages = [
        ...messages,
        {
          role: "assistant",
          content: response.content,
          toolCalls: response.toolCalls
        }
      ];
      for (const call of response.toolCalls) {
        const tool = this.toolRegistry.get(call.name);
        if (!tool) {
          logger.warn("tool_unknown", { name: call.name });
          messages.push({
            role: "tool",
            name: call.name,
            toolCallId: call.id,
            content: JSON.stringify({ error: `Unknown tool: ${call.name}` })
          });
          continue;
        }
        let args: unknown;
        try {
          args = JSON.parse(call.argumentsJson || "{}");
        } catch (error) {
          messages.push({
            role: "tool",
            name: call.name,
            toolCallId: call.id,
            content: JSON.stringify({
              error: `Invalid JSON arguments: ${(error as Error).message}`
            })
          });
          continue;
        }
        try {
          const output = await tool.execute(args);
          toolCalls.push({ toolName: call.name, argumentsJson: call.argumentsJson, output });
          messages.push({
            role: "tool",
            name: call.name,
            toolCallId: call.id,
            content: JSON.stringify(output)
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logger.warn("tool_execution_failed", { name: call.name, message });
          messages.push({
            role: "tool",
            name: call.name,
            toolCallId: call.id,
            content: JSON.stringify({ error: message })
          });
        }
      }
    }

    return { messages, toolCalls, finalContent };
  }
}
