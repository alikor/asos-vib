import OpenAI from "openai";
import type {
  LlmClient,
  LlmMessage,
  LlmResponse,
  LlmResponseFormat,
  LlmToolCall,
  LlmToolDefinition
} from "./LlmClient.js";

export type OpenAiCompatibleLlmClientConfig = {
  apiKey: string;
  baseUrl?: string;
  model: string;
};

export class OpenAiCompatibleLlmClient implements LlmClient {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(config: OpenAiCompatibleLlmClientConfig) {
    this.client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl });
    this.model = config.model;
  }

  async complete(input: {
    messages: LlmMessage[];
    tools?: LlmToolDefinition[];
    responseFormat?: LlmResponseFormat;
  }): Promise<LlmResponse> {
    const messages = input.messages.map(this.toOpenAiMessage);
    const tools = input.tools?.map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters as Record<string, unknown>
      }
    }));
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
      tools,
      tool_choice: tools && tools.length > 0 ? "auto" : undefined,
      response_format: input.responseFormat,
      temperature: 0
    });
    const choice = response.choices[0];
    if (!choice) return { content: null, toolCalls: [] };
    const content = choice.message.content ?? null;
    const toolCalls: LlmToolCall[] = (choice.message.tool_calls ?? []).map((call) => ({
      id: call.id,
      name: call.function.name,
      argumentsJson: call.function.arguments ?? "{}"
    }));
    return { content, toolCalls };
  }

  private toOpenAiMessage(
    message: LlmMessage
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam {
    switch (message.role) {
      case "system":
        return { role: "system", content: message.content };
      case "user":
        return { role: "user", content: message.content };
      case "assistant":
        return {
          role: "assistant",
          content: message.content,
          tool_calls: message.toolCalls?.map((call) => ({
            id: call.id,
            type: "function",
            function: { name: call.name, arguments: call.argumentsJson }
          }))
        };
      case "tool":
        return {
          role: "tool",
          content: message.content,
          tool_call_id: message.toolCallId
        };
    }
  }
}
