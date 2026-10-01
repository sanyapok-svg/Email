import iconv from "iconv-lite";

export function decodeTransfer(content: Buffer, encoding?: string | null): Buffer {
  const enc = (encoding || "7bit").toLowerCase().trim();
  if (enc === "base64") {
    const compact = content.toString("utf8").replace(/\s+/g, "");
    return Buffer.from(compact, "base64");
  }
  if (enc === "quoted-printable") return decodeQuotedPrintable(content);
  return content;
}

export function decodeQuotedPrintable(content: Buffer): Buffer {
  const source = content.toString("latin1").replace(/=\r?\n/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < source.length; i += 1) {
    if (source[i] === "=" && /^[0-9A-Fa-f]{2}$/.test(source.slice(i + 1, i + 3))) {
      bytes.push(Number.parseInt(source.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(source.charCodeAt(i) & 0xff);
    }
  }
  return Buffer.from(bytes);
}

export function decodeCharset(content: Buffer, charset?: string | null): string {
  const name = normalizeCharset(charset);
  if (!iconv.encodingExists(name)) return iconv.decode(content, "utf8");
  return iconv.decode(content, name);
}

export function decodeMimePart(content: Buffer, encoding?: string | null, charset?: string | null): string {
  return decodeCharset(decodeTransfer(content, encoding), charset);
}

function normalizeCharset(charset?: string | null): string {
  const value = (charset || "utf-8").trim().toLowerCase().replace(/['"]/g, "");
  if (value === "utf8") return "utf-8";
  if (value === "cp1251" || value === "windows1251" || value === "win-1251") return "windows-1251";
  if (value === "iso8859-5") return "iso-8859-5";
  return value;
}
