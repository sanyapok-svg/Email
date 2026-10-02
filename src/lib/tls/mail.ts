import fs from "fs";
import os from "os";
import path from "path";
import tls from "tls";

export function mailTlsOptions(): { minVersion: "TLSv1.2"; ca?: string[] } {
  const extra = extraCertificates();
  if (!extra.length) return { minVersion: "TLSv1.2" };
  return { minVersion: "TLSv1.2", ca: [...tls.rootCertificates, ...extra] };
}

function extraCertificates(): string[] {
  const files = new Set<string>();
  if (process.env.NODE_EXTRA_CA_CERTS) files.add(process.env.NODE_EXTRA_CA_CERTS);
  const dir = path.join(os.homedir(), ".certs");
  if (fs.existsSync(dir)) {
    for (const name of fs.readdirSync(dir)) {
      if (name.endsWith(".pem") || name.endsWith(".crt")) files.add(path.join(dir, name));
    }
  }
  const pems: string[] = [];
  for (const file of files) {
    try {
      pems.push(fs.readFileSync(file, "utf8"));
    } catch {
      // An unreadable extra certificate is skipped; the public roots still apply.
    }
  }
  return pems;
}
