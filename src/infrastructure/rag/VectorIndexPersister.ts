import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { existsSync } from "node:fs";
import type { PolicyChunk } from "../../domain/rag/PolicyChunk.js";

type PersistedShape = {
  builtAt: string;
  embeddingModel: string;
  chunks: PolicyChunk[];
};

export class VectorIndexPersister {
  constructor(private readonly filePath: string) {}

  exists(): boolean {
    return existsSync(this.filePath);
  }

  async load(): Promise<PolicyChunk[]> {
    if (!existsSync(this.filePath)) {
      throw new Error(`Vector index not found at ${this.filePath}. Run pnpm index first.`);
    }
    const raw = await readFile(this.filePath, "utf-8");
    const parsed = JSON.parse(raw) as PersistedShape;
    return parsed.chunks;
  }

  async save(chunks: PolicyChunk[], embeddingModel: string): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const payload: PersistedShape = {
      builtAt: new Date().toISOString(),
      embeddingModel,
      chunks
    };
    await writeFile(this.filePath, JSON.stringify(payload, null, 2), "utf-8");
  }
}
