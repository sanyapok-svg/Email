import path from "path";
import { fileURLToPath } from "url";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.dirname(fileURLToPath(import.meta.url)),
  serverExternalPackages: ["imapflow", "mailparser", "nodemailer", "iconv-lite"],
};

export default nextConfig;
