import type { PolicyChunk, PolicyChunkSearchResult } from "../../domain/rag/PolicyChunk.js";

export interface VectorIndex {
  search(input: {
    queryEmbedding: number[];
    topK: number;
    minScore: number;
  }): PolicyChunkSearchResult[];
  all(): PolicyChunk[];
}

export class InMemoryVectorIndex implements VectorIndex {
  constructor(private readonly chunks: PolicyChunk[]) {}

  all(): PolicyChunk[] {
    return this.chunks;
  }

  search(input: {
    queryEmbedding: number[];
    topK: number;
    minScore: number;
  }): PolicyChunkSearchResult[] {
    const scored: PolicyChunkSearchResult[] = this.chunks.map((chunk) => ({
      chunk,
      score: cosineSimilarity(chunk.embedding, input.queryEmbedding)
    }));
    return scored
      .filter((result) => result.score >= input.minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, input.topK);
  }
}

export const cosineSimilarity = (a: number[], b: number[]): number => {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    magA += ai * ai;
    magB += bi * bi;
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
};
