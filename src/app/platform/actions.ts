"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { recordPlatformAction, requirePlatformAdmin } from "@/lib/platform-admin";

// Every action re-checks the Super Admin role: server actions can be called from any browser.

const intField = (formData: FormData, name: string) => {
  const value = Number(formData.get(name));
  if (!Number.isInteger(value) || value <= 0 || value > 2_147_483_647) throw new Error(`Invalid ${name}`);
  return value;
};

const flagField = (formData: FormData, name: string) => {
  const value = formData.get(name);
  if (value !== "0" && value !== "1") throw new Error(`Invalid ${name}`);
  return Number(value);
};

/** APPROVED: whether the restaurant is allowed on Foodeez at all. */
export async function setRestaurantApproval(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const businessId = intField(formData, "businessId");
  const approved = flagField(formData, "approved");
  await prisma.business.update({ where: { BUSINESS_ID: businessId }, data: { APPROVED: approved } });
  await recordPlatformAction(admin, approved ? "RESTAURANT_APPROVED" : "RESTAURANT_UNAPPROVED", "business", businessId);
  revalidatePath("/platform", "layout");
}

/** STATUS: whether an approved restaurant is switched on (visible and orderable). */
export async function setRestaurantStatus(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const businessId = intField(formData, "businessId");
  const status = flagField(formData, "status");
  await prisma.business.update({ where: { BUSINESS_ID: businessId }, data: { STATUS: status } });
  await recordPlatformAction(admin, status ? "RESTAURANT_SWITCHED_ON" : "RESTAURANT_SWITCHED_OFF", "business", businessId);
  revalidatePath("/platform", "layout");
}

// APPROVED values for reviews and stories: 0 pending, 1 public, 2 rejected (hidden).
const MODERATION_VALUES = { approve: 1, reject: 2 } as const;

export async function moderateContent(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const kind = formData.get("kind");
  const decision = formData.get("decision");
  const id = intField(formData, "id");
  if (decision !== "approve" && decision !== "reject") throw new Error("Invalid decision");
  const APPROVED = MODERATION_VALUES[decision];

  // updateMany with APPROVED: 0 so a decision only applies to content still pending.
  if (kind === "reviews") {
    await prisma.visitor_business_review.updateMany({ where: { VISITOR_BUSINESS_REVIEW_ID: id, APPROVED: 0 }, data: { APPROVED } });
  } else if (kind === "platform") {
    await prisma.foodeez_review.updateMany({ where: { FOODEEZ_REVIEW_ID: BigInt(id), APPROVED: 0 }, data: { APPROVED } });
  } else if (kind === "stories") {
    await prisma.visitor_food_journey.updateMany({ where: { VISITOR_FOOD_JOURNEY_ID: id, APPROVED: 0 }, data: { APPROVED } });
  } else {
    throw new Error("Invalid kind");
  }
  await recordPlatformAction(admin, decision === "approve" ? "CONTENT_APPROVED" : "CONTENT_REJECTED", String(kind), id);
  revalidatePath("/platform", "layout");
}
