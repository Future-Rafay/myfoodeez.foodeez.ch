"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { EmailNotConfiguredError } from "@/lib/email";
import { sanitizeMarketingHtml } from "@/lib/marketing";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import {
  CampaignError,
  MAX_SEND_BATCH,
  deleteCampaignDraft,
  duplicateCampaign,
  excludeRecipient,
  retryFailedRecipients,
  saveCampaignDraft,
  sendCampaignBatch,
  sendCampaignTest,
  readFilters,
  type Audience,
} from "@/services/marketing-campaigns";
import { prisma } from "@/lib/prisma";

// Every action re-checks the Super Admin role: server actions can be called from any browser.

const campaignUrl = (id: number, params: Record<string, string>) => `/platform/marketing/${id}?${new URLSearchParams(params)}`;

const idField = (formData: FormData, name = "id") => {
  const value = Number(formData.get(name));
  if (!Number.isInteger(value) || value <= 0 || value > 2_147_483_647) throw new Error(`Invalid ${name}`);
  return value;
};

const text = (formData: FormData, name: string, max: number) => String(formData.get(name) ?? "").trim().slice(0, max);

/** Turns known failures into a message on the page; anything else is a real error. */
function failure(error: unknown) {
  if (error instanceof CampaignError) return error.message;
  if (error instanceof EmailNotConfiguredError) return "Email is not configured on this server (RESEND_API_KEY).";
  return null;
}

export async function saveCampaign(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const rawId = formData.get("id");
  const id = rawId ? idField(formData) : undefined;
  const back = id ? `/platform/marketing/${id}` : "/platform/marketing/new";
  const name = text(formData, "name", 160);
  const subject = text(formData, "subject", 200);
  const audience = formData.get("audience") === "subscriber" ? "subscriber" : "business";
  const rawHtml = String(formData.get("html") ?? "");
  if (!name || !subject || rawHtml.length > 500_000) redirect(`${back}?error=${encodeURIComponent("Name, subject and content are required.")}`);
  const html = sanitizeMarketingHtml(rawHtml);
  if (!html) redirect(`${back}?error=${encodeURIComponent("The email needs some content.")}`);

  let savedId: number;
  try {
    savedId = await saveCampaignDraft(admin, { id, name, subject, audience: audience as Audience, html });
  } catch (error) {
    const message = failure(error);
    if (!message) throw error;
    redirect(`${back}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/platform/marketing");
  redirect(campaignUrl(savedId, { done: "Draft saved." }));
}

export async function deleteCampaign(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const id = idField(formData);
  try {
    await deleteCampaignDraft(admin, id);
  } catch (error) {
    const message = failure(error);
    if (!message) throw error;
    redirect(campaignUrl(id, { error: message }));
  }
  revalidatePath("/platform/marketing");
  redirect("/platform/marketing");
}

export async function duplicateCampaignAction(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const id = await duplicateCampaign(admin, idField(formData));
  revalidatePath("/platform/marketing");
  redirect(campaignUrl(id, { done: "Copy created. Edit it before sending." }));
}

export async function sendTest(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const id = idField(formData);
  // Fill the merge fields from a real restaurant so the test shows what owners will see.
  const sample = await prisma.business.findFirst({
    where: { APPROVED: 1, STATUS: 1, NOT: { EMAIL_ADDRESS: null } },
    orderBy: { BUSINESS_ID: "asc" },
    select: { BUSINESS_ID: true, BUSINESS_NAME: true, ADDRESS_TOWN: true },
  });
  let result: Record<string, string> = { done: `Test sent to ${admin.email}.` };
  try {
    await sendCampaignTest(admin, id, { name: sample?.BUSINESS_NAME ?? null, town: sample?.ADDRESS_TOWN ?? null, businessId: sample?.BUSINESS_ID ?? null });
  } catch (error) {
    console.error("Marketing test email failed", { campaignId: id, error });
    result = { error: failure(error) ?? "The test email could not be sent." };
  }
  redirect(campaignUrl(id, result));
}

export async function sendBatch(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const id = idField(formData);
  const size = Number(formData.get("size"));
  if (!Number.isInteger(size) || size < 1 || size > MAX_SEND_BATCH) redirect(campaignUrl(id, { error: `Batch size must be 1 to ${MAX_SEND_BATCH}.` }));
  let result: Record<string, string>;
  try {
    const { added } = await sendCampaignBatch(admin, { campaignId: id, size, filters: readFilters(formData) });
    result = { done: added ? `Batch sent to ${added} new recipient${added === 1 ? "" : "s"}. Check the results below.` : "Nobody new matches these filters." };
  } catch (error) {
    const message = failure(error);
    if (!message) throw error;
    result = { error: message };
  }
  revalidatePath("/platform/marketing");
  redirect(campaignUrl(id, result));
}

export async function retryFailed(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const id = idField(formData);
  let result: Record<string, string> = { done: "Failed recipients retried." };
  try {
    await retryFailedRecipients(admin, id);
  } catch (error) {
    const message = failure(error);
    if (!message) throw error;
    result = { error: message };
  }
  revalidatePath("/platform/marketing");
  redirect(campaignUrl(id, result));
}

export async function excludeRecipientAction(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const id = idField(formData);
  let result: Record<string, string> = { done: "Address added to the do-not-email list." };
  try {
    await excludeRecipient(admin, id, idField(formData, "recipientId"));
  } catch (error) {
    const message = failure(error);
    if (!message) throw error;
    result = { error: message };
  }
  revalidatePath(`/platform/marketing/${id}`);
  redirect(campaignUrl(id, result));
}
