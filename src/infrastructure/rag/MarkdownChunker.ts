import { EscalationMatrixSanitizer } from "../security/EscalationMatrixSanitizer.js";
import type { LoadedMarkdownFile } from "./MarkdownCorpusLoader.js";

export type RawChunk = {
  id: string;
  docName: string;
  section: string;
  citation: string;
  rawText: string;
  safeText: string;
};

const SECTION_HEADING = /^##\s+(§\d+)([^\n]*)$/m;

export class MarkdownChunker {
  constructor(private readonly sanitizer: EscalationMatrixSanitizer) {}

  chunk(file: LoadedMarkdownFile): RawChunk[] {
    const safeSource =
      file.docName === "merch_escalation_matrix.md"
        ? this.sanitizer.sanitize(file.rawText).safeText
        : file.rawText;
    const rawSections = this.splitSections(file.rawText);
    const safeSections = this.splitSections(safeSource);
    const chunks: RawChunk[] = [];
    for (const rawSection of rawSections) {
      const safeMatch = safeSections.find((s) => s.section === rawSection.section);
      const safeText = safeMatch?.body ?? rawSection.body;
      const citation = `${file.docName} ${rawSection.section}`;
      chunks.push({
        id: `${file.docName}:${rawSection.section}`,
        docName: file.docName,
        section: rawSection.heading,
        citation,
        rawText: `${rawSection.heading}\n\n${rawSection.body}`.trim(),
        safeText: `${rawSection.heading}\n\n${safeText}`.trim()
      });
    }
    return chunks;
  }

  private splitSections(
    markdown: string
  ): Array<{ section: string; heading: string; body: string }> {
    const lines = markdown.split("\n");
    const sections: Array<{ section: string; heading: string; body: string }> = [];
    let current: { section: string; heading: string; body: string } | null = null;
    for (const line of lines) {
      const match = SECTION_HEADING.exec(line);
      if (match) {
        if (current) sections.push({ ...current, body: current.body.trim() });
        current = {
          section: match[1]!,
          heading: line.trim(),
          body: ""
        };
        continue;
      }
      if (current) current.body += `${line}\n`;
    }
    if (current) sections.push({ ...current, body: current.body.trim() });
    return sections;
  }
}
