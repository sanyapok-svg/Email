const encoder = new TextEncoder();

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export async function signSession(username: string, secret: string, ttlSeconds = 60 * 60 * 12): Promise<string> {
  const payload = bytesToBase64Url(
    encoder.encode(JSON.stringify({ u: username, exp: Date.now() + ttlSeconds * 1000 })),
  );
  const key = await hmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
  return `${payload}.${bytesToBase64Url(sig)}`;
}

export async function verifySession(token: string, secret: string): Promise<{ username: string } | null> {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const key = await hmacKey(secret);
  const signatureBytes = base64UrlToBytes(signature);
  const valid = await crypto.subtle.verify("HMAC", key, signatureBytes as BufferSource, encoder.encode(payload));
  if (!valid) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload))) as { u?: string; exp?: number };
    if (!data.u || !data.exp || data.exp < Date.now()) return null;
    return { username: data.u };
  } catch {
    return null;
  }
}
