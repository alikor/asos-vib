export interface EmbeddingClient {
  embed(texts: string[]): Promise<number[][]>;
}
