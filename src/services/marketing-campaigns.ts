import { createHash } from "node:crypto";
import { Prisma } from "../../prisma/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { emailFrom, resend } from "@/lib/email";
import { restaurantClaimUrl } from "@/lib/customer-site";
import {
  applyMergeFields,
  domainAcceptsMail,
  htmlToText,
  isUndeliverableEmail,
  marketingEmailHtml,
  unsubscribeToken,
  verifyUnsubscribeToken,
  type MergeRecipient,
} from "@/lib/marketing";
import { recordPlatformAction, type PlatformAdmin } from "@/lib/platform-admin";

// Adapted from Zambiel's src/server/services/marketing-campaigns.ts. Differences: the audience is restaurants or newsletter
// subscribers instead of registered customers, a campaign is sent in several small batches instead of once, and there is
// no scheduling. Callers must have passed requirePlatformAdmin(); the public unsubscribe route is the only exception.

export type Audience = "business" | "subscriber";
export type CampaignStatus = "draft" | "sending" | "sent";

/** Resend accepts 100 emails per batch call. */
export const RESEND_BATCH_SIZE = 100;
/** Most recipients one "Send batch" may add, so a send finishes well inside the function time limit and volume ramps slowly. */
export const MAX_SEND_BATCH = 300;
const STALE_SENDING_MS = 10 * 60_000;

export type BusinessFilters = { town: string; unclaimedOnly: boolean; liveOnly: boolean; skipEmailedDays: number };

/** Reads the restaurant filters from a form or the page's query string. Unclaimed-only and live-only are on unless set to "0". */
export function readFilters(source: { get(name: string): FormDataEntryValue | string | null }): BusinessFilters {
  const days = Number(source.get("skipDays") ?? 30);
  return {
    town: String(source.get("town") ?? "").trim().slice(0, 100),
    unclaimedOnly: source.get("unclaimed") !== "0",
    liveOnly: source.get("live") !== "0",
    skipEmailedDays: Number.isInteger(days) && days >= 0 && days <= 365 ? days : 30,
  };
}

type Candidate = { email: string; name: string | null; town: string | null; businessId: number | null; subscriptionId: bigint | null };

const appUrl = () => (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "https://myfoodeez.foodeez.ch").replace(/\/+$/, "");

function businessConditions(campaignId: number, filters: BusinessFilters) {
  const conditions = [
    Prisma.sql`b.EMAIL_ADDRESS IS NOT NULL AND b.EMAIL_ADDRESS LIKE '%_@_%._%'`,
    Prisma.sql`NOT EXISTS (SELECT 1 FROM email_suppression s WHERE s.EMAIL = b.EMAIL_ADDRESS)`,
    Prisma.sql`NOT EXISTS (SELECT 1 FROM marketing_campaign_recipient r WHERE r.CAMPAIGN_ID = ${campaignId} AND r.EMAIL = b.EMAIL_ADDRESS)`,
  ];
  if (filters.liveOnly) conditions.push(Prisma.sql`b.APPROVED = 1 AND b.STATUS = 1`);
  if (filters.unclaimedOnly) conditions.push(Prisma.sql`NOT EXISTS (SELECT 1 FROM business_owner_2_business l WHERE l.BUSINESS_ID = b.BUSINESS_ID)`);
  if (filters.town) conditions.push(Prisma.sql`b.ADDRESS_TOWN LIKE ${`%${filters.town}%`}`);
  if (filters.skipEmailedDays > 0) {
    conditions.push(Prisma.sql`NOT EXISTS (SELECT 1 FROM marketing_campaign_recipient p WHERE p.EMAIL = b.EMAIL_ADDRESS AND p.STATUS = 'sent' AND p.SENT_DATETIME > ${new Date(Date.now() - filters.skipEmailedDays * 86_400_000)})`);
  }
  return Prisma.join(conditions, " AND ");
}

function subscriberConditions(campaignId: number) {
  return Prisma.join(
    [
      Prisma.sql`f.EMAIL_ADDRESS IS NOT NULL AND f.EMAIL_ADDRESS LIKE '%_@_%._%'`,
      Prisma.sql`NOT EXISTS (SELECT 1 FROM email_suppression s WHERE s.EMAIL = f.EMAIL_ADDRESS)`,
      Prisma.sql`NOT EXISTS (SELECT 1 FROM marketing_campaign_recipient r WHERE r.CAMPAIGN_ID = ${campaignId} AND r.EMAIL = f.EMAIL_ADDRESS)`,
    ],
    " AND "
  );
}

/** How many addresses a batch could still reach. Values are always bound parameters. */
export async function countAudience(campaignId: number, audience: Audience, filters: BusinessFilters) {
  const rows =
    audience === "business"
      ? await prisma.$queryRaw<{ total: bigint }[]>`SELECT COUNT(DISTINCT LOWER(b.EMAIL_ADDRESS)) AS total FROM business b WHERE ${businessConditions(campaignId, filters)}`
      : await prisma.$queryRaw<{ total: bigint }[]>`SELECT COUNT(DISTINCT LOWER(f.EMAIL_ADDRESS)) AS total FROM foodeez_subscription f WHERE ${subscriberConditions(campaignId)}`;
  return Number(rows[0]?.total ?? 0);
}

async function pickAudience(campaignId: number, audience: Audience, filters: BusinessFilters, size: number): Promise<Candidate[]> {
  // Fetch extra rows: a chain can share one email across several restaurants, and each address is emailed once per campaign.
  const rows =
    audience === "business"
      ? await prisma.$queryRaw<{ BUSINESS_ID: number; BUSINESS_NAME: string | null; EMAIL_ADDRESS: string; ADDRESS_TOWN: string | null }[]>`
          SELECT b.BUSINESS_ID, b.BUSINESS_NAME, b.EMAIL_ADDRESS, b.ADDRESS_TOWN FROM business b
          WHERE ${businessConditions(campaignId, filters)} ORDER BY b.BUSINESS_ID ASC LIMIT ${size * 2}`
      : await prisma.$queryRaw<{ FOODEEZ_SUBSCRIPTION_ID: bigint; EMAIL_ADDRESS: string }[]>`
          SELECT f.FOODEEZ_SUBSCRIPTION_ID, f.EMAIL_ADDRESS FROM foodeez_subscription f
          WHERE ${subscriberConditions(campaignId)} ORDER BY f.FOODEEZ_SUBSCRIPTION_ID ASC LIMIT ${size * 2}`;
  const seen = new Set<string>();
  const picked: Candidate[] = [];
  for (const row of rows) {
    const email = row.EMAIL_ADDRESS.trim().toLowerCase();
    if (seen.has(email) || email.length > 320) continue;
    seen.add(email);
    picked.push(
      "BUSINESS_ID" in row
        ? { email, name: row.BUSINESS_NAME, town: row.ADDRESS_TOWN, businessId: row.BUSINESS_ID, subscriptionId: null }
        : { email, name: null, town: null, businessId: null, subscriptionId: row.FOODEEZ_SUBSCRIPTION_ID }
    );
    if (picked.length === size) break;
  }
  return picked;
}

type CampaignContent = { SUBJECT: string; HTML: string; AUDIENCE: string };

export function renderCampaignEmail(campaign: CampaignContent, recipient: MergeRecipient & { recipientId: number }) {
  const token = encodeURIComponent(unsubscribeToken(recipient.recipientId));
  const unsubscribeUrl = `${appUrl()}/unsubscribe?token=${token}`;
  const subject = applyMergeFields(campaign.SUBJECT, recipient, false);
  const body = applyMergeFields(campaign.HTML, recipient, true);
  return {
    to: recipient.email,
    subject,
    html: marketingEmailHtml({ subject, bodyHtml: body, unsubscribeUrl, audience: campaign.AUDIENCE === "subscriber" ? "subscriber" : "business" }),
    text: `${htmlToText(body)}\n\nUnsubscribe: ${unsubscribeUrl}`,
    // RFC 8058 one-click unsubscribe, required by Gmail and Yahoo for bulk senders.
    headers: { "List-Unsubscribe": `<${appUrl()}/api/marketing/unsubscribe?token=${token}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  };
}

type BatchMessage = ReturnType<typeof renderCampaignEmail>;
export type DeliverBatch = (messages: BatchMessage[], idempotencyKey: string) => Promise<string[]>;

export const sendWithResend: DeliverBatch = async (messages, idempotencyKey) => {
  const result = await resend().batch.send(messages.map((message) => ({ from: emailFrom(), ...message })), { idempotencyKey });
  if (result.error) throw new Error(result.error.message);
  return result.data.data.map((email) => email.id);
};

export class CampaignError extends Error {}

export async function saveCampaignDraft(admin: PlatformAdmin, input: { id?: number; name: string; subject: string; audience: Audience; html: string }) {
  const data = { NAME: input.name, SUBJECT: input.subject, AUDIENCE: input.audience, HTML: input.html, UPDATED_DATETIME: new Date() };
  if (!input.id) {
    const campaign = await prisma.marketing_campaign.create({ data: { ...data, CREATED_BY: admin.id }, select: { CAMPAIGN_ID: true } });
    await recordPlatformAction(admin, "MARKETING_CAMPAIGN_CREATED", "marketing_campaign", campaign.CAMPAIGN_ID);
    return campaign.CAMPAIGN_ID;
  }
  const updated = await prisma.marketing_campaign.updateMany({ where: { CAMPAIGN_ID: input.id, STATUS: "draft" }, data });
  if (!updated.count) throw new CampaignError("Only drafts can be edited. Duplicate the campaign to change it.");
  return input.id;
}

/** Drafts have no recipients; sent campaigns are kept as records. */
export async function deleteCampaignDraft(admin: PlatformAdmin, id: number) {
  const deleted = await prisma.marketing_campaign.deleteMany({ where: { CAMPAIGN_ID: id, STATUS: "draft" } });
  if (!deleted.count) throw new CampaignError("Only drafts can be deleted.");
  await recordPlatformAction(admin, "MARKETING_CAMPAIGN_DELETED", "marketing_campaign", id);
}

export async function duplicateCampaign(admin: PlatformAdmin, id: number) {
  const source = await prisma.marketing_campaign.findUniqueOrThrow({ where: { CAMPAIGN_ID: id } });
  return saveCampaignDraft(admin, { name: `${source.NAME} (copy)`.slice(0, 160), subject: source.SUBJECT, audience: source.AUDIENCE as Audience, html: source.HTML });
}

export async function sendCampaignTest(admin: PlatformAdmin, id: number, sample: { name: string | null; town: string | null; businessId: number | null }) {
  const campaign = await prisma.marketing_campaign.findUniqueOrThrow({ where: { CAMPAIGN_ID: id } });
  // recipientId 0 makes an unsubscribe link that matches no row, so the test can never unsubscribe anyone.
  const message = renderCampaignEmail(campaign, {
    recipientId: 0,
    email: admin.email,
    name: sample.name,
    town: sample.town,
    claimUrl: sample.businessId ? restaurantClaimUrl(sample.name, sample.businessId) : null,
  });
  const result = await resend().emails.send({ from: emailFrom(), ...message, subject: `[Test] ${message.subject}` });
  if (result.error) throw new Error(result.error.message);
}

/**
 * Adds up to `size` new recipients (never one this campaign already has, nor a suppressed address) and sends to them.
 * The first batch locks the campaign's content.
 */
export async function sendCampaignBatch(admin: PlatformAdmin, input: { campaignId: number; size: number; filters: BusinessFilters }, deliver: DeliverBatch = sendWithResend) {
  const size = Math.min(Math.max(1, Math.floor(input.size)), MAX_SEND_BATCH);
  const campaign = await prisma.marketing_campaign.findUniqueOrThrow({ where: { CAMPAIGN_ID: input.campaignId } });
  const stale = campaign.STATUS === "sending" && Date.now() - campaign.UPDATED_DATETIME.getTime() > STALE_SENDING_MS;
  if (campaign.STATUS === "sending" && !stale) throw new CampaignError("This campaign is already sending. Wait for it to finish.");

  // Optimistic claim: a second click or a second Super Admin sees a changed UPDATED_DATETIME and stops.
  const claimed = await prisma.marketing_campaign.updateMany({
    where: { CAMPAIGN_ID: campaign.CAMPAIGN_ID, STATUS: campaign.STATUS, UPDATED_DATETIME: campaign.UPDATED_DATETIME },
    data: { STATUS: "sending", UPDATED_DATETIME: new Date() },
  });
  if (!claimed.count) throw new CampaignError("This campaign is already sending. Wait for it to finish.");

  let added = 0;
  try {
    const audience = campaign.AUDIENCE as Audience;
    const picked = await pickAudience(campaign.CAMPAIGN_ID, audience, input.filters, size);
    added = picked.length;
    if (picked.length) {
      await prisma.marketing_campaign_recipient.createMany({
        data: picked.map((row) => ({ CAMPAIGN_ID: campaign.CAMPAIGN_ID, EMAIL: row.email, NAME: row.name?.slice(0, 255) ?? null, BUSINESS_ID: row.businessId, SUBSCRIPTION_ID: row.subscriptionId })),
        skipDuplicates: true,
      });
    }
    await recordPlatformAction(admin, "MARKETING_BATCH_SENT", "marketing_campaign", campaign.CAMPAIGN_ID, { added: picked.length, filters: input.filters });
    await deliverPendingRecipients(campaign.CAMPAIGN_ID, deliver);
    return { added: picked.length };
  } finally {
    // A batch that added nobody (or failed before adding anyone) leaves a draft editable and its first-send date unset.
    const sentBefore = Boolean(campaign.SENT_DATETIME);
    await prisma.marketing_campaign.update({
      where: { CAMPAIGN_ID: campaign.CAMPAIGN_ID },
      data: {
        STATUS: added || sentBefore ? "sent" : "draft",
        SENT_DATETIME: campaign.SENT_DATETIME ?? (added ? new Date() : null),
        UPDATED_DATETIME: new Date(),
      },
    });
  }
}

/**
 * Sends every pending recipient in batches of 100. Each batch stays pending until Resend accepts it, so a crash is resumable,
 * and resending the same batch reuses its idempotency key instead of emailing twice.
 */
export async function deliverPendingRecipients(campaignId: number, deliver: DeliverBatch) {
  const campaign = await prisma.marketing_campaign.findUniqueOrThrow({ where: { CAMPAIGN_ID: campaignId }, select: { SUBJECT: true, HTML: true, AUDIENCE: true } });
  const domainChecks = new Map<string, Promise<boolean>>();
  const deliverable = (email: string) => {
    if (isUndeliverableEmail(email)) return Promise.resolve(false);
    const domain = email.split("@").pop()!.toLowerCase();
    if (!domainChecks.has(domain)) domainChecks.set(domain, domainAcceptsMail(domain));
    return domainChecks.get(domain)!;
  };
  const businessIds = new Map<number, { town: string | null }>();

  for (;;) {
    const chunk = await prisma.marketing_campaign_recipient.findMany({
      where: { CAMPAIGN_ID: campaignId, STATUS: "pending" },
      orderBy: { RECIPIENT_ID: "asc" },
      take: RESEND_BATCH_SIZE,
    });
    if (!chunk.length) break;

    // Re-check the do-not-email list at send time: an unsubscribe can arrive between batches and retries.
    const suppressed = new Set(
      (await prisma.email_suppression.findMany({ where: { EMAIL: { in: chunk.map((row) => row.EMAIL) } }, select: { EMAIL: true } })).map((row) => row.EMAIL.toLowerCase())
    );
    const optedOut = chunk.filter((row) => suppressed.has(row.EMAIL.toLowerCase())).map((row) => row.RECIPIENT_ID);
    if (optedOut.length) await prisma.marketing_campaign_recipient.updateMany({ where: { RECIPIENT_ID: { in: optedOut } }, data: { STATUS: "cancelled", ERROR: "UNSUBSCRIBED" } });

    const active = chunk.filter((row) => !suppressed.has(row.EMAIL.toLowerCase()));
    const checks = await Promise.all(active.map((row) => deliverable(row.EMAIL)));
    const undeliverable = active.filter((_, index) => !checks[index]).map((row) => row.RECIPIENT_ID);
    if (undeliverable.length) await prisma.marketing_campaign_recipient.updateMany({ where: { RECIPIENT_ID: { in: undeliverable } }, data: { STATUS: "failed", ERROR: "UNDELIVERABLE_ADDRESS" } });
    const sendable = active.filter((_, index) => checks[index]);
    if (!sendable.length) continue;

    const missingTowns = sendable.map((row) => row.BUSINESS_ID).filter((id): id is number => id !== null && !businessIds.has(id));
    if (missingTowns.length) {
      for (const row of await prisma.business.findMany({ where: { BUSINESS_ID: { in: missingTowns } }, select: { BUSINESS_ID: true, ADDRESS_TOWN: true } })) {
        businessIds.set(row.BUSINESS_ID, { town: row.ADDRESS_TOWN });
      }
    }

    const ids = sendable.map((row) => row.RECIPIENT_ID);
    const key = `foodeez-marketing-${campaignId}-${createHash("sha256").update(ids.join(",")).digest("hex").slice(0, 32)}`;
    let providerIds: string[];
    try {
      const messages = sendable.map((row) =>
        renderCampaignEmail(campaign, {
          recipientId: row.RECIPIENT_ID,
          email: row.EMAIL,
          name: row.NAME,
          town: row.BUSINESS_ID ? businessIds.get(row.BUSINESS_ID)?.town ?? null : null,
          claimUrl: row.BUSINESS_ID ? restaurantClaimUrl(row.NAME, row.BUSINESS_ID) : null,
        })
      );
      providerIds = await deliver(messages, key);
    } catch (error) {
      await prisma.marketing_campaign_recipient.updateMany({
        where: { RECIPIENT_ID: { in: ids } },
        data: { STATUS: "failed", ERROR: (error instanceof Error ? error.message : "SEND_FAILED").slice(0, 500) },
      });
      continue;
    }
    // One statement: 100 row updates would outlast the transaction timeout against the remote database. If this throws the
    // rows stay pending (Resend already accepted them), so a retry reuses the same idempotency key instead of sending twice.
    const now = new Date();
    const providerIdCases = Prisma.join(sendable.map((row, index) => Prisma.sql`WHEN ${row.RECIPIENT_ID} THEN ${providerIds[index] ?? null}`), " ");
    await prisma.$executeRaw`
      UPDATE marketing_campaign_recipient
      SET STATUS = 'sent', PROVIDER_MESSAGE_ID = CASE RECIPIENT_ID ${providerIdCases} END, SENT_DATETIME = ${now}, ERROR = NULL
      WHERE RECIPIENT_ID IN (${Prisma.join(ids)})
    `;
  }
}

export async function recipientCounts(campaignId: number) {
  const rows = await prisma.marketing_campaign_recipient.groupBy({ by: ["STATUS"], where: { CAMPAIGN_ID: campaignId }, _count: { _all: true } });
  return Object.fromEntries(rows.map((row) => [row.STATUS, row._count._all])) as Partial<Record<"pending" | "sent" | "failed" | "cancelled", number>>;
}

export async function retryFailedRecipients(admin: PlatformAdmin, campaignId: number, deliver: DeliverBatch = sendWithResend) {
  const campaign = await prisma.marketing_campaign.findUniqueOrThrow({ where: { CAMPAIGN_ID: campaignId } });
  const stale = campaign.STATUS === "sending" && Date.now() - campaign.UPDATED_DATETIME.getTime() > STALE_SENDING_MS;
  if (campaign.STATUS !== "sent" && !stale) throw new CampaignError("Nothing to retry yet.");
  const claimed = await prisma.marketing_campaign.updateMany({
    where: { CAMPAIGN_ID: campaignId, STATUS: campaign.STATUS, UPDATED_DATETIME: campaign.UPDATED_DATETIME },
    data: { STATUS: "sending", UPDATED_DATETIME: new Date() },
  });
  if (!claimed.count) throw new CampaignError("This campaign is already sending. Wait for it to finish.");
  try {
    // Undeliverable addresses are not retried: they would fail the same way.
    await prisma.marketing_campaign_recipient.updateMany({ where: { CAMPAIGN_ID: campaignId, STATUS: "failed", NOT: { ERROR: "UNDELIVERABLE_ADDRESS" } }, data: { STATUS: "pending", ERROR: null } });
    await recordPlatformAction(admin, "MARKETING_CAMPAIGN_RETRIED", "marketing_campaign", campaignId);
    await deliverPendingRecipients(campaignId, deliver);
  } finally {
    await prisma.marketing_campaign.update({ where: { CAMPAIGN_ID: campaignId }, data: { STATUS: "sent", UPDATED_DATETIME: new Date() } });
  }
}

/** Puts an address on the do-not-email list for every future campaign. */
export async function suppressEmail(email: string, reason: "unsubscribed" | "excluded" | "complaint") {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return;
  await prisma.$executeRaw`INSERT IGNORE INTO email_suppression (EMAIL, CREATION_DATETIME, REASON) VALUES (${normalized}, ${new Date()}, ${reason})`;
}

export async function excludeRecipient(admin: PlatformAdmin, campaignId: number, recipientId: number) {
  const recipient = await prisma.marketing_campaign_recipient.findFirst({ where: { RECIPIENT_ID: recipientId, CAMPAIGN_ID: campaignId } });
  if (!recipient) throw new CampaignError("Recipient not found.");
  await suppressEmail(recipient.EMAIL, "excluded");
  await prisma.marketing_campaign_recipient.updateMany({ where: { RECIPIENT_ID: recipientId, STATUS: { in: ["failed", "pending"] } }, data: { STATUS: "cancelled", ERROR: "EXCLUDED_BY_ADMIN" } });
  await recordPlatformAction(admin, "MARKETING_RECIPIENT_EXCLUDED", "marketing_campaign", campaignId, { recipientId });
}

/** Public: the signed token is the credential. Returns false for an unknown or forged token. */
export async function unsubscribeByToken(token: string) {
  const recipientId = verifyUnsubscribeToken(token);
  if (!recipientId) return false;
  const recipient = await prisma.marketing_campaign_recipient.findUnique({ where: { RECIPIENT_ID: recipientId }, select: { EMAIL: true } });
  if (!recipient) return false;
  await suppressEmail(recipient.EMAIL, "unsubscribed");
  await prisma.marketing_campaign_recipient.updateMany({ where: { EMAIL: recipient.EMAIL, STATUS: "pending" }, data: { STATUS: "cancelled", ERROR: "UNSUBSCRIBED" } });
  return true;
}
