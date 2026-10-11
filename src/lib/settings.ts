import { prisma } from "@/lib/db";

export async function getIntegrationConfig(accountId: string) {
  return prisma.integrationConfig.upsert({
    where: { accountId },
    create: { accountId },
    update: {},
  });
}
