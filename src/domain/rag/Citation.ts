export type Citation = string;

const CITATION_PATTERN = /^[a-z0-9_\-]+\.md §[0-9]+(?: .*)?$/i;

export const isValidCitation = (value: string): boolean =>
  CITATION_PATTERN.test(value.trim());

export const normaliseCitation = (value: string): string => value.trim();
