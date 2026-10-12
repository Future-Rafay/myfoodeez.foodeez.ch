import assert from "node:assert/strict";
import test from "node:test";
import {
  consumeImmediateSaleInventory,
  InventoryUnavailableError,
  finalizeOrderInventory,
  releaseOrderInventory,
  reserveOrderInventory,
} from "./inventory";

test("immediate POS sale aggregates repeated products and consumes stock once", async () => {
  let available = 5;
  let onHand = 7;
  const committed = 2;
  let updates = 0;
  const db = {
    business_product: {
      updateMany: async ({ where, data }: { where: { BUSINESS_ID: number; INVENTORY_AVAILABLE: { gte: number }; INVENTORY_ON_HAND: { gte: number } }; data: { INVENTORY_AVAILABLE: { decrement: number }; INVENTORY_ON_HAND: { decrement: number } } }) => {
        assert.equal(where.BUSINESS_ID, 7);
        updates += 1;
        if (available < where.INVENTORY_AVAILABLE.gte || onHand < where.INVENTORY_ON_HAND.gte) return { count: 0 };
        available -= data.INVENTORY_AVAILABLE.decrement;
        onHand -= data.INVENTORY_ON_HAND.decrement;
        return { count: 1 };
      },
    },
  };

  await consumeImmediateSaleInventory(db as never, 7, [
    { productId: 11, quantity: 2, title: "Soup", trackInventory: true },
    { productId: 11, quantity: 1, title: "Soup", trackInventory: true },
  ]);
  assert.deepEqual({ available, onHand, committed, updates }, { available: 2, onHand: 4, committed: 2, updates: 1 });
});

test("immediate POS sale rejects insufficient stock and another business", async () => {
  const db = {
    business_product: {
      updateMany: async ({ where }: { where: { BUSINESS_ID: number; INVENTORY_AVAILABLE: { gte: number } } }) => ({
        count: where.BUSINESS_ID === 7 && where.INVENTORY_AVAILABLE.gte <= 1 ? 1 : 0,
      }),
    },
  };
  await assert.rejects(
    consumeImmediateSaleInventory(db as never, 7, [{ productId: 11, quantity: 2, title: "Soup", trackInventory: true }]),
    InventoryUnavailableError
  );
  await assert.rejects(
    consumeImmediateSaleInventory(db as never, 8, [{ productId: 11, quantity: 1, title: "Soup", trackInventory: true }]),
    InventoryUnavailableError
  );
});

test("immediate POS sale leaves untracked stock untouched and detects a tracking change", async () => {
  let tracking: number | null = null;
  const db = {
    business_product: {
      findFirst: async ({ where }: { where: { BUSINESS_ID: number } }) =>
        where.BUSINESS_ID === 7 ? { BUSINESS_PRODUCT_ID: 11, TRACK_INVENTORY: tracking } : null,
      updateMany: async () => { throw new Error("Untracked product must not decrement stock"); },
    },
  };
  const item = { productId: 11, quantity: 1, title: "Soup", trackInventory: false };
  await consumeImmediateSaleInventory(db as never, 7, [item]);
  tracking = 1;
  await assert.rejects(consumeImmediateSaleInventory(db as never, 7, [item]), InventoryUnavailableError);
});

test("inventory reservation is business-scoped and rejects competing reservations", async () => {
  let available = 1;
  let committed = 0;
  const db = {
    business_product: {
      findFirst: async ({ where }: { where: { BUSINESS_ID: number } }) =>
        where.BUSINESS_ID === 7
          ? {
              BUSINESS_PRODUCT_ID: 11,
              TITLE: "Test product",
              TRACK_INVENTORY: 1,
              INVENTORY_AVAILABLE: available,
            }
          : null,
      updateMany: async ({ where }: { where: { INVENTORY_AVAILABLE: { gte: number } } }) => {
        if (available < where.INVENTORY_AVAILABLE.gte) return { count: 0 };
        available -= where.INVENTORY_AVAILABLE.gte;
        committed += where.INVENTORY_AVAILABLE.gte;
        return { count: 1 };
      },
    },
  };

  await assert.rejects(
    reserveOrderInventory(db as never, 8, [{ productId: 11, quantity: 1 }]),
    /unavailable/
  );
  await reserveOrderInventory(db as never, 7, [{ productId: 11, quantity: 1 }]);
  await assert.rejects(
    reserveOrderInventory(db as never, 7, [{ productId: 11, quantity: 1 }]),
    /Only 0 left/
  );
  assert.deepEqual({ available, committed }, { available: 0, committed: 1 });
});

test("inventory finalization consumes the reserved stock", async () => {
  let onHand = 10;
  let committed = 2;
  const db = {
    business_order: {
      findUnique: async () => ({ INVENTORY_RELEASED_DATETIME: null }),
    },
    business_order_detail: {
      findMany: async () => [{ BUSINESS_PRODUCT_ID: 11, ORDER_QUANTITY: 2 }],
    },
    business_product: {
      findFirst: async () => ({
        BUSINESS_PRODUCT_ID: 11,
        INVENTORY_ON_HAND: onHand,
        INVENTORY_COMMITED: committed,
      }),
      update: async ({ data }: { data: { INVENTORY_ON_HAND: number; INVENTORY_COMMITED: number } }) => {
        onHand = data.INVENTORY_ON_HAND;
        committed = data.INVENTORY_COMMITED;
      },
    },
  };

  await finalizeOrderInventory(db as never, 41);
  assert.deepEqual({ onHand, committed }, { onHand: 8, committed: 0 });
});

test("inventory release is claimed once across retries", async () => {
  let claimed = false;
  let available = 8;
  let committed = 2;
  const db = {
    business_order: {
      updateMany: async () => {
        if (claimed) return { count: 0 };
        claimed = true;
        return { count: 1 };
      },
    },
    business_order_detail: {
      findMany: async () => [{ BUSINESS_PRODUCT_ID: 11, ORDER_QUANTITY: 2 }],
    },
    business_product: {
      findFirst: async () => ({ BUSINESS_PRODUCT_ID: 11 }),
      updateMany: async () => {
        available += 2;
        committed -= 2;
        return { count: 1 };
      },
    },
  };

  await releaseOrderInventory(db as never, 41);
  await releaseOrderInventory(db as never, 41);
  assert.deepEqual({ available, committed }, { available: 10, committed: 0 });
});
