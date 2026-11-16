import { prisma } from "@/lib/prisma";
import type { PlatformAdmin } from "@/lib/platform-admin";
import { recordPlatformAction } from "@/lib/platform-admin";
import { sendSimpleEmail } from "@/lib/email";
import { restaurantProfileUrl } from "@/lib/customer-site";

// Registration and claim requests created on foodeez.ch (business_onboarding_request). Callers must have passed requirePlatformAdmin().
// STATUS: email_pending (claim code sent, not yet confirmed) → pending → approved | rejected.

export type RequestView = "pending" | "email_pending" | "done";

export async function listOnboardingRequests(view: RequestView) {
  const where = view === "done" ? { STATUS: { in: ["approved", "rejected"] } } : { STATUS: view };
  const requests = await prisma.business_onboarding_request.findMany({
    where,
    orderBy: { REQUEST_ID: view === "done" ? "desc" : "asc" },
    take: 100,
  });
  const [businesses, accounts, owned] = requests.length
    ? await Promise.all([
        prisma.business.findMany({
          where: { BUSINESS_ID: { in: requests.map((row) => row.BUSINESS_ID) } },
          select: { BUSINESS_ID: true, BUSINESS_NAME: true, EMAIL_ADDRESS: true, ADDRESS_STREET: true, ADDRESS_ZIP: true, ADDRESS_TOWN: true, PHONE_NUMBER: true, WEB_ADDRESS: true, DESCRIPTION: true, APPROVED: true, STATUS: true },
        }),
        prisma.visitors_account.findMany({
          where: { VISITORS_ACCOUNT_ID: { in: requests.map((row) => row.VISITORS_ACCOUNT_ID) } },
          select: { VISITORS_ACCOUNT_ID: true, EMAIL_ADDRESS: true, FIRST_NAME: true, LAST_NAME: true },
        }),
        prisma.business_owner_2_business.findMany({
          where: { BUSINESS_ID: { in: requests.map((row) => BigInt(row.BUSINESS_ID)) } },
          select: { BUSINESS_ID: true },
        }),
      ])
    : [[], [], []];
  const businessById = new Map(businesses.map((row) => [row.BUSINESS_ID, row]));
  const accountById = new Map(accounts.map((row) => [row.VISITORS_ACCOUNT_ID, row]));
  const ownedIds = new Set(owned.map((row) => Number(row.BUSINESS_ID)));
  return requests.map((row) => {
    const business = businessById.get(row.BUSINESS_ID);
    const account = accountById.get(row.VISITORS_ACCOUNT_ID);
    return {
      id: row.REQUEST_ID,
      type: row.REQUEST_TYPE as "register" | "claim",
      status: row.STATUS,
      createdAt: row.CREATION_DATETIME,
      emailVerified: Boolean(row.EMAIL_VERIFIED_DATETIME),
      reviewedAt: row.REVIEWED_DATETIME,
      note: row.REVIEW_NOTE,
      phone: row.CONTACT_PHONE,
      business: {
        id: row.BUSINESS_ID,
        name: business?.BUSINESS_NAME || `Restaurant #${row.BUSINESS_ID}`,
        email: business?.EMAIL_ADDRESS ?? null,
        address: [business?.ADDRESS_STREET, [business?.ADDRESS_ZIP ? String(business.ADDRESS_ZIP) : null, business?.ADDRESS_TOWN].filter(Boolean).join(" ")].filter(Boolean).join(", "),
        phone: business?.PHONE_NUMBER ?? null,
        website: business?.WEB_ADDRESS ?? null,
        description: business?.DESCRIPTION ?? null,
        live: business?.APPROVED === 1 && business?.STATUS === 1,
        hasOwner: ownedIds.has(row.BUSINESS_ID),
      },
      account: {
        id: Number(row.VISITORS_ACCOUNT_ID),
        email: account?.EMAIL_ADDRESS ?? null,
        name: [account?.FIRST_NAME, account?.LAST_NAME].filter(Boolean).join(" ") || null,
      },
    };
  });
}

export class OnboardingError extends Error {}

const adminAppUrl = () => (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "https://myfoodeez.foodeez.ch").replace(/\/+$/, "");

/**
 * Approves a pending request: links the account to the restaurant as its owner (creating the business_owner row if needed)
 * and, for a registration, puts the restaurant live. Other open claims for the same restaurant are rejected.
 */
export async function approveOnboardingRequest(admin: PlatformAdmin, requestId: number) {
  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const request = await tx.business_onboarding_request.findUnique({ where: { REQUEST_ID: requestId } });
    if (!request || request.STATUS !== "pending") throw new OnboardingError("This request is no longer waiting for review.");

    const businessId = BigInt(request.BUSINESS_ID);
    const accountId = Number(request.VISITORS_ACCOUNT_ID);
    let owner = await tx.business_owner.findFirst({ where: { VISITORS_ACCOUNT_ID: accountId }, select: { BUSINESS_OWNER_ID: true } });
    const links = await tx.business_owner_2_business.findMany({ where: { BUSINESS_ID: businessId }, select: { BUSINESS_OWNER_ID: true } });
    if (links.some((link) => Number(link.BUSINESS_OWNER_ID) !== owner?.BUSINESS_OWNER_ID)) {
      throw new OnboardingError("This restaurant already has another owner. Remove that owner first.");
    }

    // Claim the request first so two Super Admins approving at once cannot both run.
    const claimed = await tx.business_onboarding_request.updateMany({
      where: { REQUEST_ID: requestId, STATUS: "pending" },
      data: { STATUS: "approved", REVIEWED_BY: admin.id, REVIEWED_DATETIME: now },
    });
    if (!claimed.count) throw new OnboardingError("This request is no longer waiting for review.");

    owner ??= await tx.business_owner.create({ data: { CREATION_DATETIME: now, VISITORS_ACCOUNT_ID: accountId }, select: { BUSINESS_OWNER_ID: true } });
    if (!links.length) {
      await tx.business_owner_2_business.create({
        data: { CREATION_DATETIME: now, BUSINESS_OWNER_ID: BigInt(owner.BUSINESS_OWNER_ID), BUSINESS_ID: businessId, STATUS: 1 },
      });
    }
    if (request.REQUEST_TYPE === "register") {
      await tx.business.update({ where: { BUSINESS_ID: request.BUSINESS_ID }, data: { APPROVED: 1, STATUS: 1 } });
    }
    await tx.business_onboarding_request.updateMany({
      where: { BUSINESS_ID: request.BUSINESS_ID, REQUEST_ID: { not: requestId }, STATUS: { in: ["email_pending", "pending"] } },
      data: { STATUS: "rejected", REVIEWED_BY: admin.id, REVIEWED_DATETIME: now, REVIEW_NOTE: "Another claim for this restaurant was approved." },
    });
    const [business, account] = await Promise.all([
      tx.business.findUnique({ where: { BUSINESS_ID: request.BUSINESS_ID }, select: { BUSINESS_NAME: true } }),
      tx.visitors_account.findUnique({ where: { VISITORS_ACCOUNT_ID: request.VISITORS_ACCOUNT_ID }, select: { EMAIL_ADDRESS: true } }),
    ]);
    return { request, businessName: business?.BUSINESS_NAME || `Restaurant #${request.BUSINESS_ID}`, accountEmail: account?.EMAIL_ADDRESS };
  });

  await recordPlatformAction(admin, "ONBOARDING_APPROVED", "business_onboarding_request", requestId, { businessId: result.request.BUSINESS_ID, type: result.request.REQUEST_TYPE });

  // The approval is saved; a failed email is reported but does not undo it.
  if (!result.accountEmail) return { emailed: false };
  try {
    await sendSimpleEmail({
      to: result.accountEmail,
      subject: `You can now manage ${result.businessName} on Foodeez`,
      paragraphs: [
        `Good news: your ${result.request.REQUEST_TYPE === "register" ? "registration" : "claim"} for ${result.businessName} has been approved.`,
        "Sign in to the Foodeez restaurant dashboard with the same account you use on foodeez.ch to set up your menu, opening hours, delivery and payments.",
        `Your public page: ${restaurantProfileUrl(result.businessName, result.request.BUSINESS_ID)}`,
      ],
      button: { label: "Open the restaurant dashboard", url: `${adminAppUrl()}/dashboard` },
    });
    return { emailed: true };
  } catch (error) {
    console.error("Onboarding approval email failed:", error);
    return { emailed: false };
  }
}

export async function rejectOnboardingRequest(admin: PlatformAdmin, requestId: number, note: string) {
  const request = await prisma.business_onboarding_request.findUnique({ where: { REQUEST_ID: requestId } });
  if (!request || (request.STATUS !== "pending" && request.STATUS !== "email_pending")) throw new OnboardingError("This request is no longer open.");
  const updated = await prisma.business_onboarding_request.updateMany({
    where: { REQUEST_ID: requestId, STATUS: request.STATUS },
    data: { STATUS: "rejected", REVIEWED_BY: admin.id, REVIEWED_DATETIME: new Date(), REVIEW_NOTE: note || null, EMAIL_CODE_HASH: null },
  });
  if (!updated.count) throw new OnboardingError("This request is no longer open.");
  // A rejected registration's restaurant stays hidden (APPROVED = 0); it is kept, not deleted.
  await recordPlatformAction(admin, "ONBOARDING_REJECTED", "business_onboarding_request", requestId, { businessId: request.BUSINESS_ID, type: request.REQUEST_TYPE, note });

  const [business, account] = await Promise.all([
    prisma.business.findUnique({ where: { BUSINESS_ID: request.BUSINESS_ID }, select: { BUSINESS_NAME: true } }),
    prisma.visitors_account.findUnique({ where: { VISITORS_ACCOUNT_ID: request.VISITORS_ACCOUNT_ID }, select: { EMAIL_ADDRESS: true } }),
  ]);
  if (!account?.EMAIL_ADDRESS) return { emailed: false };
  const name = business?.BUSINESS_NAME || `Restaurant #${request.BUSINESS_ID}`;
  try {
    await sendSimpleEmail({
      to: account.EMAIL_ADDRESS,
      subject: `About your Foodeez request for ${name}`,
      paragraphs: [
        `We could not approve your ${request.REQUEST_TYPE === "register" ? "registration" : "claim"} for ${name}.`,
        ...(note ? [`Reason: ${note}`] : []),
        "If you think this is a mistake, reply to the Foodeez team through the contact form on foodeez.ch.",
      ],
    });
    return { emailed: true };
  } catch (error) {
    console.error("Onboarding rejection email failed:", error);
    return { emailed: false };
  }
}
