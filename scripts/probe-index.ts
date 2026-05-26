import "dotenv/config";
import { join } from "node:path";
import { OpenAiCompatibleEmbeddingClient } from "../src/infrastructure/embeddings/OpenAiCompatibleEmbeddingClient.js";
import { InMemoryVectorIndex } from "../src/infrastructure/rag/InMemoryVectorIndex.js";
import { VectorIndexPersister } from "../src/infrastructure/rag/VectorIndexPersister.js";

const main = async (): Promise<void> => {
  const chunks = await new VectorIndexPersister(
    join(process.cwd(), "storage", "vector-index.json")
  ).load();
  const index = new InMemoryVectorIndex(chunks);
  const embedder = new OpenAiCompatibleEmbeddingClient({
    apiKey: process.env.OPENAI_API_KEY ?? "",
    baseUrl: process.env.OPENAI_BASE_URL,
    model: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small"
  });
  const queries = [
    "Please triage PO-10001. Supplier confirmed fewer units than ordered.",
    "Triage PO-10008. It has a major short shipment and supplier delay.",
    "Can we amend PO-10012 in-place? It has an 8% quantity variance."
  ];
  for (const q of queries) {
    const [emb] = await embedder.embed([q]);
    const top = index.search({ queryEmbedding: emb ?? [], topK: 6, minScore: 0 });
    console.log(`\nQ: ${q}`);
    for (const result of top) {
      console.log(`  ${result.score.toFixed(3)}  ${result.chunk.citation}`);
    }
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
