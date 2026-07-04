import type { PrismaClient } from "../../prisma/generated/prisma/client";

type InventoryTx = Pick<
  PrismaClient,
  "business_product" | "business_order_detail"
>;

type OrderItem = {
  productId: number;
  quantity: number;
};

export async function reserveOrderInventory(
  tx: InventoryTx,
  businessId: number,
  items: OrderItem[]
) {
  for (const item of items) {
    const product = await tx.business_product.findFirst({
      where: {
        BUSINESS_ID: businessId,
        BUSINESS_PRODUCT_ID: item.productId,
        STATUS: 1,
      },
      select: {
        BUSINESS_PRODUCT_ID: true,
        TITLE: true,
        TRACK_INVENTORY: true,
        INVENTORY_AVAILABLE: true,
      },
    });

    if (!product) throw new Error("One or more products are unavailable");
    if (product.TRACK_INVENTORY !== 1) continue;

    const available = product.INVENTORY_AVAILABLE ?? 0;
    if (available < item.quantity) {
      throw new Error(
        `Only ${available} left in stock for ${product.TITLE || `Product #${item.productId}`}`
      );
    }

    const updated = await tx.business_product.updateMany({
      where: {
        BUSINESS_PRODUCT_ID: item.productId,
        TRACK_INVENTORY: 1,
        INVENTORY_AVAILABLE: { gte: item.quantity },
      },
      data: {
        INVENTORY_AVAILABLE: { decrement: item.quantity },
        INVENTORY_COMMITED: { increment: item.quantity },
      },
    });

    if (updated.count !== 1) {
      throw new Error(
        `Only ${available} left in stock for ${product.TITLE || `Product #${item.productId}`}`
      );
    }
  }
}

export async function finalizeOrderInventory(
  tx: InventoryTx,
  orderId: number
) {
  const details = await tx.business_order_detail.findMany({
    where: { BUSINESS_ORDER_ID: orderId },
    select: { BUSINESS_PRODUCT_ID: true, ORDER_QUANTITY: true },
  });

  for (const detail of details) {
    if (!detail.BUSINESS_PRODUCT_ID) continue;

    const quantity = detail.ORDER_QUANTITY || 0;
    if (quantity <= 0) continue;

    const product = await tx.business_product.findFirst({
      where: {
        BUSINESS_PRODUCT_ID: detail.BUSINESS_PRODUCT_ID,
        TRACK_INVENTORY: 1,
      },
      select: {
        BUSINESS_PRODUCT_ID: true,
        INVENTORY_ON_HAND: true,
        INVENTORY_COMMITED: true,
      },
    });

    if (!product) continue;

    await tx.business_product.update({
      where: { BUSINESS_PRODUCT_ID: product.BUSINESS_PRODUCT_ID },
      data: {
        INVENTORY_ON_HAND: Math.max((product.INVENTORY_ON_HAND ?? 0) - quantity, 0),
        INVENTORY_COMMITED: Math.max((product.INVENTORY_COMMITED ?? 0) - quantity, 0),
      },
    });
  }
}

export async function releaseOrderInventory(tx: InventoryTx, orderId: number) {
  const details = await tx.business_order_detail.findMany({
    where: { BUSINESS_ORDER_ID: orderId },
    select: { BUSINESS_PRODUCT_ID: true, ORDER_QUANTITY: true },
  });

  for (const detail of details) {
    if (!detail.BUSINESS_PRODUCT_ID) continue;

    const quantity = detail.ORDER_QUANTITY || 0;
    if (quantity <= 0) continue;

    const product = await tx.business_product.findFirst({
      where: {
        BUSINESS_PRODUCT_ID: detail.BUSINESS_PRODUCT_ID,
        TRACK_INVENTORY: 1,
      },
      select: {
        BUSINESS_PRODUCT_ID: true,
        INVENTORY_COMMITED: true,
      },
    });

    if (!product) continue;

    await tx.business_product.update({
      where: { BUSINESS_PRODUCT_ID: product.BUSINESS_PRODUCT_ID },
      data: {
        INVENTORY_AVAILABLE: { increment: quantity },
        INVENTORY_COMMITED: Math.max((product.INVENTORY_COMMITED ?? 0) - quantity, 0),
      },
    });
  }
}
