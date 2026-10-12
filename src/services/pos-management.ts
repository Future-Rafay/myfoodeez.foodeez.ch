import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { consumeImmediateSaleInventory } from "@/lib/inventory";
import { generateOrderNumberFromId } from "@/lib/orderNumber";
import { ORDER_STATUS, PAYMENT_DONE } from "@/lib/orderStatus";
import { parsePosDateBoundary } from "@/lib/pos-date-range";
import prisma from "@/lib/prisma";
import { normalizePosItems, type RawPosItem } from "@/lib/pos-rules";
import { getMenuCardWorkspace, listMenuCards, type MenuCardDetailRow } from "@/services/menu-management";
import { requireOrdersBusinessAccess } from "@/services/orders-management";

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
  items: Array<{ name: string; quantity: number; unitPrice: number; subtotal: number }>;
};

type PosOrderRecord = {
  BUSINESS_ORDER_ID: number;
  ORDER_NUMBER: string | null;
  CREATION_DATETIME: Date | null;
  PAYMENT_MODE: string | null;
  ORDER_FINAL_AMOUNT: unknown;
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
           PAYMENT_MODE, ORDER_FINAL_AMOUNT
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

export async function createPosOrder(
  businessId: number,
  input: { requestId?: unknown; paymentMethod?: unknown; items?: PosCartItemInput[] }
) {
  await requireOrdersBusinessAccess(businessId);
  const requestId = String(input.requestId || "");
  if (!/^[a-zA-Z0-9-]{16,64}$/.test(requestId)) throw new Error("Invalid POS request.");
  const paymentMethod = String(input.paymentMethod || "");
  if (paymentMethod !== "cash" && paymentMethod !== "card") {
    throw new Error("Payment method must be Cash or Card.");
  }
  const existing = await findByRequestId(businessId, requestId);
  if (existing) return receiptForOrder(businessId, existing);

  const items = normalizePosItems(input.items || []);
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
  const total = pricedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const session = await getServerSession(authOptions);

  let order;
  try {
    order = await prisma.$transaction(async (tx) => {
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
          ORDER_GROSS_AMOUNT: total,
          ORDER_NET_AMOUNT: total,
          ORDER_AMOUNT: total,
          ORDER_FINAL_AMOUNT: total,
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
