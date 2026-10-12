import assert from "node:assert/strict";
import test from "node:test";
import {
  localDateInputValue,
  localDayIsoRange,
  parsePosDateBoundary,
} from "./pos-date-range";

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
