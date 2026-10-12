import type { PrismaClient } from "../../prisma/generated/prisma/client";

type BusinessAccessDb = Pick<
  PrismaClient,
  "business_owner" | "business_owner_2_business"
>;

export async function requireOwnerBusinessLink(
  db: BusinessAccessDb,
  visitorAccountId: number,
  businessId: number
) {
  const owner = await db.business_owner.findFirst({
    where: { VISITORS_ACCOUNT_ID: visitorAccountId },
    select: { BUSINESS_OWNER_ID: true },
  });
  if (!owner) throw new Error("Forbidden");

  const access = await db.business_owner_2_business.findFirst({
    where: {
      BUSINESS_OWNER_ID: BigInt(owner.BUSINESS_OWNER_ID),
      BUSINESS_ID: BigInt(businessId),
    },
    select: { BUSINESS_OWNER_2_BUSINESS_ID: true },
  });
  if (!access) throw new Error("Forbidden");
}
