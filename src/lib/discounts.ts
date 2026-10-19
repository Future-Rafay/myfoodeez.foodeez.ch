export type Discount = {
  id: number;
  name: string;
  type: "percentage" | "fixed";
  value: number;
  minimumOrder: number | null;
  active: boolean;
  posEnabled: boolean;
  onlineEnabled: boolean;
  onlineAutomatic: boolean;
  validFrom: string | null;
  validUntil: string | null;
};

export type AppliedDiscount = {
  id: number;
  name: string;
  type: Discount["type"];
  value: number;
  amountCents: number;
  code: string | null;
};

export const cents = (amount: number) => Math.round(amount * 100);
export const chf = (amountCents: number) => amountCents / 100;

export function swissDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function calculateDiscount(
  discount: Discount,
  subtotalCents: number,
  channel: "pos" | "online",
  now = new Date()
): number {
  const today = swissDate(now);
  if (!discount.active || !(channel === "pos" ? discount.posEnabled : discount.onlineEnabled)) return 0;
  if (discount.validFrom && today < discount.validFrom) return 0;
  if (discount.validUntil && today > discount.validUntil) return 0;
  if (subtotalCents <= 0 || subtotalCents < cents(discount.minimumOrder ?? 0)) return 0;
  const amount = discount.type === "percentage"
    ? Math.round(subtotalCents * cents(discount.value) / 10000)
    : cents(discount.value);
  return amount > 0 && amount < subtotalCents ? amount : 0;
}

export function bestDiscount(
  candidates: Array<{ discount: Discount; code: string | null }>,
  subtotalCents: number,
  channel: "pos" | "online",
  minimumPayableCents = 1
): AppliedDiscount | null {
  const applicable = candidates.map(({ discount, code }) => ({
    id: discount.id,
    name: discount.name,
    type: discount.type,
    value: discount.value,
    amountCents: calculateDiscount(discount, subtotalCents, channel),
    code,
  })).filter((item) => item.amountCents > 0 && subtotalCents - item.amountCents >= minimumPayableCents);
  applicable.sort((a, b) =>
    b.amountCents - a.amountCents || Number(Boolean(b.code)) - Number(Boolean(a.code)) || a.id - b.id
  );
  return applicable[0] ?? null;
}
