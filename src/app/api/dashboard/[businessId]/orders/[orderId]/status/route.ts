import { NextResponse } from "next/server";
import {
  OrderStatus,
  updateOrderStatus,
} from "@/services/orders-management";

type OrderStatusRouteContext = {
  params: Promise<{ businessId: string; orderId: string }>;
};

const allowedStatuses: OrderStatus[] = [
  "out_for_delivery",
  "delivered",
  "rejected",
  "ready_for_pickup",
  "picked_up",
];

function errorResponse(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (error.message === "Order not found") {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (error.message === "Invalid status transition") {
      return NextResponse.json(
        { error: "Invalid status transition" },
        { status: 400 }
      );
    }

    if (error.message === "Invalid route params") {
      return NextResponse.json({ error: "Invalid route params" }, { status: 400 });
    }

    if (error.message === "Rejection reason is required") {
      return NextResponse.json(
        { error: "Rejection reason is required" },
        { status: 400 }
      );
    }

    if (error.message.startsWith("Refund failed, so the order was not rejected.")) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      );
    }
  }

  console.error("Order status API error:", error);
  return NextResponse.json(
    { error: "Failed to update order status" },
    { status: 500 }
  );
}

export async function PATCH(
  req: Request,
  { params }: OrderStatusRouteContext
) {
  const { businessId: businessIdParam, orderId: orderIdParam } = await params;
  const businessId = parseInt(businessIdParam, 10);
  const orderId = parseInt(orderIdParam, 10);

  if (!Number.isInteger(businessId) || !Number.isInteger(orderId)) {
    return NextResponse.json({ error: "Invalid route params" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const status = body?.status as OrderStatus | undefined;

  if (!status || !allowedStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  try {
    const order = await updateOrderStatus(businessId, orderId, status, {
      rejectionReason: body?.rejectionReason,
      rejectionNote: body?.rejectionNote,
    });
    return NextResponse.json(order);
  } catch (error) {
    return errorResponse(error);
  }
}
