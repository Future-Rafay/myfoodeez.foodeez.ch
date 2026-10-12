import assert from "node:assert/strict";
import test from "node:test";

test("legacy admin order creation is retired", async () => {
  const { POST } = await import("@/app/api/businesses/[businessId]/orders/route");
  const response = await POST();

  assert.equal(response.status, 410);
  assert.match((await response.json()).error, /customer checkout/i);
});
