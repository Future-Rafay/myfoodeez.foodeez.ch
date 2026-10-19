import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { calculateDiscount, cents, chf, type AppliedDiscount } from "@/lib/discounts";
import { consumeImmediateSaleInventory } from "@/lib/inventory";
import { generateOrderNumberFromId } from "@/lib/orderNumber";
import { ORDER_STATUS, PAYMENT_DONE } from "@/lib/orderStatus";
import { parsePosDateBoundary } from "@/lib/pos-date-range";
import prisma from "@/lib/prisma";
import { normalizePosItems, type RawPosItem } from "@/lib/pos-rules";
import { getMenuCardWorkspace, listMenuCards, type MenuCardDetailRow } from "@/services/menu-management";
import { requireOrdersBusinessAccess } from "@/services/orders-management";
import { discountRow } from "@/services/discount-management";

export type PosCatalog = {
  menus: Array<{ id: number; title: string; categories: MenuCardDetailRow[] }>;
};

export type PosCartItemInput = RawPosItem;

export type PosReceipt = {
  orderId: number;
  orderNumber: string;
  createdAt: string;
  restaurantName: string;
  restaurantAddress: string;
  paymentMethod: "cash" | "card";
  total: number;
  subtotal: number;
  discountAmount: number;
  discountName: string | null;
  items: Array<{ name: string; quantity: number; unitPrice: number; subtotal: number }>;
};

type PosOrderRecord = {
  BUSINESS_ORDER_ID: number;
  ORDER_NUMBER: string | null;
  CREATION_DATETIME: Date | null;
  PAYMENT_MODE: string | null;
  ORDER_FINAL_AMOUNT: unknown;
  ORDER_GROSS_AMOUNT?: unknown;
  ORDER_DISCOUNT_AMOUNT?: unknown;
  DISCOUNT_NAME?: string | null;
};

type PosReceiptBusiness = {
  BUSINESS_NAME: string | null;
  ADDRESS_STREET: string | null;
  ADDRESS_ZIP: bigint | null;
  ADDRESS_TOWN: string | null;
} | null;

type PosReceiptDetail = {
  BUSINESS_PRODUCT_ID: number | null;
  ORDER_QUANTITY: number | null;
  PRODUCT_SELL_PRICE: unknown;
  PRODUCT_PRICE: unknown;
};

const toNumber = (value: unknown) => Number(value ?? 0);

export function buildPosReceipt(
  order: PosOrderRecord,
  business: PosReceiptBusiness,
  details: PosReceiptDetail[],
  productNames: Map<number, string>
): PosReceipt {
  return {
    orderId: order.BUSINESS_ORDER_ID,
    orderNumber: order.ORDER_NUMBER || generateOrderNumberFromId(order.BUSINESS_ORDER_ID),
    createdAt: (order.CREATION_DATETIME || new Date()).toISOString(),
    restaurantName: business?.BUSINESS_NAME || "Restaurant",
    restaurantAddress: [
      business?.ADDRESS_STREET,
      [business?.ADDRESS_ZIP?.toString(), business?.ADDRESS_TOWN].filter(Boolean).join(" "),
    ].filter(Boolean).join(", "),
    paymentMethod: order.PAYMENT_MODE === "card" ? "card" : "cash",
    total: toNumber(order.ORDER_FINAL_AMOUNT),
    subtotal: toNumber(order.ORDER_GROSS_AMOUNT) || toNumber(order.ORDER_FINAL_AMOUNT),
    discountAmount: toNumber(order.ORDER_DISCOUNT_AMOUNT),
    discountName: order.DISCOUNT_NAME || null,
    items: details.map((detail) => {
      const quantity = toNumber(detail.ORDER_QUANTITY);
      const unitPrice = toNumber(detail.PRODUCT_SELL_PRICE);
      return {
        name: detail.BUSINESS_PRODUCT_ID
          ? productNames.get(detail.BUSINESS_PRODUCT_ID) || "Product"
          : "Custom item",
        quantity,
        unitPrice,
        subtotal: toNumber(detail.PRODUCT_PRICE) || unitPrice * quantity,
      };
    }),
  };
}

async function activePosWorkspaces(businessId: number) {
  const cards = (await listMenuCards(businessId)).filter(
    (card) =>
      card.status === "active" &&
      card.availability === "active" &&
      (card.salesChannel === "pos" || card.salesChannel === "both")
  );
  return Promise.all(cards.map((card) => getMenuCardWorkspace(businessId, card.id)));
}

export async function getPosCatalog(businessId: number): Promise<PosCatalog> {
  await requireOrdersBusinessAccess(businessId);
  const workspaces = await activePosWorkspaces(businessId);
  return {
    menus: workspaces.map((workspace) => ({
      id: workspace.card.id,
      title: workspace.card.title,
      categories: workspace.details
        .map((category) => ({
          ...category,
          products: category.products.filter((product) => product.status === "active"),
        }))
        .filter((category) => category.products.length > 0),
    })),
  };
}

async function findByRequestId(businessId: number, requestId: string) {
  const rows = await prisma.$queryRaw<PosOrderRecord[]>`
    SELECT BUSINESS_ORDER_ID, ORDER_NUMBER, CREATION_DATETIME,
           PAYMENT_MODE, ORDER_FINAL_AMOUNT, ORDER_GROSS_AMOUNT,
           ORDER_DISCOUNT_AMOUNT, DISCOUNT_NAME
    FROM business_order
    WHERE BUSINESS_ID = ${businessId}
      AND POS_REQUEST_ID = ${requestId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function receiptForOrder(businessId: number, order: PosOrderRecord) {
  const [business, details] = await Promise.all([
    prisma.business.findUnique({
      where: { BUSINESS_ID: businessId },
      select: {
        BUSINESS_NAME: true,
        ADDRESS_STREET: true,
        ADDRESS_ZIP: true,
        ADDRESS_TOWN: true,
      },
    }),
    prisma.business_order_detail.findMany({
      where: { BUSINESS_ORDER_ID: order.BUSINESS_ORDER_ID },
      orderBy: { BUSINESS_ORDER_DETAIL_ID: "asc" },
    }),
  ]);
  const productIds = details
    .map((detail) => detail.BUSINESS_PRODUCT_ID)
    .filter((id): id is number => id !== null);
  const products = productIds.length
    ? await prisma.business_product.findMany({
        where: { BUSINESS_PRODUCT_ID: { in: productIds } },
        select: { BUSINESS_PRODUCT_ID: true, TITLE: true },
      })
    : [];
  const names = new Map(products.map((product) => [product.BUSINESS_PRODUCT_ID, product.TITLE]));

  return buildPosReceipt(order, business, details, names);
}

async function preparePosItems(businessId: number, rawItems: PosCartItemInput[]) {
  const items = normalizePosItems(rawItems);
  const catalog = await getPosCatalog(businessId);
  const allowedProductIds = new Set(
    catalog.menus.flatMap((menu) =>
      menu.categories.flatMap((category) => category.products.map((product) => product.id))
    )
  );
  const requestedProductIds = Array.from(new Set(
    items.filter((item) => item.kind === "product").map((item) => item.productId)
  ));
  if (requestedProductIds.some((productId) => !allowedProductIds.has(productId))) {
    throw new Error("One or more products are not available in the POS.");
  }
  const products = requestedProductIds.length
    ? await prisma.business_product.findMany({
        where: {
          BUSINESS_ID: businessId,
          BUSINESS_PRODUCT_ID: { in: requestedProductIds },
          STATUS: 1,
        },
        select: { BUSINESS_PRODUCT_ID: true, PRODUCT_PRICE: true, TITLE: true, TRACK_INVENTORY: true },
      })
    : [];
  if (products.length !== requestedProductIds.length) {
    throw new Error("One or more products are unavailable.");
  }
  const priceByProductId = new Map(
    products.map((product) => [product.BUSINESS_PRODUCT_ID, toNumber(product.PRODUCT_PRICE)])
  );
  const productById = new Map(products.map((product) => [product.BUSINESS_PRODUCT_ID, product]));
  const pricedItems = items.map((item) => ({
    ...item,
    productId: item.kind === "product" ? item.productId : null,
    price: item.kind === "product" ? priceByProductId.get(item.productId) || 0 : item.price,
  }));
  const subtotalCents = pricedItems.reduce((sum, item) => sum + cents(item.price) * item.quantity, 0);
  return { pricedItems, productById, subtotalCents };
}

function discountIdFrom(value: unknown) {
  if (value == null) return null;
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid discount selection.");
  return id;
}

async function pricePosDiscount(
  client: Pick<typeof prisma, "business_discount">,
  businessId: number,
  discountId: number | null,
  subtotalCents: number
): Promise<AppliedDiscount | null> {
  if (!discountId) return null;
  const row = await client.business_discount.findFirst({ where: { DISCOUNT_ID: discountId, BUSINESS_ID: businessId } });
  if (!row) throw new Error("Discount is no longer available. Refresh the sale.");
  const discount = discountRow(row);
  const amountCents = calculateDiscount(discount, subtotalCents, "pos");
  if (!amountCents) throw new Error("Discount is no longer eligible for this sale.");
  return { id: discount.id, name: discount.name, type: discount.type, value: discount.value, amountCents, code: null };
}

export async function quotePosOrder(businessId: number, input: { items?: PosCartItemInput[]; discountId?: unknown }) {
  await requireOrdersBusinessAccess(businessId);
  const { subtotalCents } = await preparePosItems(businessId, input.items || []);
  const applied = await pricePosDiscount(prisma, businessId, discountIdFrom(input.discountId), subtotalCents);
  return { subtotalCents, discountCents: applied?.amountCents ?? 0, finalCents: subtotalCents - (applied?.amountCents ?? 0), discountName: applied?.name ?? null };
}

export async function createPosOrder(
  businessId: number,
  input: { requestId?: unknown; paymentMethod?: unknown; items?: PosCartItemInput[]; discountId?: unknown; expectedFinalCents?: unknown }
) {
  await requireOrdersBusinessAccess(businessId);
  const requestId = String(input.requestId || "");
  if (!/^[a-zA-Z0-9-]{16,64}$/.test(requestId)) throw new Error("Invalid POS request.");
  const paymentMethod = String(input.paymentMethod || "");
  if (paymentMethod !== "cash" && paymentMethod !== "card") throw new Error("Payment method must be Cash or Card.");
  const existing = await findByRequestId(businessId, requestId);
  if (existing) return receiptForOrder(businessId, existing);
  const expectedFinalCents = Number(input.expectedFinalCents);
  if (!Number.isSafeInteger(expectedFinalCents) || expectedFinalCents <= 0) throw new Error("Invalid sale total.");
  const { pricedItems, productById, subtotalCents } = await preparePosItems(businessId, input.items || []);
  const discountId = discountIdFrom(input.discountId);
  const session = await getServerSession(authOptions);

  let order;
  try {
    order = await prisma.$transaction(async (tx) => {
      const applied = await pricePosDiscount(tx, businessId, discountId, subtotalCents);
      const finalCents = subtotalCents - (applied?.amountCents ?? 0);
      if (finalCents !== expectedFinalCents) throw new Error("Sale total changed. Review the amount and try again.");
      await consumeImmediateSaleInventory(
        tx,
        businessId,
        pricedItems
          .filter((item): item is typeof item & { productId: number } => item.productId !== null)
          .map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            title: productById.get(item.productId)?.TITLE || `Product #${item.productId}`,
            trackInventory: productById.get(item.productId)?.TRACK_INVENTORY === 1,
          }))
      );
      const created = await tx.business_order.create({
        data: {
          CREATION_DATETIME: new Date(),
          BUSINESS_ID: businessId,
          VISITOR_ID: 0,
          PAYMENT_DONE: PAYMENT_DONE.PAID,
          PAYMENT_MODE: paymentMethod,
          ORDER_STATUS: ORDER_STATUS.PICKED_UP,
          ORDER_TYPE: "pickup",
          TERMINAL: "web-pos",
          STAFF_MEMBER: session?.user?.email || session?.user?.name || "Owner",
          FIRST_NAME: "Walk-in",
          LAST_NAME: "",
          SHIPPING_CHARGES: 0,
          ORDER_GROSS_AMOUNT: chf(subtotalCents),
          ORDER_NET_AMOUNT: chf(finalCents),
          ORDER_AMOUNT: chf(finalCents),
          ORDER_DISCOUNT_AMOUNT: chf(applied?.amountCents ?? 0),
          ORDER_FINAL_AMOUNT: chf(finalCents),
          DISCOUNT_ID: applied?.id ?? null,
          DISCOUNT_NAME: applied?.name ?? null,
          DISCOUNT_TYPE: applied?.type ?? null,
          DISCOUNT_VALUE: applied?.value ?? null,
          DELIVERY_DATETIME: new Date(),
          POS_REQUEST_ID: requestId,
        },
      });
      const orderWithNumber = await tx.business_order.update({
        where: { BUSINESS_ORDER_ID: created.BUSINESS_ORDER_ID },
        data: { ORDER_NUMBER: generateOrderNumberFromId(created.BUSINESS_ORDER_ID) },
      });
      await tx.business_order_detail.createMany({
        data: pricedItems.map((item) => ({
            CREATION_DATETIME: new Date(),
            BUSINESS_ORDER_ID: created.BUSINESS_ORDER_ID,
            BUSINESS_PRODUCT_ID: item.productId,
            ORDER_QUANTITY: item.quantity,
            PRODUCT_SELL_PRICE: item.price,
            PRODUCT_PRICE: item.price * item.quantity,
            QUANTITY_BALANCE: 0,
            QUANTITY_DELIVERED: item.quantity,
        })),
      });
      return orderWithNumber;
    }, { timeout: 15_000 });
  } catch (error) {
    const duplicate = await findByRequestId(businessId, requestId);
    if (duplicate) return receiptForOrder(businessId, duplicate);
    throw error;
  }
  return receiptForOrder(businessId, order);
}

export async function listPosOrders(
  businessId: number,
  dateFrom: string,
  dateTo: string
) {
  await requireOrdersBusinessAccess(businessId);
  const orders = await prisma.business_order.findMany({
    where: {
      BUSINESS_ID: businessId,
      TERMINAL: "web-pos",
      CREATION_DATETIME: {
        gte: parsePosDateBoundary(dateFrom),
        lte: parsePosDateBoundary(dateTo, true),
      },
    },
    orderBy: { CREATION_DATETIME: "desc" },
  });
  if (!orders.length) return [];

  const details = await prisma.business_order_detail.findMany({
    where: { BUSINESS_ORDER_ID: { in: orders.map((order) => order.BUSINESS_ORDER_ID) } },
    orderBy: { BUSINESS_ORDER_DETAIL_ID: "asc" },
  });
  const productIds = Array.from(new Set(
    details
      .map((detail) => detail.BUSINESS_PRODUCT_ID)
      .filter((id): id is number => id !== null)
  ));
  const [business, products] = await Promise.all([
    prisma.business.findUnique({
      where: { BUSINESS_ID: businessId },
      select: {
        BUSINESS_NAME: true,
        ADDRESS_STREET: true,
        ADDRESS_ZIP: true,
        ADDRESS_TOWN: true,
      },
    }),
    productIds.length
      ? prisma.business_product.findMany({
          where: { BUSINESS_PRODUCT_ID: { in: productIds } },
          select: { BUSINESS_PRODUCT_ID: true, TITLE: true },
        })
      : Promise.resolve([]),
  ]);
  const names = new Map(products.map((product) => [product.BUSINESS_PRODUCT_ID, product.TITLE]));
  const detailsByOrder = new Map<number, typeof details>();
  for (const detail of details) {
    if (detail.BUSINESS_ORDER_ID === null) continue;
    const orderDetails = detailsByOrder.get(detail.BUSINESS_ORDER_ID) || [];
    orderDetails.push(detail);
    detailsByOrder.set(detail.BUSINESS_ORDER_ID, orderDetails);
  }

  return orders.map((order) =>
    buildPosReceipt(order, business, detailsByOrder.get(order.BUSINESS_ORDER_ID) || [], names)
  );
}
