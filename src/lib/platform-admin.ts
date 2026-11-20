import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const SUPER_ADMIN_ROLE = "super_admin";

export type PlatformAdmin = { id: bigint; email: string; name: string };

/**
 * Super Admins are set by hand: visitors_account.PLATFORM_ROLE = 'super_admin'.
 * The role is read from the database on every call (never from the JWT), so removing it takes effect at once.
 * Returns null for anyone else.
 */
export async function getPlatformAdmin(): Promise<PlatformAdmin | null> {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id;
  if (!id || !/^\d+$/.test(id)) return null;
  const account = await prisma.visitors_account.findUnique({
    where: { VISITORS_ACCOUNT_ID: BigInt(id) },
    select: { VISITORS_ACCOUNT_ID: true, EMAIL_ADDRESS: true, FIRST_NAME: true, LAST_NAME: true, PLATFORM_ROLE: true },
  });
  if (account?.PLATFORM_ROLE !== SUPER_ADMIN_ROLE) return null;
  return {
    id: account.VISITORS_ACCOUNT_ID,
    email: account.EMAIL_ADDRESS ?? "",
    name: [account.FIRST_NAME, account.LAST_NAME].filter(Boolean).join(" ") || "Super Admin",
  };
}

/** For pages and server actions: anyone who is not a Super Admin gets a 404, so the area's existence is not revealed. */
export async function requirePlatformAdmin(): Promise<PlatformAdmin> {
  const admin = await getPlatformAdmin();
  if (!admin) notFound();
  return admin;
}

export async function recordPlatformAction(
  admin: PlatformAdmin,
  action: string,
  entityType: string,
  entityId: string | number | bigint,
  details?: Record<string, unknown>
) {
  await prisma.platform_audit_log.create({
    data: {
      ACTOR_VISITORS_ACCOUNT_ID: admin.id,
      ACTION: action,
      ENTITY_TYPE: entityType,
      ENTITY_ID: String(entityId),
      DETAILS_JSON: details ? JSON.stringify(details) : null,
    },
  });
}
