import { createHmac, timingSafeEqual } from "node:crypto";
import { resolve4, resolve6, resolveMx } from "node:dns/promises";
import sanitizeHtml from "sanitize-html";
import { escapeHtml } from "@/lib/email";

// Ported from Zambiel's src/server/email/marketing.ts: sanitising, merge fields, undeliverable checks, unsubscribe tokens.

const BRAND = { primary: "#FF4D00", border: "#E5E7EB", text: "#1F2937", muted: "#6B7280" };

const colorValue = [/^#[0-9a-f]{3,8}$/i, /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0|1|0?\.\d+)\s*)?\)$/i];

/** Keeps only simple formatting tags; scripts, styles, forms and images are removed. */
export function sanitizeMarketingHtml(html: string) {
  const clean = sanitizeHtml(html, {
    allowedTags: ["p", "br", "h1", "h2", "h3", "ul", "ol", "li", "strong", "em", "s", "u", "blockquote", "hr", "a", "span"],
    allowedAttributes: { a: ["href"], span: ["style"] },
    allowedStyles: { span: { color: colorValue } },
    allowedSchemes: ["http", "https", "mailto"],
  }).trim();
  return inlineEmailStyles(clean);
}

// Email clients ignore stylesheets, so the sanitised tags get inline styles.
function inlineEmailStyles(html: string) {
  const heading = (size: number) => `margin:24px 0 12px;font-family:Arial,sans-serif;font-size:${size}px;line-height:1.25;font-weight:700;color:${BRAND.text}`;
  return html
    .replaceAll("<h1>", `<h1 style="${heading(26)}">`)
    .replaceAll("<h2>", `<h2 style="${heading(21)}">`)
    .replaceAll("<h3>", `<h3 style="${heading(17)}">`)
    .replaceAll("<p>", '<p style="margin:0 0 16px">')
    .replaceAll("<blockquote>", `<blockquote style="margin:0 0 16px;padding-left:16px;border-left:4px solid ${BRAND.primary}">`)
    .replaceAll("<hr />", `<hr style="border:0;border-top:1px solid ${BRAND.border};margin:24px 0" />`)
    .replaceAll("<a ", `<a style="color:${BRAND.primary}" `);
}

export type MergeRecipient = { email: string; name: string | null; town?: string | null; claimUrl?: string | null };

export function mergeValues(recipient: MergeRecipient): Record<string, string> {
  return {
    "{{restaurant_name}}": recipient.name?.trim() || "your restaurant",
    "{{town}}": recipient.town?.trim() || "your town",
    "{{claim_url}}": recipient.claimUrl || "https://foodeez.ch/business/register",
    "{{email}}": recipient.email,
  };
}

/** escape: true for HTML bodies (names can contain "<" or "&"), false for subject lines. */
export function applyMergeFields(template: string, recipient: MergeRecipient, escape: boolean) {
  const values = mergeValues(recipient);
  return template.replace(/\{\{(restaurant_name|town|claim_url|email)\}\}/g, (field) => (escape ? escapeHtml(values[field]) : values[field]));
}

// RFC 2606/6761 reserved domains never receive mail; Resend rejects the whole batch if one appears.
export function isUndeliverableEmail(email: string) {
  const domain = email.split("@").pop()?.toLowerCase() ?? "";
  return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || /(^|\.)(test|example|invalid|localhost)$/.test(domain) || /(^|\.)example\.(com|net|org)$/.test(domain);
}

// A domain with no MX/A/AAAA record is rejected by Resend and fails the whole batch.
// Only "no such domain/record" counts as undeliverable; timeouts or offline DNS let the address through.
export async function domainAcceptsMail(domain: string) {
  for (const lookup of [resolveMx, resolve4, resolve6]) {
    try {
      if ((await lookup(domain)).length) return true;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOTFOUND" && code !== "ENODATA") return true;
    }
  }
  return false;
}

export function htmlToText(html: string) {
  return sanitizeHtml(html.replace(/<\/(p|h[1-3]|li|blockquote)>|<br\s*\/?>/gi, "\n"), { allowedTags: [], allowedAttributes: {} })
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();
}

function tokenSecret() {
  const value = process.env.MARKETING_TOKEN_SECRET || process.env.NEXTAUTH_SECRET;
  if (!value) throw new Error("Unsubscribe links are not configured.");
  return value;
}

const sign = (recipientId: number) => createHmac("sha256", tokenSecret()).update(`marketing-unsubscribe:${recipientId}`).digest("base64url");

/** The token names a recipient row, never the email address, so links carry no personal data. */
export const unsubscribeToken = (recipientId: number) => `${recipientId}.${sign(recipientId)}`;

export function verifyUnsubscribeToken(token: string) {
  const [id, signature] = token.split(".");
  const recipientId = Number(id);
  if (!signature || !Number.isInteger(recipientId) || recipientId <= 0) return null;
  const expected = Buffer.from(sign(recipientId));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual) ? recipientId : null;
}

/** Wraps a campaign body in the Foodeez email layout with the unsubscribe footer. */
export function marketingEmailHtml(input: { subject: string; bodyHtml: string; unsubscribeUrl: string; audience: "business" | "subscriber" }) {
  const reason =
    input.audience === "business"
      ? "You receive this email because your restaurant's contact address is listed publicly."
      : "You receive this email because you subscribed to the Foodeez newsletter.";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(input.subject)}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6">
<div style="max-width:600px;margin:0 auto;padding:24px 16px">
<div style="background:#ffffff;border-radius:12px;padding:32px 28px;font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:${BRAND.text}">
<p style="margin:0 0 24px;font-size:22px;font-weight:700;color:${BRAND.primary}">Foodeez</p>
${input.bodyHtml}
</div>
<p style="margin:16px 8px 0;font-family:Arial,sans-serif;font-size:12px;line-height:1.5;color:${BRAND.muted}">${reason}<br>Foodeez · foodeez.ch · <a href="${escapeHtml(input.unsubscribeUrl)}" style="color:${BRAND.muted}">Unsubscribe</a></p>
</div></body></html>`;
}

export const STARTER_TEMPLATES = {
  blank: { label: "Blank", subject: "", html: "<p>Hello {{restaurant_name}} team,</p><p></p>" },
  outreach: {
    label: "Restaurant invitation",
    subject: "{{restaurant_name}} is already on Foodeez",
    html:
      "<h1>Your restaurant is already on Foodeez</h1><p>Hello {{restaurant_name}} team,</p><p>Guests in {{town}} already find {{restaurant_name}} on Foodeez, the Swiss platform for discovering restaurants and ordering online.</p><h2>Claim your free profile</h2><ul><li>Show your menu, opening hours and photos</li><li>Take pickup and delivery orders online, paid by card or cash</li><li>Reach new guests in your area</li></ul><p><a href=\"{{claim_url}}\">Claim {{restaurant_name}} on Foodeez</a></p><p>It takes two minutes: we send a code to this email address to confirm it is yours.</p><p>Kind regards,<br>Your Foodeez team</p>",
  },
  newsletter: {
    label: "Newsletter",
    subject: "News from Foodeez",
    html: "<h1>Foodeez news</h1><p>Hello,</p><p>A short introduction to this edition.</p><h2>New on Foodeez</h2><p>Share new restaurants, features or tips.</p><p><a href=\"https://foodeez.ch\">Visit Foodeez</a></p><p>Kind regards,<br>Your Foodeez team</p>",
  },
} as const;

export type StarterTemplate = keyof typeof STARTER_TEMPLATES;
