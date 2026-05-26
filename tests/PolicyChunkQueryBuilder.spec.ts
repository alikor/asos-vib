import { describe, expect, it } from "vitest";
import { PolicyChunkQueryBuilder } from "../src/application/queries/PolicyChunkQueryBuilder.js";
import { InMemoryVectorIndex } from "../src/infrastructure/rag/InMemoryVectorIndex.js";
import type { EmbeddingClient } from "../src/infrastructure/embeddings/EmbeddingClient.js";
import type { PolicyChunk } from "../src/domain/rag/PolicyChunk.js";

const makeChunk = (id: string, embedding: number[]): PolicyChunk => ({
  id,
  docName: "doc.md",
  section: id,
  citation: `doc.md ${id}`,
  rawText: id,
  safeText: id,
  embedding
});

const stubEmbedding = (vector: number[]): EmbeddingClient => ({
  embed: async () => [vector]
});

describe("PolicyChunkQueryBuilder", () => {
  it("returns chunks sorted by cosine score and respects topK", async () => {
    const index = new InMemoryVectorIndex([
      makeChunk("§1", [1, 0, 0]),
      makeChunk("§2", [0.9, 0.1, 0]),
      makeChunk("§3", [0, 1, 0])
    ]);
    const results = await new PolicyChunkQueryBuilder(index, stubEmbedding([1, 0, 0]))
      .withQuery("anything")
      .withTopK(2)
      .withMinScore(0.5)
      .execute();
    expect(results).toHaveLength(2);
    expect(results[0]?.chunk.id).toBe("§1");
    expect(results[1]?.chunk.id).toBe("§2");
  });

  it("filters out chunks below minScore", async () => {
    const index = new InMemoryVectorIndex([
      makeChunk("§1", [1, 0, 0]),
      makeChunk("§2", [0, 1, 0])
    ]);
    const results = await new PolicyChunkQueryBuilder(index, stubEmbedding([1, 0, 0]))
      .withQuery("anything")
      .withTopK(5)
      .withMinScore(0.9)
      .execute();
    expect(results).toHaveLength(1);
    expect(results[0]?.chunk.id).toBe("§1");
  });

  it("returns empty when query is blank", async () => {
    const index = new InMemoryVectorIndex([makeChunk("§1", [1, 0])]);
    const results = await new PolicyChunkQueryBuilder(index, stubEmbedding([1, 0]))
      .withQuery("")
      .execute();
    expect(results).toEqual([]);
  });
});
