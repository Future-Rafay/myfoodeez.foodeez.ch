import { unsubscribeByToken } from "@/services/marketing-campaigns";

// Public. Serves RFC 8058 one-click POSTs from mail providers (token in the query) and the confirmation form on /unsubscribe
// (token in the body). The signed token is the credential.
export async function POST(request: Request) {
  const url = new URL(request.url);
  const form = await request.formData().catch(() => null);
  const token = url.searchParams.get("token") ?? String(form?.get("token") ?? "");
  const valid = token.length > 0 && token.length <= 200 && (await unsubscribeByToken(token).catch((error) => {
    console.error("Unsubscribe failed:", error);
    return false;
  }));
  if (form?.get("from") === "page") return Response.redirect(new URL(`/unsubscribe?${valid ? "done=1" : "invalid=1"}`, url), 303);
  return Response.json({ unsubscribed: valid }, { status: valid ? 200 : 400 });
}
