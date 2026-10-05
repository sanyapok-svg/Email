import path from "path";
import { fileURLToPath } from "url";
import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.dirname(fileURLToPath(import.meta.url)),
  serverExternalPackages: ["imapflow", "mailparser", "iconv-lite", "@prisma/client"],
};

export default withWorkflow(nextConfig);
