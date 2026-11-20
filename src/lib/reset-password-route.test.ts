import assert from "node:assert/strict";
import test from "node:test";

test("reset password rejects non-string tokens before querying users", async () => {
  const { POST } = await import("@/app/api/auth/reset-password/route");
  const send = (body: unknown) =>
    POST(new Request("http://localhost/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(body),
    }));

  assert.equal((await send({ token: { not: "" }, password: "long-enough" })).status, 400);
  assert.equal((await send({ token: "abc", password: ["long-enough"] })).status, 400);
  assert.equal((await send({ token: "abc", password: "short" })).status, 400);
});
