const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, body: string) => {
    if (body.startsWith("#x") || body.startsWith("#X")) {
      const code = Number.parseInt(body.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : entity;
    }
    if (body.startsWith("#")) {
      const code = Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : entity;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? entity;
  });
}

export function extractHrefs(html: string): string[] {
  return [...html.matchAll(/\bhref\s*=\s*["']([^"']+)["']/gi)]
    .map((match) => match[1].trim())
    .filter((href) => /^https?:\/\//i.test(href) || href.startsWith("www."));
}

export function htmlToText(html: string): string {
  const withoutDanger = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<img\b[^>]*>/gi, " ");
  const withBreaks = withoutDanger
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|tr|li|h[1-6]|blockquote|table)\s*>/gi, "\n")
    .replace(/<\s*li\b[^>]*>/gi, "\n- ");
  const stripped = withBreaks.replace(/<[^>]+>/g, " ");
  return normalizeWhitespace(decodeHtmlEntities(stripped));
}

export function normalizeWhitespace(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export type QuoteSplit = {
  fullText: string;
  newText: string;
  confidence: "high" | "low";
};

const QUOTE_LINE =
  /^(?:>+|On .+wrote:|-{2,}\s*Original Message\s*-{2,}|-{2,}\s*Пересылаемое сообщение\s*-{2,}|-{2,}\s*Исходное сообщение\s*-{2,}|_{10,}|Begin forwarded message:)/i;

function isOutlookQuoteStart(lines: string[], index: number): boolean {
  const current = lines[index]?.trim() ?? "";
  if (!/^(from|от)\s*:/i.test(current)) return false;
  const window = lines.slice(index, index + 6).join("\n");
  return /(sent|отправлено|date|дата)\s*:/i.test(window) && /(subject|тема)\s*:/i.test(window);
}

export function splitQuotedText(text: string): QuoteSplit {
  const fullText = normalizeWhitespace(text);
  if (!fullText) return { fullText: "", newText: "", confidence: "high" };
  const lines = fullText.split("\n");
  let cut = -1;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (QUOTE_LINE.test(line) || isOutlookQuoteStart(lines, i)) {
      cut = i;
      break;
    }
  }
  if (cut < 0) return { fullText, newText: fullText, confidence: "high" };
  const head = normalizeWhitespace(lines.slice(0, cut).join("\n"));
  if (!head) return { fullText, newText: fullText, confidence: "low" };
  return { fullText, newText: head, confidence: "high" };
}

export function makePreview(text: string, limit = 400): string {
  const normalized = normalizeWhitespace(text);
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit).trimEnd()}…`;
}

export function truncateText(text: string, limit: number): { text: string; truncated: boolean } {
  if (text.length <= limit) return { text, truncated: false };
  return { text: text.slice(0, limit), truncated: true };
}
