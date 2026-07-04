import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  PAYMENT_DONE,
  STATUS_CODE_BY_NAME,
  canTransitionOrderStatus,
  countsAsRevenue,
  isStripePaidOrder,
  normalizeOrderStatus,
  normalizeOrderType,
  type OrderStatusName,
  type OrderType,
} from "@/lib/orderStatus";
import {
  finalizeOrderInventory,
  releaseOrderInventory,
} from "@/lib/inventory";
import prisma from "@/lib/prisma";

export type NormalizedOrderStatus = OrderStatusName;

export type OrderStatus = NormalizedOrderStatus;

export type OrderStatusValue = number | string | null;

export type OrderItemRow = {
  BUSINESS_ORDER_DETAIL_ID: number;
  BUSINESS_PRODUCT_ID: number | null;
  product_title: string;
  ORDER_QUANTITY: number;
  PRODUCT_SELL_PRICE: number;
  PRODUCT_DISCOUNT: number;
  subtotal: number;
};

export type AdminOrderRow = {
  BUSINESS_ORDER_ID: number;
  VISITOR_FIRST_NAME: string | null;
  VISITOR_LAST_NAME: string | null;
  VISITOR_PHONE: string | null;
  VISITOR_EMAIL: string | null;
  DELIVERY_ADDRESS: string | null;
  ADDRESS_STREET: string | null;
  ADDRESS_ZIP: string | null;
  ADDRESS_TOWN: string | null;
  ADDRESS_COUNTRY_CODE: string | null;
  ORDER_STATUS: OrderStatusValue;
  status: NormalizedOrderStatus;
  ORDER_TYPE: OrderType;
  PAYMENT_MODE: string | null;
  PAYMENT_DONE: number | null;
  STRIPE_PAYMENT_INTENT_ID: string | null;
  STRIPE_REFUND_ID: string | null;
  STRIPE_REFUND_STATUS: string | null;
  STRIPE_REFUNDED_DATETIME: string | null;
  GROSS_AMOUNT: number;
  TAX_AMOUNT: number;
  NET_AMOUNT: number;
  DISCOUNT_AMOUNT: number;
  SHIPPING_AMOUNT: number;
  REFUND_AMOUNT: number;
  FINAL_AMOUNT: number;
  CREATION_DATETIME: string | null;
  DELIVERY_ET: string | null;
  DELIVERY_DATETIME: string | null;
  ETA_ACKNOWLEDGED_DATETIME: string | null;
  ORDER_REJECTION_REASON: string | null;
  ORDER_REJECTION_NOTE: string | null;
  REJECTED_DATETIME: string | null;
  TERMINAL: string | null;
  STAFF_MEMBER: string | null;
  item_count: number;
  items: OrderItemRow[];
};

export type OrdersKpis = {
  new: number;
  preparing: number;
  out_for_delivery: number;
  ready_for_pickup: number;
  delivered: number;
  picked_up: number;
  rejected: number;
  revenue_today: number;
};

export type OrderPrepDefaults = {
  defaultPickupPrepMinutes: number;
  defaultDeliveryPrepMinutes: number;
};

export type ListOrdersParams = {
  businessId: number;
  status?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  search?: string | null;
  page?: number;
  limit?: number;
};

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function toNumber(value: unknown) {
  if (value && typeof value === "object" && "toNumber" in value) {
    return (value as { toNumber: () => number }).toNumber();
  }

  return Number(value ?? 0);
}

function decimalToCents(value: unknown) {
  const text = String(value ?? "0");
  if (!/^\d+(\.\d+)?$/.test(text)) throw new Error("Invalid refund amount");

  const [whole, fraction = ""] = text.split(".");
  const cents =
    BigInt(whole) * BigInt(100) +
    BigInt(fraction.padEnd(2, "0").slice(0, 2));
  if (cents <= BigInt(0)) {
    throw new Error("Order final amount must be greater than 0");
  }
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Refund amount is too large");
  }

  return Number(cents);
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function parseStatusFilter(status: string | null | undefined) {
  if (!status || status === "all") return null;

  const normalized = normalizeOrderStatus(status);
  return STATUS_CODE_BY_NAME[normalized];
}

function parseDate(value: string | null | undefined, boundary: "start" | "end") {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return boundary === "start" ? startOfDay(date) : endOfDay(date);
}

function buildAddress(order: {
  ADDRESS_STREET?: string | null;
  ADDRESS_ZIP?: string | null;
  ADDRESS_TOWN?: string | null;
  ADDRESS_COUNTRY_CODE?: string | null;
}) {
  const cityLine = [order.ADDRESS_ZIP, order.ADDRESS_TOWN]
    .filter(Boolean)
    .join(" ");
  const address = [
    order.ADDRESS_STREET,
    cityLine,
    order.ADDRESS_COUNTRY_CODE,
  ]
    .filter(Boolean)
    .join(", ");

  return address || null;
}

async function getVisitorAccountId() {
  const session = await getServerSession(authOptions);
  const id = Number(session?.user?.id);

  if (Number.isFinite(id)) return id;

  if (!session?.user?.email) return null;

  const user = await prisma.visitors_account.findUnique({
    where: { EMAIL_ADDRESS: session.user.email },
  });

  return user?.VISITORS_ACCOUNT_ID ? Number(user.VISITORS_ACCOUNT_ID) : null;
}

export async function requireOrdersBusinessAccess(businessId: number) {
  const visitorAccountId = await getVisitorAccountId();

  if (!visitorAccountId) {
    throw new Error("Unauthorized");
  }

  const owner = await prisma.business_owner.findFirst({
    where: { VISITORS_ACCOUNT_ID: visitorAccountId },
  });

  if (!owner) {
    throw new Error("Forbidden");
  }

  const access = await prisma.business_owner_2_business.findFirst({
    where: {
      BUSINESS_OWNER_ID: BigInt(owner.BUSINESS_OWNER_ID),
      BUSINESS_ID: BigInt(businessId),
    },
  });

  if (!access) {
    throw new Error("Forbidden");
  }
}

async function buildOrderRows(
  orders: Awaited<ReturnType<typeof prisma.business_order.findMany>>
) {
  const orderIds = orders.map((order) => order.BUSINESS_ORDER_ID);
  const details = orderIds.length
    ? await prisma.business_order_detail.findMany({
        where: { BUSINESS_ORDER_ID: { in: orderIds } },
        orderBy: { BUSINESS_ORDER_DETAIL_ID: "asc" },
      })
    : [];

  const productIds = unique(
    details
      .map((detail) => detail.BUSINESS_PRODUCT_ID)
      .filter((id): id is number => id !== null)
  );
  const products = productIds.length
    ? await prisma.business_product.findMany({
        where: { BUSINESS_PRODUCT_ID: { in: productIds } },
        select: { BUSINESS_PRODUCT_ID: true, TITLE: true },
      })
    : [];
  const productTitleById = new Map(
    products.map((product) => [product.BUSINESS_PRODUCT_ID, product.TITLE])
  );

  return orders.map<AdminOrderRow>((order) => {
    const orderItems = details.filter(
      (detail) => detail.BUSINESS_ORDER_ID === order.BUSINESS_ORDER_ID
    );
    const items = orderItems.map<OrderItemRow>((detail) => {
      const quantity = detail.ORDER_QUANTITY || 0;
      const sellPrice = toNumber(detail.PRODUCT_SELL_PRICE);

      return {
        BUSINESS_ORDER_DETAIL_ID: detail.BUSINESS_ORDER_DETAIL_ID,
        BUSINESS_PRODUCT_ID: detail.BUSINESS_PRODUCT_ID,
        product_title:
          (detail.BUSINESS_PRODUCT_ID
            ? productTitleById.get(detail.BUSINESS_PRODUCT_ID)
            : null) ||
          (detail.BUSINESS_PRODUCT_ID
            ? `Product #${detail.BUSINESS_PRODUCT_ID}`
            : "Unknown product"),
        ORDER_QUANTITY: quantity,
        PRODUCT_SELL_PRICE: sellPrice,
        PRODUCT_DISCOUNT: toNumber(detail.PRODUCT_DISCOUNT),
        subtotal: quantity * sellPrice,
      };
    });

    return {
      BUSINESS_ORDER_ID: order.BUSINESS_ORDER_ID,
      VISITOR_FIRST_NAME: order.FIRST_NAME,
      VISITOR_LAST_NAME: order.LAST_NAME,
      VISITOR_PHONE: order.PHONE_NUMBER,
      VISITOR_EMAIL: order.EMAIL_ADDRESS,
      DELIVERY_ADDRESS: buildAddress(order),
      ADDRESS_STREET: order.ADDRESS_STREET,
      ADDRESS_ZIP: order.ADDRESS_ZIP,
      ADDRESS_TOWN: order.ADDRESS_TOWN,
      ADDRESS_COUNTRY_CODE: order.ADDRESS_COUNTRY_CODE,
      ORDER_STATUS: order.ORDER_STATUS,
      status: normalizeOrderStatus(order.ORDER_STATUS),
      ORDER_TYPE: normalizeOrderType(order.ORDER_TYPE),
      PAYMENT_MODE: order.PAYMENT_MODE,
      PAYMENT_DONE: order.PAYMENT_DONE,
      STRIPE_PAYMENT_INTENT_ID: order.STRIPE_PAYMENT_INTENT_ID,
      STRIPE_REFUND_ID: order.STRIPE_REFUND_ID,
      STRIPE_REFUND_STATUS: order.STRIPE_REFUND_STATUS,
      STRIPE_REFUNDED_DATETIME:
        order.STRIPE_REFUNDED_DATETIME?.toISOString() || null,
      GROSS_AMOUNT: toNumber(order.ORDER_GROSS_AMOUNT),
      TAX_AMOUNT: toNumber(order.ORDER_TAX_AMOUNT),
      NET_AMOUNT: toNumber(order.ORDER_NET_AMOUNT),
      DISCOUNT_AMOUNT: toNumber(order.ORDER_DISCOUNT_AMOUNT),
      SHIPPING_AMOUNT: toNumber(order.SHIPPING_CHARGES),
      REFUND_AMOUNT: toNumber(order.ORDER_REFUND_AMOUNT),
      FINAL_AMOUNT: toNumber(order.ORDER_FINAL_AMOUNT),
      CREATION_DATETIME: order.CREATION_DATETIME?.toISOString() || null,
      DELIVERY_ET: order.DELIVERY_ET?.toISOString() || null,
      DELIVERY_DATETIME: order.DELIVERY_DATETIME?.toISOString() || null,
      ETA_ACKNOWLEDGED_DATETIME:
        order.ETA_ACKNOWLEDGED_DATETIME?.toISOString() || null,
      ORDER_REJECTION_REASON: order.ORDER_REJECTION_REASON,
      ORDER_REJECTION_NOTE: order.ORDER_REJECTION_NOTE,
      REJECTED_DATETIME: order.REJECTED_DATETIME?.toISOString() || null,
      TERMINAL: order.TERMINAL,
      STAFF_MEMBER: order.STAFF_MEMBER,
      item_count: items.length,
      items,
    };
  });
}

function buildOrderWhere(params: ListOrdersParams) {
  const where: Record<string, unknown> = {
    BUSINESS_ID: Number(params.businessId),
  };
  const status = parseStatusFilter(params.status);
  const dateFrom = parseDate(params.dateFrom, "start");
  const dateTo = parseDate(params.dateTo, "end");
  const search = params.search?.trim();

  if (status !== null) {
    where.ORDER_STATUS = status;
  }

  if (dateFrom || dateTo) {
    where.CREATION_DATETIME = {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateTo ? { lte: dateTo } : {}),
    };
  }

  if (search) {
    const orderId = Number(search);
    where.OR = [
      ...(Number.isInteger(orderId) ? [{ BUSINESS_ORDER_ID: orderId }] : []),
      { FIRST_NAME: { contains: search } },
      { LAST_NAME: { contains: search } },
      { EMAIL_ADDRESS: { contains: search } },
      { PHONE_NUMBER: { contains: search } },
    ];
  }

  return where;
}

async function getOrdersKpis(businessId: number): Promise<OrdersKpis> {
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  const orders = await prisma.business_order.findMany({
    where: { BUSINESS_ID: Number(businessId) },
    select: {
      ORDER_STATUS: true,
      ORDER_FINAL_AMOUNT: true,
      CREATION_DATETIME: true,
      PAYMENT_DONE: true,
      STRIPE_REFUND_STATUS: true,
    },
  });

  return orders.reduce<OrdersKpis>(
    (kpi, order) => {
      const status = normalizeOrderStatus(order.ORDER_STATUS);

      if (status === "preparing") kpi.preparing += 1;
      if (status === "out_for_delivery") kpi.out_for_delivery += 1;
      if (status === "ready_for_pickup") kpi.ready_for_pickup += 1;
      if (status === "delivered") kpi.delivered += 1;
      if (status === "picked_up") kpi.picked_up += 1;
      if (status === "rejected") kpi.rejected += 1;

      if (
        order.CREATION_DATETIME &&
        order.CREATION_DATETIME >= todayStart &&
        order.CREATION_DATETIME <= todayEnd &&
        countsAsRevenue(order)
      ) {
        kpi.revenue_today += toNumber(order.ORDER_FINAL_AMOUNT);
      }

      return kpi;
    },
    {
      new: 0,
      preparing: 0,
      out_for_delivery: 0,
      ready_for_pickup: 0,
      delivered: 0,
      picked_up: 0,
      rejected: 0,
      revenue_today: 0,
    }
  );
}

export async function listOrders(params: ListOrdersParams) {
  const businessId = Number(params.businessId);

  if (!Number.isInteger(businessId)) {
    throw new Error("Invalid businessId");
  }

  await requireOrdersBusinessAccess(businessId);

  const page = Math.max(1, Number(params.page || 1));
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(params.limit || DEFAULT_PAGE_SIZE))
  );
  const where = buildOrderWhere({ ...params, businessId });
  const orderQueryArgs = {
    where,
    orderBy: { CREATION_DATETIME: "desc" as const },
    skip: (page - 1) * limit,
    take: limit,
  };

  if (process.env.NODE_ENV === "development") {
    console.log("[orders:list] Prisma where", where);
  }

  const [totalCount, orders, kpi, rawStatuses] = await Promise.all([
    prisma.business_order.count({ where }),
    prisma.business_order.findMany(orderQueryArgs),
    getOrdersKpis(businessId),
    prisma.business_order.findMany({
      where: { BUSINESS_ID: businessId },
      distinct: ["ORDER_STATUS"],
      select: { ORDER_STATUS: true },
    }),
  ]);

  const settings = await prisma.business_settings.findUnique({
    where: { BUSINESS_ID: businessId },
    select: {
      DEFAULT_PICKUP_PREP_MINUTES: true,
      DEFAULT_DELIVERY_PREP_MINUTES: true,
    },
  });

  if (process.env.NODE_ENV === "development") {
    console.log(
      "[orders:list] Raw ORDER_STATUS values",
      rawStatuses.map((order) => order.ORDER_STATUS)
    );
  }

  return {
    orders: await buildOrderRows(orders),
    totalCount,
    page,
    totalPages: Math.max(1, Math.ceil(totalCount / limit)),
    kpi,
    prepDefaults: {
      defaultPickupPrepMinutes: settings?.DEFAULT_PICKUP_PREP_MINUTES ?? 20,
      defaultDeliveryPrepMinutes: settings?.DEFAULT_DELIVERY_PREP_MINUTES ?? 45,
    },
  };
}

export async function updateOrderStatus(
  businessId: number,
  orderId: number,
  nextStatus: NormalizedOrderStatus,
  options: { rejectionReason?: string; rejectionNote?: string } = {}
) {
  const parsedBusinessId = Number(businessId);
  const parsedOrderId = Number(orderId);

  if (!Number.isInteger(parsedBusinessId) || !Number.isInteger(parsedOrderId)) {
    throw new Error("Invalid route params");
  }

  await requireOrdersBusinessAccess(parsedBusinessId);

  const order = await prisma.business_order.findFirst({
    where: {
      BUSINESS_ORDER_ID: parsedOrderId,
      BUSINESS_ID: parsedBusinessId,
    },
  });

  if (!order) {
    throw new Error("Order not found");
  }

  if (nextStatus === "rejected" && normalizeOrderStatus(order.ORDER_STATUS) === "rejected") {
    return (await buildOrderRows([order]))[0];
  }

  if (
    !canTransitionOrderStatus(order.ORDER_STATUS, nextStatus, order.ORDER_TYPE)
  ) {
    throw new Error("Invalid status transition");
  }

  if (nextStatus === "rejected" && !options.rejectionReason?.trim()) {
    throw new Error("Rejection reason is required");
  }

  if (nextStatus === "rejected" && isStripePaidOrder(order)) {
    try {
      await refundOrderInternal(parsedBusinessId, order);
    } catch (error) {
      const detail = error instanceof Error ? ` ${error.message}` : "";
      throw new Error(`Refund failed, so the order was not rejected.${detail}`);
    }
  }

  const now = new Date();
  const data: Record<string, unknown> = {
    ORDER_STATUS: STATUS_CODE_BY_NAME[nextStatus],
  };

  if (nextStatus === "delivered") {
    data.DELIVERY_DATETIME = now;
  }

  if (nextStatus === "picked_up") {
    data.DELIVERY_DATETIME = now;
  }

  if (nextStatus === "rejected") {
    data.ORDER_REJECTION_REASON = options.rejectionReason?.trim();
    data.ORDER_REJECTION_NOTE = options.rejectionNote?.trim() || null;
    data.REJECTED_DATETIME = now;
  }

  const updatedOrder = await prisma.$transaction(async (tx) => {
    const nextOrder = await tx.business_order.update({
      where: { BUSINESS_ORDER_ID: parsedOrderId },
      data,
    });

    if (nextStatus === "delivered" || nextStatus === "picked_up") {
      await finalizeOrderInventory(tx, parsedOrderId);
    }

    if (nextStatus === "rejected") {
      await releaseOrderInventory(tx, parsedOrderId);
    }

    return nextOrder;
  });

  return (await buildOrderRows([updatedOrder]))[0];
}

export async function updateOrderPayment(
  businessId: number,
  orderId: number,
  paymentDone: number
) {
  const parsedBusinessId = Number(businessId);
  const parsedOrderId = Number(orderId);

  if (!Number.isInteger(parsedBusinessId) || !Number.isInteger(parsedOrderId)) {
    throw new Error("Invalid route params");
  }

  if (paymentDone !== PAYMENT_DONE.PAID) {
    throw new Error("Invalid payment status");
  }

  await requireOrdersBusinessAccess(parsedBusinessId);

  const order = await prisma.business_order.findFirst({
    where: {
      BUSINESS_ORDER_ID: parsedOrderId,
      BUSINESS_ID: parsedBusinessId,
    },
  });

  if (!order) throw new Error("Order not found");

  const updatedOrder = await prisma.business_order.update({
    where: { BUSINESS_ORDER_ID: parsedOrderId },
    data: { PAYMENT_DONE: PAYMENT_DONE.PAID },
  });

  return (await buildOrderRows([updatedOrder]))[0];
}

export async function updateOrderEta(
  businessId: number,
  orderId: number,
  eta: string
) {
  const parsedBusinessId = Number(businessId);
  const parsedOrderId = Number(orderId);
  const etaDate = new Date(eta);

  if (!Number.isInteger(parsedBusinessId) || !Number.isInteger(parsedOrderId)) {
    throw new Error("Invalid route params");
  }

  if (!eta || Number.isNaN(etaDate.getTime())) {
    throw new Error("ETA is required");
  }

  await requireOrdersBusinessAccess(parsedBusinessId);

  const order = await prisma.business_order.findFirst({
    where: {
      BUSINESS_ORDER_ID: parsedOrderId,
      BUSINESS_ID: parsedBusinessId,
    },
  });

  if (!order) throw new Error("Order not found");

  if (
    order.PAYMENT_DONE === PAYMENT_DONE.REFUNDED ||
    order.STRIPE_REFUND_STATUS ||
    ["rejected", "delivered", "picked_up"].includes(
      normalizeOrderStatus(order.ORDER_STATUS)
    )
  ) {
    throw new Error("ETA cannot be changed after refund or order closure");
  }

  const updatedOrder = await prisma.business_order.update({
    where: { BUSINESS_ORDER_ID: parsedOrderId },
    data: {
      DELIVERY_ET: etaDate,
      ETA_ACKNOWLEDGED_DATETIME: new Date(),
    },
  });

  return (await buildOrderRows([updatedOrder]))[0];
}

export async function refundOrder(businessId: number, orderId: number) {
  const parsedBusinessId = Number(businessId);
  const parsedOrderId = Number(orderId);

  if (!Number.isInteger(parsedBusinessId) || !Number.isInteger(parsedOrderId)) {
    throw new Error("Invalid route params");
  }

  await requireOrdersBusinessAccess(parsedBusinessId);

  const order = await prisma.business_order.findFirst({
    where: {
      BUSINESS_ORDER_ID: parsedOrderId,
      BUSINESS_ID: parsedBusinessId,
    },
  });

  if (!order) throw new Error("Order not found");

  const updatedOrder = await refundOrderInternal(parsedBusinessId, order);
  return (await buildOrderRows([updatedOrder]))[0];
}

async function createStripeRefund(paymentIntentId: string, amount: number) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("Stripe secret key is not configured.");

  const response = await fetch("https://api.stripe.com/v1/refunds", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      payment_intent: paymentIntentId,
      amount: String(amount),
    }),
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error?.message || "Stripe refund failed.");
  }

  return {
    id: String(data?.id || ""),
    status: String(data?.status || "pending"),
  };
}

async function refundOrderInternal(
  businessId: number,
  order: Awaited<ReturnType<typeof prisma.business_order.findFirst>>
) {
  if (!order) throw new Error("Order not found");

  if (order.STRIPE_REFUND_ID || order.PAYMENT_DONE === PAYMENT_DONE.REFUNDED) {
    return order;
  }

  if (!isStripePaidOrder(order)) {
    throw new Error("Only paid Stripe/card orders can be refunded.");
  }

  if (!order.STRIPE_PAYMENT_INTENT_ID) {
    throw new Error(
      "Cannot refund this order because Stripe payment reference is missing."
    );
  }

  const amount = decimalToCents(order.ORDER_FINAL_AMOUNT);
  const refund = await createStripeRefund(order.STRIPE_PAYMENT_INTENT_ID, amount);
  if (!refund.id) throw new Error("Stripe refund response was missing an id.");

  const updatedOrder = await prisma.business_order.update({
    where: { BUSINESS_ORDER_ID: order.BUSINESS_ORDER_ID },
    data: {
      STRIPE_REFUND_ID: refund.id,
      STRIPE_REFUND_STATUS: refund.status,
      STRIPE_REFUNDED_DATETIME: new Date(),
      ORDER_REFUND_AMOUNT: order.ORDER_FINAL_AMOUNT,
      PAYMENT_DONE:
        refund.status === "succeeded" ? PAYMENT_DONE.REFUNDED : PAYMENT_DONE.PAID,
    },
  });

  return updatedOrder;
}
