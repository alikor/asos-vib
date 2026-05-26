import OpenAI from "openai";
import type { EmbeddingClient } from "./EmbeddingClient.js";

export type OpenAiCompatibleEmbeddingClientConfig = {
  apiKey: string;
  baseUrl?: string;
  model: string;
};

export class OpenAiCompatibleEmbeddingClient implements EmbeddingClient {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(config: OpenAiCompatibleEmbeddingClientConfig) {
    this.client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl });
    this.model = config.model;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const response = await this.client.embeddings.create({
      model: this.model,
      input: texts
    });
    return response.data.map((item) => item.embedding);
  }
}
