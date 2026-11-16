import assert from "node:assert/strict";
import test from "node:test";

process.env.NEXTAUTH_SECRET ??= "test-secret";

test("campaign HTML keeps formatting and the claim link but drops scripts, images and handlers", async () => {
  const { sanitizeMarketingHtml } = await import("./marketing");
  const html = sanitizeMarketingHtml('<h1 onclick="x()">Hi</h1><script>alert(1)</script><img src="https://evil.example/x.png"><p><a href="{{claim_url}}">Claim</a> <a href="javascript:alert(1)">bad</a></p>');
  assert.match(html, /<h1 style="[^"]+">Hi<\/h1>/);
  assert.doesNotMatch(html, /script|onclick|<img|javascript:/);
  assert.match(html, /<a style="[^"]+" href="\{\{claim_url\}\}">Claim<\/a>/);
});

test("merge fields are escaped in the body and plain in the subject", async () => {
  const { applyMergeFields } = await import("./marketing");
  const recipient = { email: "owner@pizza.ch", name: "Pizza <b>&</b> Co", town: "Zürich", claimUrl: "https://foodeez.ch/manage-business/pizza-1" };
  assert.equal(applyMergeFields("{{restaurant_name}} in {{town}}", recipient, false), "Pizza <b>&</b> Co in Zürich");
  assert.equal(applyMergeFields("<p>{{restaurant_name}}</p>", recipient, true), "<p>Pizza &lt;b&gt;&amp;&lt;/b&gt; Co</p>");
  assert.equal(applyMergeFields("{{restaurant_name}} {{town}}", { email: "x@y.ch", name: null }, false), "your restaurant your town");
});

test("unsubscribe tokens name a recipient row and cannot be forged", async () => {
  const { unsubscribeToken, verifyUnsubscribeToken } = await import("./marketing");
  const token = unsubscribeToken(42);
  assert.equal(verifyUnsubscribeToken(token), 42);
  assert.equal(verifyUnsubscribeToken(token.replace(/^42\./, "43.")), null);
  assert.equal(verifyUnsubscribeToken("42"), null);
  assert.equal(verifyUnsubscribeToken(`0.${token.split(".")[1]}`), null);
  assert.doesNotMatch(token, /@/);
});

test("reserved and malformed addresses are never sent to Resend", async () => {
  const { isUndeliverableEmail } = await import("./marketing");
  assert.equal(isUndeliverableEmail("info@pizza.ch"), false);
  assert.equal(isUndeliverableEmail("test@example.com"), true);
  assert.equal(isUndeliverableEmail("a@shop.test"), true);
  assert.equal(isUndeliverableEmail("no-at-sign"), true);
});

test("restaurant filters default to unclaimed, live, and not emailed in 30 days", async () => {
  const { readFilters } = await import("../services/marketing-campaigns");
  const from = (values: Record<string, string>) => ({ get: (name: string) => values[name] ?? null });
  assert.deepEqual(readFilters(from({})), { town: "", unclaimedOnly: true, liveOnly: true, skipEmailedDays: 30 });
  assert.deepEqual(readFilters(from({ town: " Bern ", unclaimed: "0", live: "0", skipDays: "0" })), { town: "Bern", unclaimedOnly: false, liveOnly: false, skipEmailedDays: 0 });
  assert.equal(readFilters(from({ skipDays: "9999" })).skipEmailedDays, 30);
});
