import { Resend } from "resend";

// One Resend client for the admin app. EMAIL_FROM must use a domain verified in Resend.

let client: Resend | null = null;

export class EmailNotConfiguredError extends Error {
  constructor() {
    super("Email is not configured (RESEND_API_KEY).");
    this.name = "EmailNotConfiguredError";
  }
}

export function resend() {
  if (!process.env.RESEND_API_KEY) throw new EmailNotConfiguredError();
  client ??= new Resend(process.env.RESEND_API_KEY);
  return client;
}

export const emailFrom = () => process.env.EMAIL_FROM || "Foodeez <no-reply@foodeez.ch>";

export const escapeHtml = (value: string) =>
  value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!);

/** A short transactional email in the Foodeez style. Paragraphs are plain text and are escaped. */
export async function sendSimpleEmail(input: { to: string; subject: string; paragraphs: string[]; button?: { label: string; url: string } }) {
  const body = input.paragraphs.map((text) => `<p style="margin:0 0 16px">${escapeHtml(text)}</p>`).join("");
  const button = input.button
    ? `<p style="margin:24px 0"><a href="${escapeHtml(input.button.url)}" style="display:inline-block;background:#FF4D00;color:#ffffff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600">${escapeHtml(input.button.label)}</a></p>`
    : "";
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#1f2937;max-width:560px;margin:0 auto;padding:24px">${body}${button}<p style="margin:32px 0 0;color:#6b7280;font-size:13px">Foodeez · foodeez.ch</p></div>`;
  const text = [...input.paragraphs, ...(input.button ? [`${input.button.label}: ${input.button.url}`] : [])].join("\n\n");
  const result = await resend().emails.send({ from: emailFrom(), to: input.to, subject: input.subject, html, text });
  if (result.error) throw new Error(result.error.message);
}
