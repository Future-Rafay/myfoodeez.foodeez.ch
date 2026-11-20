import assert from "node:assert/strict";
import test from "node:test";

test("upcoming reservations switch at Swiss midnight, not UTC midnight", async () => {
  const { zurichToday } = await import("./reservations-management");
  // 23:30 UTC on 19 Nov is already 00:30 on 20 Nov in Zurich (UTC+1 in winter).
  assert.equal(zurichToday(new Date("2026-11-19T23:30:00Z")).toISOString(), "2026-11-20T00:00:00.000Z");
  assert.equal(zurichToday(new Date("2026-11-19T22:30:00Z")).toISOString(), "2026-11-19T00:00:00.000Z");
  // Summer time is UTC+2.
  assert.equal(zurichToday(new Date("2026-07-01T22:30:00Z")).toISOString(), "2026-07-02T00:00:00.000Z");
});
