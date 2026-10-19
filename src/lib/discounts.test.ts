import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript test runner requires the file extension.
import { bestDiscount, calculateDiscount, swissDate, type Discount } from "./discounts.ts";

const base: Discount = {
  id: 1, name: "Promotion", type: "percentage", value: 10, minimumOrder: null,
  active: true, posEnabled: true, onlineEnabled: true, onlineAutomatic: true,
  validFrom: null, validUntil: null,
};

test("discounts use CHF cents and never make items free", () => {
  assert.equal(calculateDiscount(base, 15000, "pos"), 1500);
  assert.equal(calculateDiscount({ ...base, type: "fixed", value: 10 }, 15000, "pos"), 1000);
  assert.equal(calculateDiscount({ ...base, type: "fixed", value: 10 }, 1000, "pos"), 0);
  assert.equal(calculateDiscount({ ...base, type: "fixed", value: 10 }, 999, "pos"), 0);
  assert.equal(calculateDiscount({ ...base, type: "fixed", value: 10 }, 1001, "pos"), 1000);
  assert.equal(calculateDiscount(base, 1, "pos"), 0);
  assert.equal(calculateDiscount(base, 105, "pos"), 11);
});

test("minimum, channel, date and active rules are enforced", () => {
  const now = new Date("2026-10-19T22:30:00.000Z");
  assert.equal(swissDate(now), "2026-10-20");
  assert.equal(calculateDiscount({ ...base, minimumOrder: 100 }, 9999, "pos", now), 0);
  assert.equal(calculateDiscount({ ...base, minimumOrder: 100 }, 10000, "pos", now), 1000);
  assert.equal(calculateDiscount({ ...base, validUntil: "2026-10-19" }, 10000, "pos", now), 0);
  assert.equal(calculateDiscount({ ...base, validFrom: "2026-10-20" }, 10000, "pos", now), 1000);
  assert.equal(calculateDiscount({ ...base, posEnabled: false }, 10000, "pos", now), 0);
  assert.equal(calculateDiscount({ ...base, active: false }, 10000, "online", now), 0);
});

test("one best offer wins, with coupon tie priority and card minimum", () => {
  const candidates = [
    { discount: base, code: null },
    { discount: { ...base, id: 2, name: "WELCOME10" }, code: "WELCOME10" },
  ];
  assert.equal(bestDiscount(candidates, 10000, "online")?.id, 2);
  assert.equal(bestDiscount([{ discount: { ...base, value: 15 }, code: null }, candidates[1]], 10000, "online")?.id, 1);
  assert.equal(bestDiscount(candidates, 100, "online", 50)?.id, 2);
  assert.equal(bestDiscount([{ discount: { ...base, type: "fixed", value: 0.75 }, code: null }], 100, "online", 50), null);
});
