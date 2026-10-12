import assert from "node:assert/strict";
import test from "node:test";
import { buildPosReceipt } from "@/services/pos-management";

test("POS receipt keeps official order number and custom lines", () => {
  const receipt = buildPosReceipt(
    {
      BUSINESS_ORDER_ID: 42,
      ORDER_NUMBER: "FDZ.000042",
      CREATION_DATETIME: new Date("2026-10-13T12:00:00.000Z"),
      PAYMENT_MODE: "card",
      ORDER_FINAL_AMOUNT: 17.5,
    },
    {
      BUSINESS_NAME: "Food of Punjab",
      ADDRESS_STREET: "Test Street 1",
      ADDRESS_ZIP: BigInt(8000),
      ADDRESS_TOWN: "Zurich",
    },
    [
      {
        BUSINESS_PRODUCT_ID: 7,
        ORDER_QUANTITY: 2,
        PRODUCT_SELL_PRICE: 5,
        PRODUCT_PRICE: 10,
      },
      {
        BUSINESS_PRODUCT_ID: null,
        ORDER_QUANTITY: 1,
        PRODUCT_SELL_PRICE: 7.5,
        PRODUCT_PRICE: 7.5,
      },
    ],
    new Map([[7, "Chicken burger"]])
  );

  assert.equal(receipt.orderNumber, "FDZ.000042");
  assert.equal(receipt.restaurantAddress, "Test Street 1, 8000 Zurich");
  assert.equal(receipt.paymentMethod, "card");
  assert.deepEqual(receipt.items.map((item) => item.name), ["Chicken burger", "Custom item"]);
  assert.equal(receipt.total, 17.5);
});
