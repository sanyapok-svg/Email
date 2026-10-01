import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

function encryptionKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error("ENCRYPTION_KEY не задан");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY должен быть 32 байтами в base64");
  }
  return key;
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptSecret(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  if (buf.length < 29) {
    throw new Error("Повреждённый секрет");
  }
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function maskSecret(value: string | null | undefined): string {
  if (!value) return "";
  return "••••••••";
}
