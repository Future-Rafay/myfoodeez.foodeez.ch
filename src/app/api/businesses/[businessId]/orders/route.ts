import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createBusinessNotification } from "@/lib/businessNotifications";
import { calculateDeliveryQuote } from "@/lib/fulfillment";
import { reserveOrderInventory } from "@/lib/inventory";

type RouteContext = {
  params: Promise<{ businessId: string }>;
};

type OrderItemInput = {
  businessProductId?: unknown;
  productId?: unknown;
  quantity?: unknown;
};

function parseBusinessId(value: string) {
  const businessId = Number(value);
  return Number.isInteger(businessId) && businessId > 0 ? businessId : null;
}

function readText(body: Record<string, unknown>, key: string) {
  return String(body[key] ?? "").trim();
}

function readCustomerText(
  body: Record<string, unknown>,
  customer: Record<string, unknown>,
  key: string
) {
  return String(customer[key] ?? body[key] ?? "").trim();
}

function paymentDoneFor(paymentMode: string) {
  return /stripe|card/.test(paymentMode.toLowerCase()) ? 1 : 0;
}

async function nextIds() {
  const [order, detail] = await Promise.all([
    prisma.business_order.findFirst({
      orderBy: { BUSINESS_ORDER_ID: "desc" },
      select: { BUSINESS_ORDER_ID: true },
    }),
    prisma.business_order_detail.findFirst({
      orderBy: { BUSINESS_ORDER_DETAIL_ID: "desc" },
      select: { BUSINESS_ORDER_DETAIL_ID: true },
    }),
  ]);

  return {
    orderId: (order?.BUSINESS_ORDER_ID || 0) + 1,
    detailId: (detail?.BUSINESS_ORDER_DETAIL_ID || 0) + 1,
  };
}

export async function POST(req: Request, { params }: RouteContext) {
  const { businessId: businessIdParam } = await params;
  const businessId = parseBusinessId(businessIdParam);

  if (!businessId) {
    return NextResponse.json({ error: "Invalid businessId" }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;

  if (!body) {
    return NextResponse.json({ error: "Request body is required" }, { status: 400 });
  }

  const orderType = readText(body, "orderType") || "delivery";
  if (orderType !== "delivery" && orderType !== "pickup") {
    return NextResponse.json(
      { error: "orderType must be delivery or pickup" },
      { status: 400 }
    );
  }

  const items = Array.isArray(body.items) ? (body.items as OrderItemInput[]) : [];
  if (!items.length) {
    return NextResponse.json({ error: "items are required" }, { status: 400 });
  }

  const customer =
    body.customer && typeof body.customer === "object"
      ? (body.customer as Record<string, unknown>)
      : {};
  const addressZip = readCustomerText(body, customer, "addressZip");

  if (orderType === "delivery" && !addressZip) {
    return NextResponse.json(
      { error: "ADDRESS_ZIP is required for delivery orders" },
      { status: 400 }
    );
  }

  const normalizedItems = items.map((item) => ({
    productId: Number(item.businessProductId ?? item.productId),
    quantity: Math.max(0, Math.trunc(Number(item.quantity ?? 1))),
  }));

  if (
    normalizedItems.some(
      (item) => !Number.isInteger(item.productId) || item.productId <= 0 || item.quantity <= 0
    )
  ) {
    return NextResponse.json(
      { error: "Each item needs a valid product id and quantity" },
      { status: 400 }
    );
  }

  const products = await prisma.business_product.findMany({
    where: {
      BUSINESS_ID: businessId,
      BUSINESS_PRODUCT_ID: {
        in: normalizedItems.map((item) => item.productId),
      },
      STATUS: 1,
    },
    select: {
      BUSINESS_PRODUCT_ID: true,
      PRODUCT_PRICE: true,
    },
  });

  if (products.length !== new Set(normalizedItems.map((item) => item.productId)).size) {
    return NextResponse.json(
      { error: "One or more products are unavailable" },
      { status: 400 }
    );
  }

  const subtotal = normalizedItems.reduce((total, item) => {
    const product = products.find(
      (row) => row.BUSINESS_PRODUCT_ID === item.productId
    );
    return total + Number(product?.PRODUCT_PRICE || 0) * item.quantity;
  }, 0);

  const quote =
    orderType === "delivery"
      ? await calculateDeliveryQuote({
          businessId,
          postalCode: addressZip,
          cartTotal: subtotal,
        })
      : null;

  if (quote && !quote.available) {
    return NextResponse.json(
      { error: quote.reason || "Delivery is unavailable", quote },
      { status: 400 }
    );
  }

  const shippingCharges = orderType === "delivery" ? quote?.deliveryPrice || 0 : 0;
  const finalAmount = subtotal + shippingCharges;
  const paymentMode = readText(body, "paymentMode") || "cash";
  const visitorId = Number(body.visitorId || 0);
  const now = new Date();
  const ids = await nextIds();

  let created;
  try {
    created = await prisma.$transaction(async (tx) => {
      await reserveOrderInventory(tx, businessId, normalizedItems);

      const order = await tx.business_order.create({
        data: {
          BUSINESS_ORDER_ID: ids.orderId,
          CREATION_DATETIME: now,
          BUSINESS_ID: businessId,
          VISITOR_ID: Number.isFinite(visitorId) ? visitorId : 0,
          PAYMENT_DONE: paymentDoneFor(paymentMode),
          PAYMENT_MODE: paymentMode,
          DELIVERY_ET: null,
          ORDER_STATUS: 1,
          DELIVERY_DATETIME: null,
          TERMINAL: readText(body, "terminal") || null,
          STAFF_MEMBER: readText(body, "staffMember") || null,
          FIRST_NAME: readCustomerText(body, customer, "firstName") || null,
          LAST_NAME: readCustomerText(body, customer, "lastName") || null,
          ADDRESS_STREET:
            readCustomerText(body, customer, "addressStreet") || null,
          ADDRESS_ZIP: addressZip || null,
          ADDRESS_TOWN: readCustomerText(body, customer, "addressTown") || null,
          ADDRESS_COUNTRY_CODE:
            readCustomerText(body, customer, "addressCountryCode") || "CH",
          PHONE_NUMBER: readCustomerText(body, customer, "phoneNumber") || null,
          EMAIL_ADDRESS: readCustomerText(body, customer, "emailAddress") || null,
          ORDER_GROSS_AMOUNT: subtotal,
          ORDER_TAX_AMOUNT: 0,
          ORDER_NET_AMOUNT: subtotal,
          ORDER_DISCOUNT_AMOUNT: 0,
          ORDER_AMOUNT: subtotal,
          SHIPPING_CHARGES: shippingCharges,
          ORDER_REFUND_AMOUNT: 0,
          ORDER_FINAL_AMOUNT: finalAmount,
          ORDER_TYPE: orderType,
          ETA_ACKNOWLEDGED_DATETIME: null,
        },
      });

      await tx.business_order_detail.createMany({
        data: normalizedItems.map((item, index) => {
          const product = products.find(
            (row) => row.BUSINESS_PRODUCT_ID === item.productId
          );
          const price = Number(product?.PRODUCT_PRICE || 0);

          return {
            BUSINESS_ORDER_DETAIL_ID: ids.detailId + index,
            CREATION_DATETIME: now,
            BUSINESS_ORDER_ID: order.BUSINESS_ORDER_ID,
            BUSINESS_PRODUCT_ID: item.productId,
            ORDER_QUANTITY: item.quantity,
            QUANTITY_DELIVERED: 0,
            PRODUCT_SELL_PRICE: price,
            PRODUCT_DISCOUNT: 0,
            PRODUCT_PRICE: price,
            QUANTITY_BALANCE: item.quantity,
            QUANTITY__REFUND: 0,
          };
        }),
      });

      return order;
    });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    throw error;
  }

  await createBusinessNotification({
    businessId,
    type: "order",
    title: "New order received",
    message: `Order #${created.BUSINESS_ORDER_ID} is now preparing`,
    linkUrl: `/dashboard/${businessId}/orders?orderId=${created.BUSINESS_ORDER_ID}`,
    metadata: {
      orderId: created.BUSINESS_ORDER_ID,
      orderType: created.ORDER_TYPE,
    },
  }).catch((error) => {
    console.error("Failed to create order notification:", error);
  });

  return NextResponse.json(
    {
      orderId: created.BUSINESS_ORDER_ID,
      orderType: created.ORDER_TYPE,
      orderStatus: created.ORDER_STATUS,
      paymentDone: created.PAYMENT_DONE,
      shippingCharges,
      finalAmount,
    },
    { status: 201 }
  );
}
