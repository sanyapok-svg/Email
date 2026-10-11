import path from "path";
import { fileURLToPath } from "url";
import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.dirname(fileURLToPath(import.meta.url)),
  serverExternalPackages: ["imapflow", "mailparser", "iconv-lite", "@prisma/client"],
  webpack: (config, { isServer }) => {
    if (!isServer) return config;
    const current = config.externals;
    const list = Array.isArray(current) ? current : current ? [current] : [];
    config.externals = [
      ({ request }, callback) => {
        if (request === "nodemailer") {
          callback(null, "commonjs nodemailer");
          return;
        }
        callback();
      },
      ...list,
    ];
    return config;
  },
};

export default withWorkflow(nextConfig);
