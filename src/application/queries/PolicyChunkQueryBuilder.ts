import type { PolicyChunkSearchResult } from "../../domain/rag/PolicyChunk.js";
import type { EmbeddingClient } from "../../infrastructure/embeddings/EmbeddingClient.js";
import type { VectorIndex } from "../../infrastructure/rag/InMemoryVectorIndex.js";

export class PolicyChunkQueryBuilder {
  private query?: string;
  private topK = 6;
  private minScore = 0;

  constructor(
    private readonly vectorIndex: VectorIndex,
    private readonly embeddingClient: EmbeddingClient
  ) {}

  withQuery(query: string): this {
    this.query = query;
    return this;
  }

  withTopK(topK: number): this {
    this.topK = topK;
    return this;
  }

  withMinScore(score: number): this {
    this.minScore = score;
    return this;
  }

  async execute(): Promise<PolicyChunkSearchResult[]> {
    if (!this.query || this.query.trim().length === 0) return [];
    const embeddings = await this.embeddingClient.embed([this.query]);
    const queryEmbedding = embeddings[0];
    if (!queryEmbedding) return [];
    return this.vectorIndex.search({
      queryEmbedding,
      topK: this.topK,
      minScore: this.minScore
    });
  }
}

export interface PolicyChunkQueryBuilderFactory {
  create(): PolicyChunkQueryBuilder;
}

export class DefaultPolicyChunkQueryBuilderFactory implements PolicyChunkQueryBuilderFactory {
  constructor(
    private readonly vectorIndex: VectorIndex,
    private readonly embeddingClient: EmbeddingClient
  ) {}

  create(): PolicyChunkQueryBuilder {
    return new PolicyChunkQueryBuilder(this.vectorIndex, this.embeddingClient);
  }
}
