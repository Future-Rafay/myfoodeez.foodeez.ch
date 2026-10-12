import assert from "node:assert/strict";
import test from "node:test";
import { isDeliveryEnabled } from "./fulfillment";

test("delivery is disabled unless explicitly enabled", () => {
  assert.equal(isDeliveryEnabled(), false);
  assert.equal(isDeliveryEnabled({ DELIVERY_ENABLED: null }), false);
  assert.equal(isDeliveryEnabled({ DELIVERY_ENABLED: 0 }), false);
  assert.equal(isDeliveryEnabled({ DELIVERY_ENABLED: 1 }), true);
});
