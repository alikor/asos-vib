const TABLE_ROW = /^\|(.+)\|$/;

export type SanitisedEscalationMatrix = {
  safeText: string;
  knownNames: string[];
  knownEmails: string[];
};

export class EscalationMatrixSanitizer {
  sanitize(rawMarkdown: string): SanitisedEscalationMatrix {
    const lines = rawMarkdown.split("\n");
    const safeLines: string[] = [];
    const knownNames: string[] = [];
    const knownEmails: string[] = [];

    for (const line of lines) {
      const match = TABLE_ROW.exec(line.trim());
      if (!match) {
        safeLines.push(line);
        continue;
      }
      const cells = match[1]!.split("|").map((cell) => cell.trim());
      if (cells.length < 5) {
        safeLines.push(line);
        continue;
      }
      if (this.isSeparatorRow(cells)) {
        safeLines.push(this.buildSeparator(cells.length));
        continue;
      }
      if (this.looksLikeHeader(cells)) {
        safeLines.push(this.buildHeader());
        continue;
      }
      const [category, valueBand, role, name, email] = cells;
      if (name) knownNames.push(name);
      if (email && email.includes("@")) knownEmails.push(email);
      safeLines.push(`| ${category} | ${valueBand} | ${role} | [REDACTED] | [REDACTED] |`);
    }

    return {
      safeText: safeLines.join("\n"),
      knownNames: Array.from(new Set(knownNames)),
      knownEmails: Array.from(new Set(knownEmails))
    };
  }

  private isSeparatorRow(cells: string[]): boolean {
    return cells.every((cell) => /^:?-+:?$/.test(cell));
  }

  private buildSeparator(width: number): string {
    return `|${Array.from({ length: width }, () => "---").join("|")}|`;
  }

  private looksLikeHeader(cells: string[]): boolean {
    return cells.some((cell) => /name/i.test(cell)) && cells.some((cell) => /email/i.test(cell));
  }

  private buildHeader(): string {
    return "| Category | Value Band | Escalation Role | Name | Email |";
  }
}
