import { describe, expect, it } from "vitest";
import { MarkdownChunker } from "../src/infrastructure/rag/MarkdownChunker.js";
import { EscalationMatrixSanitizer } from "../src/infrastructure/security/EscalationMatrixSanitizer.js";

describe("MarkdownChunker", () => {
  const chunker = new MarkdownChunker(new EscalationMatrixSanitizer());

  it("splits a Markdown doc by §N headings and produces citations", () => {
    const chunks = chunker.chunk({
      docName: "po_amendment_policy.md",
      rawText: "# Title\n\n## §1 Purpose\n\nFirst body.\n\n## §3 Thresholds\n\nThreshold body."
    });
    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.citation).toBe("po_amendment_policy.md §1");
    expect(chunks[1]?.citation).toBe("po_amendment_policy.md §3");
    expect(chunks[1]?.safeText).toContain("Threshold body.");
  });

  it("sanitises the escalation matrix so safeText drops names and emails", () => {
    const matrix = `# Merch Escalation Matrix\n\n## §2 Value Band Escalation\n\n| Category | Value Band | Escalation Role | Name | Email |\n|---|---:|---|---|---|\n| Dresses | £0-£20,000 | Senior Merch Planner | Alice Example | alice.example@asos.invalid |\n`;
    const chunks = chunker.chunk({
      docName: "merch_escalation_matrix.md",
      rawText: matrix
    });
    expect(chunks).toHaveLength(1);
    const safe = chunks[0]?.safeText ?? "";
    expect(safe).not.toContain("Alice Example");
    expect(safe).not.toContain("alice.example@asos.invalid");
    expect(safe).toContain("[REDACTED]");
    const raw = chunks[0]?.rawText ?? "";
    expect(raw).toContain("Alice Example");
  });
});
