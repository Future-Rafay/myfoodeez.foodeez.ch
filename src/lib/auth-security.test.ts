import assert from "node:assert/strict";
import test from "node:test";

process.env.NEXTAUTH_SECRET ??= "test-secret";

test("reset tokens must be the 64-character hex string the email carries", async () => {
  const { isResetToken } = await import("./auth");
  assert.equal(isResetToken("a".repeat(64)), true);
  assert.equal(isResetToken({ not: "" }), false);
  assert.equal(isResetToken("A".repeat(64)), false);
  assert.equal(isResetToken("a".repeat(63)), false);
});

test("a session ends once the account password changes", async () => {
  const { checkPasswordSession, passwordFingerprint } = await import("./auth");
  const token = { email: "owner@example.com", pwf: passwordFingerprint("old-hash")!, pwCheckedAt: 0 };
  assert.equal(await checkPasswordSession({ ...token }, async () => "old-hash"), true);
  assert.equal(await checkPasswordSession({ ...token }, async () => "new-hash"), false);
  assert.equal(await checkPasswordSession({ ...token }, async () => null), false);
  // Checked recently: no database read.
  assert.equal(await checkPasswordSession({ ...token, pwCheckedAt: Date.now() }, async () => { throw new Error("read"); }), true);
  // Database error keeps the session for the next check.
  assert.equal(await checkPasswordSession({ ...token }, async () => { throw new Error("db down"); }), true);
});

test("admin rate-limit keys never collide with the customer site's keys", async () => {
  const { rateLimitKeys, LOGIN_LIMITS } = await import("./rate-limit");
  const headers = new Headers({ "x-forwarded-for": "1.2.3.4" });
  const keys = rateLimitKeys(headers, "login", " Owner@Example.com ", LOGIN_LIMITS);
  assert.equal(keys.length, 2);
  assert.deepEqual(keys.map((k) => k.limit), [LOGIN_LIMITS.ip.limit, LOGIN_LIMITS.email.limit]);
  assert.deepEqual(rateLimitKeys(headers, "login", "owner@example.com", LOGIN_LIMITS), keys);
});
