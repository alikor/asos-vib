const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

export class PiiDetector {
  constructor(private readonly knownNames: string[]) {}

  containsEmail(text: string): boolean {
    return EMAIL_REGEX.test(text);
  }

  findEmail(text: string): string | null {
    const match = text.match(EMAIL_REGEX);
    return match ? match[0] : null;
  }

  containsKnownName(text: string): string | null {
    for (const name of this.knownNames) {
      const pattern = new RegExp(`\\b${escapeRegExp(name)}\\b`, "i");
      if (pattern.test(text)) return name;
    }
    return null;
  }

  containsAnyPii(text: string): boolean {
    return this.containsEmail(text) || this.containsKnownName(text) !== null;
  }
}

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
