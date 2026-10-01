import { prisma } from "@/lib/db";

export async function getIntegrationConfig() {
  return prisma.integrationConfig.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });
}
