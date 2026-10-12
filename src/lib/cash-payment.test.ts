import assert from "node:assert/strict";
import test from "node:test";
import { canMarkCashOrderPaid, getAllowedOrderActions, isUnpaidCardOrder, ORDER_STATUS, PAYMENT_DONE } from "./orderStatus";

test("manual payment confirmation is limited to pending cash orders", () => {
  const pending = { PAYMENT_DONE: PAYMENT_DONE.PENDING, ORDER_STATUS: ORDER_STATUS.PREPARING };
  assert.equal(canMarkCashOrderPaid({ ...pending, PAYMENT_MODE: "cash_on_delivery" }), true);
  assert.equal(canMarkCashOrderPaid({ ...pending, PAYMENT_MODE: "pay_at_pickup" }), true);
  assert.equal(canMarkCashOrderPaid({ ...pending, PAYMENT_MODE: "cash" }), true);
  assert.equal(canMarkCashOrderPaid({ ...pending, PAYMENT_MODE: "stripe" }), false);
  assert.equal(canMarkCashOrderPaid({ ...pending, PAYMENT_MODE: "card" }), false);
  assert.equal(canMarkCashOrderPaid({ ...pending, PAYMENT_MODE: "cash", ORDER_STATUS: ORDER_STATUS.REJECTED }), false);
  assert.equal(canMarkCashOrderPaid({ PAYMENT_DONE: PAYMENT_DONE.REFUNDED, PAYMENT_MODE: "cash" }), false);
});

test("unpaid card orders have no fulfillment actions", () => {
  const pendingCard = {
    PAYMENT_MODE: "stripe",
    PAYMENT_DONE: PAYMENT_DONE.PENDING,
    ORDER_STATUS: ORDER_STATUS.PREPARING,
    ORDER_TYPE: "delivery",
  };
  assert.equal(isUnpaidCardOrder(pendingCard), true);
  assert.deepEqual(getAllowedOrderActions(pendingCard), []);
  assert.equal(isUnpaidCardOrder({ ...pendingCard, PAYMENT_DONE: PAYMENT_DONE.PAID }), false);
  assert.ok(getAllowedOrderActions({ ...pendingCard, PAYMENT_DONE: PAYMENT_DONE.PAID }).length > 0);
});
