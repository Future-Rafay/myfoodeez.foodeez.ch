import { NextResponse } from "next/server";
import { refundOrder } from "@/services/orders-management";

type OrderRefundRouteContext = {
  params: Promise<{ businessId: string; orderId: string }>;
};

export async function POST(_req: Request, { params }: OrderRefundRouteContext) {
  const { businessId: businessIdParam, orderId: orderIdParam } = await params;

  try {
    const order = await refundOrder(
      Number(businessIdParam),
      Number(orderIdParam)
    );
    return NextResponse.json(order);
  } catch (error) {
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

      if (error.message === "Invalid route params") {
        return NextResponse.json(
          { error: "Invalid route params" },
          { status: 400 }
        );
      }

      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  return NextResponse.json({ error: "Refund failed" }, { status: 500 });
}
