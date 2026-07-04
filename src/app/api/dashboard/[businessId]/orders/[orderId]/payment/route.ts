import { NextResponse } from "next/server";
import { updateOrderPayment } from "@/services/orders-management";

type OrderPaymentRouteContext = {
  params: Promise<{ businessId: string; orderId: string }>;
};

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

    if (
      error.message === "Invalid route params" ||
      error.message === "Invalid payment status"
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  console.error("Order payment API error:", error);
  return NextResponse.json(
    { error: "Failed to update payment status" },
    { status: 500 }
  );
}

export async function PATCH(
  req: Request,
  { params }: OrderPaymentRouteContext
) {
  const { businessId: businessIdParam, orderId: orderIdParam } = await params;
  const body = await req.json().catch(() => null);

  try {
    const order = await updateOrderPayment(
      Number(businessIdParam),
      Number(orderIdParam),
      Number(body?.paymentDone)
    );
    return NextResponse.json(order);
  } catch (error) {
    return errorResponse(error);
  }
}
