import "dotenv/config";
import { join, resolve } from "node:path";
import type { PolicyChunk } from "../src/domain/rag/PolicyChunk.js";
import type { EmbeddingClient } from "../src/infrastructure/embeddings/EmbeddingClient.js";
import { OpenAiCompatibleEmbeddingClient } from "../src/infrastructure/embeddings/OpenAiCompatibleEmbeddingClient.js";
import { MarkdownChunker } from "../src/infrastructure/rag/MarkdownChunker.js";
import { MarkdownCorpusLoader } from "../src/infrastructure/rag/MarkdownCorpusLoader.js";
import { VectorIndexPersister } from "../src/infrastructure/rag/VectorIndexPersister.js";
import { EscalationMatrixSanitizer } from "../src/infrastructure/security/EscalationMatrixSanitizer.js";
import { logger } from "../src/shared/logger.js";

export type BuildIndexInput = {
  corpusDir: string;
  indexPath: string;
  embeddingClient: EmbeddingClient;
  embeddingModel: string;
};

export const buildIndex = async (input: BuildIndexInput): Promise<void> => {
  const loader = new MarkdownCorpusLoader(input.corpusDir);
  const files = await loader.load();
  if (files.length === 0) {
    throw new Error(`No corpus files found at ${input.corpusDir}`);
  }
  const chunker = new MarkdownChunker(new EscalationMatrixSanitizer());
  const rawChunks = files.flatMap((file) => chunker.chunk(file));
  if (rawChunks.length === 0) {
    throw new Error("No chunks produced from corpus");
  }
  logger.info("embedding_chunks", { count: rawChunks.length, model: input.embeddingModel });
  const embeddings = await input.embeddingClient.embed(rawChunks.map((chunk) => chunk.safeText));
  if (embeddings.length !== rawChunks.length) {
    throw new Error(
      `Embedding count mismatch: ${embeddings.length} vs ${rawChunks.length} chunks`
    );
  }
  const chunks: PolicyChunk[] = rawChunks.map((chunk, i) => ({
    ...chunk,
    embedding: embeddings[i] ?? []
  }));
  const persister = new VectorIndexPersister(input.indexPath);
  await persister.save(chunks, input.embeddingModel);
  logger.info("index_built", { path: input.indexPath, count: chunks.length });
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL;
  const embeddingModel = process.env.EMBEDDING_MODEL ?? "text-embedding-3-small";
  if (!apiKey || apiKey === "replace-me") {
    process.stderr.write("OPENAI_API_KEY is required to build the vector index.\n");
    process.exit(1);
  }
  const root = resolve(process.cwd());
  const embeddingClient = new OpenAiCompatibleEmbeddingClient({
    apiKey,
    baseUrl,
    model: embeddingModel
  });
  buildIndex({
    corpusDir: join(root, "corpus"),
    indexPath: join(root, "storage", "vector-index.json"),
    embeddingClient,
    embeddingModel
  }).catch((error) => {
    process.stderr.write(
      `build-index failed: ${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exit(1);
  });
}
