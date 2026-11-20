import assert from "node:assert/strict";
import test from "node:test";
import {
  localDateInputValue,
  localDayIsoRange,
  parsePosDateBoundary,
  zurichDayRange,
} from "./pos-date-range";

test("Zurich day range ignores the server time zone across winter, summer and DST days", () => {
  const previousTimezone = process.env.TZ;
  process.env.TZ = "UTC";
  try {
    const iso = (value: string) => {
      const { start, end } = zurichDayRange(value);
      return [start.toISOString(), end.toISOString()];
    };
    assert.deepEqual(iso("2026-11-20"), ["2026-11-19T23:00:00.000Z", "2026-11-20T22:59:59.999Z"]);
    assert.deepEqual(iso("2026-07-01"), ["2026-06-30T22:00:00.000Z", "2026-07-01T21:59:59.999Z"]);
    // 29 March 2026: clocks jump forward, so the day is 23 hours long.
    assert.deepEqual(iso("2026-03-29"), ["2026-03-28T23:00:00.000Z", "2026-03-29T21:59:59.999Z"]);
    assert.deepEqual(iso("2026-12-31"), ["2026-12-30T23:00:00.000Z", "2026-12-31T22:59:59.999Z"]);
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});

test("POS today follows the browser calendar rather than the UTC calendar", () => {
  const previousTimezone = process.env.TZ;
  process.env.TZ = "America/Los_Angeles";
  try {
    const instant = new Date("2026-01-02T00:30:00.000Z");
    assert.equal(localDateInputValue(instant), "2026-01-01");
    assert.deepEqual(localDayIsoRange("2026-01-01"), {
      dateFrom: "2026-01-01T08:00:00.000Z",
      dateTo: "2026-01-02T07:59:59.999Z",
    });
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});

test("POS server boundaries preserve explicit browser timestamps", () => {
  assert.equal(
    parsePosDateBoundary("2026-10-13T19:00:00.000Z").toISOString(),
    "2026-10-13T19:00:00.000Z"
  );
  assert.throws(() => parsePosDateBoundary("2026-02-30"), /Invalid date/);
});
