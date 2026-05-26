import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

export type LoadedMarkdownFile = {
  docName: string;
  rawText: string;
};

export class MarkdownCorpusLoader {
  constructor(private readonly corpusDir: string) {}

  async load(): Promise<LoadedMarkdownFile[]> {
    const entries = await readdir(this.corpusDir);
    const files: LoadedMarkdownFile[] = [];
    for (const entry of entries) {
      if (!entry.endsWith(".md")) continue;
      const raw = await readFile(join(this.corpusDir, entry), "utf-8");
      files.push({ docName: entry, rawText: raw });
    }
    files.sort((a, b) => a.docName.localeCompare(b.docName));
    return files;
  }
}
