import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Same table and key scheme as the customer site's checkout-rate-limit.ts; purposes are prefixed "admin-" so the two apps never share a counter.
type Rule = { limit: number; windowMs: number };
export type Limits = { ip: Rule; email: Rule };

export const LOGIN_LIMITS: Limits = {
  ip: { limit: 30, windowMs: 15 * 60 * 1000 },
  email: { limit: 10, windowMs: 15 * 60 * 1000 },
};

// Forms that send email: each address gets only a few per hour.
export const EMAIL_FORM_LIMITS: Limits = {
  ip: { limit: 10, windowMs: 60 * 60 * 1000 },
  email: { limit: 3, windowMs: 60 * 60 * 1000 },
};

export class RateLimitError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super("Too many requests. Please wait and try again.");
    this.name = "RateLimitError";
  }
}

function secret() {
  const value = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!value) throw new Error("Rate limiting is not configured.");
  return value;
}

export function clientIp(headers: Headers) {
  const forwarded = headers.get("x-vercel-forwarded-for") || headers.get("x-forwarded-for") || headers.get("x-real-ip");
  return forwarded?.split(",")[0]?.trim() || null;
}

export function rateLimitKeys(headers: Headers, purpose: string, email: string | null, limits: Limits) {
  const ip = clientIp(headers);
  const identities = [
    ...(ip ? [{ scope: "ip" as const, value: ip }] : []),
    ...(email !== null ? [{ scope: "email" as const, value: email.trim().toLowerCase() }] : []),
  ];
  return identities.map(({ scope, value }) => ({
    key: createHmac("sha256", secret()).update(`admin-${purpose}:${scope}:${value}`).digest("hex"),
    ...limits[scope],
  }));
}

/** Throws RateLimitError when this caller is over the limit for the given purpose. */
export async function enforceRateLimit(headers: Headers, purpose: string, email: string | null, limits: Limits) {
  const now = new Date();
  await prisma.checkout_rate_limit.deleteMany({
    where: { LAST_REQUEST_DATETIME: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
  });

  for (const rule of rateLimitKeys(headers, purpose, email, limits)) {
    const windowStart = new Date(now.getTime() - rule.windowMs);
    await prisma.$executeRaw`
      INSERT INTO checkout_rate_limit (
        RATE_LIMIT_KEY, WINDOW_STARTED_AT, REQUEST_COUNT, LAST_REQUEST_DATETIME
      ) VALUES (${rule.key}, ${now}, 1, ${now})
      ON DUPLICATE KEY UPDATE
        REQUEST_COUNT = IF(WINDOW_STARTED_AT <= ${windowStart}, 1, REQUEST_COUNT + 1),
        WINDOW_STARTED_AT = IF(WINDOW_STARTED_AT <= ${windowStart}, ${now}, WINDOW_STARTED_AT),
        LAST_REQUEST_DATETIME = ${now}
    `;
    const state = await prisma.checkout_rate_limit.findUnique({
      where: { RATE_LIMIT_KEY: rule.key },
      select: { REQUEST_COUNT: true, WINDOW_STARTED_AT: true },
    });
    if (state && state.REQUEST_COUNT > rule.limit) {
      throw new RateLimitError(
        Math.max(1, Math.ceil((state.WINDOW_STARTED_AT.getTime() + rule.windowMs - now.getTime()) / 1000))
      );
    }
  }
}

/** Returns a 429 response when the caller is over the limit, otherwise null. */
export async function rateLimitResponse(headers: Headers, purpose: string, email: string | null, limits: Limits) {
  try {
    await enforceRateLimit(headers, purpose, email, limits);
    return null;
  } catch (error) {
    if (!(error instanceof RateLimitError)) throw error;
    return NextResponse.json(
      { error: error.message, message: error.message },
      { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } }
    );
  }
}
