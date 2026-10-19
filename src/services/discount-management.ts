import prisma from "@/lib/prisma";
import { type Discount, swissDate } from "@/lib/discounts";
import { requireOrdersBusinessAccess } from "@/services/orders-management";

const dateText = (value: Date | null) => value?.toISOString().slice(0, 10) ?? null;

export function discountRow(row: {
  DISCOUNT_ID: number; NAME: string; TYPE: string; VALUE: unknown; MINIMUM_ORDER: unknown;
  ACTIVE: number; POS_ENABLED: number; ONLINE_ENABLED: number; ONLINE_AUTOMATIC: number;
  VALID_FROM: Date | null; VALID_UNTIL: Date | null;
}): Discount {
  return {
    id: row.DISCOUNT_ID, name: row.NAME, type: row.TYPE as Discount["type"],
    value: Number(row.VALUE), minimumOrder: row.MINIMUM_ORDER == null ? null : Number(row.MINIMUM_ORDER),
    active: row.ACTIVE === 1, posEnabled: row.POS_ENABLED === 1,
    onlineEnabled: row.ONLINE_ENABLED === 1, onlineAutomatic: row.ONLINE_AUTOMATIC === 1,
    validFrom: dateText(row.VALID_FROM), validUntil: dateText(row.VALID_UNTIL),
  };
}

export async function listDiscounts(businessId: number) {
  await requireOrdersBusinessAccess(businessId);
  return (await prisma.business_discount.findMany({
    where: { BUSINESS_ID: businessId }, orderBy: { DISCOUNT_ID: "desc" },
  })).map(discountRow);
}

export async function availablePosDiscounts(businessId: number) {
  const today = swissDate();
  return (await listDiscounts(businessId)).filter((discount) =>
    discount.active && discount.posEnabled &&
    (!discount.validFrom || discount.validFrom <= today) &&
    (!discount.validUntil || discount.validUntil >= today)
  );
}

function money(value: unknown, optional = false) {
  if ((value === "" || value == null) && optional) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 999999.99 || Math.abs(Math.round(number * 100) - number * 100) > 0.000001) {
    throw new Error("Enter a valid CHF amount with at most two decimal places.");
  }
  return number;
}

function date(value: unknown) {
  if (value === "" || value == null) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Enter a valid date.");
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error("Enter a valid date.");
  return parsed;
}

function validate(input: Record<string, unknown>) {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || name.length > 100) throw new Error("Discount name must be 1–100 characters.");
  if (input.type !== "percentage" && input.type !== "fixed") throw new Error("Choose Percentage or Fixed Amount.");
  const value = money(input.value);
  if (!value || (input.type === "percentage" && value >= 100)) throw new Error("Discount value must be greater than 0 and below 100% for percentages.");
  const minimum = money(input.minimumOrder, true);
  const validFrom = date(input.validFrom);
  const validUntil = date(input.validUntil);
  if (validFrom && validUntil && validFrom > validUntil) throw new Error("End date must be on or after start date.");
  for (const key of ["active", "posEnabled", "onlineEnabled", "onlineAutomatic"]) {
    if (typeof input[key] !== "boolean") throw new Error(`Invalid ${key} setting.`);
  }
  if (input.onlineAutomatic && !input.onlineEnabled) throw new Error("Automatic online discounts must be available online.");
  return {
    NAME: name, TYPE: input.type, VALUE: value, MINIMUM_ORDER: minimum,
    ACTIVE: input.active ? 1 : 0, POS_ENABLED: input.posEnabled ? 1 : 0,
    ONLINE_ENABLED: input.onlineEnabled ? 1 : 0, ONLINE_AUTOMATIC: input.onlineAutomatic ? 1 : 0,
    VALID_FROM: validFrom, VALID_UNTIL: validUntil,
  };
}

export async function saveDiscount(businessId: number, input: Record<string, unknown>, id?: number) {
  await requireOrdersBusinessAccess(businessId);
  const data = validate(input);
  if (id) {
    const result = await prisma.business_discount.updateMany({
      where: { DISCOUNT_ID: id, BUSINESS_ID: businessId }, data,
    });
    if (!result.count) throw new Error("Discount not found.");
    return discountRow(await prisma.business_discount.findUniqueOrThrow({ where: { DISCOUNT_ID: id } }));
  }
  return discountRow(await prisma.business_discount.create({ data: { ...data, BUSINESS_ID: businessId } }));
}

export async function listCodes(businessId: number) {
  await requireOrdersBusinessAccess(businessId);
  return prisma.business_discount_code.findMany({ where: { BUSINESS_ID: businessId }, orderBy: { CODE_ID: "desc" } });
}

export async function createCode(businessId: number, discountId: number, rawCode: unknown) {
  await requireOrdersBusinessAccess(businessId);
  const code = typeof rawCode === "string" ? rawCode.trim().toUpperCase() : "";
  if (!/^[A-Z0-9_-]{4,64}$/.test(code)) throw new Error("Code must be 4–64 letters, numbers, hyphens or underscores.");
  const discount = await prisma.business_discount.findFirst({ where: { DISCOUNT_ID: discountId, BUSINESS_ID: businessId } });
  if (!discount) throw new Error("Discount not found.");
  if (discount.ONLINE_ENABLED !== 1) throw new Error("Enable this discount for online orders before creating a code.");
  return prisma.business_discount_code.create({ data: { BUSINESS_ID: businessId, DISCOUNT_ID: discountId, CODE: code } });
}

export async function setCodeActive(businessId: number, codeId: number, active: boolean) {
  await requireOrdersBusinessAccess(businessId);
  const result = await prisma.business_discount_code.updateMany({
    where: { CODE_ID: codeId, BUSINESS_ID: businessId }, data: { ACTIVE: active ? 1 : 0 },
  });
  if (!result.count) throw new Error("Code not found.");
}
