import { readFile } from "node:fs/promises";

export class JsonFileDataSource<T> {
  constructor(private readonly filePath: string) {}

  async readAll(): Promise<T[]> {
    const raw = await readFile(this.filePath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error(`Expected JSON array at ${this.filePath}`);
    }
    return parsed as T[];
  }
}
