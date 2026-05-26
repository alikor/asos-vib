export type LlmMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; toolCalls?: LlmToolCall[] }
  | { role: "tool"; content: string; toolCallId: string; name: string };

export type LlmToolCall = {
  id: string;
  name: string;
  argumentsJson: string;
};

export type LlmResponse = {
  content: string | null;
  toolCalls: LlmToolCall[];
};

export type LlmToolDefinition = {
  name: string;
  description: string;
  parameters: unknown;
};

export type LlmResponseFormat = { type: "json_object" } | { type: "text" };

export interface LlmClient {
  complete(input: {
    messages: LlmMessage[];
    tools?: LlmToolDefinition[];
    responseFormat?: LlmResponseFormat;
  }): Promise<LlmResponse>;
}
