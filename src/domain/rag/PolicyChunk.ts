export type PolicyChunk = {
  id: string;
  docName: string;
  section: string;
  citation: string;
  rawText: string;
  safeText: string;
  embedding: number[];
};

export type PolicyChunkSearchResult = {
  chunk: PolicyChunk;
  score: number;
};
