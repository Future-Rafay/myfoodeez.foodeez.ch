import { NextResponse } from "next/server";
import { InventoryUnavailableError } from "@/lib/inventory";
import { createPosOrder, listPosOrders } from "@/services/pos-management";

type Context = { params: Promise<{ businessId: string }> };

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Could not process POS order.";
  if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
  if (message === "Forbidden") return NextResponse.json({ error: message }, { status: 403 });
  if (error instanceof InventoryUnavailableError) {
    return NextResponse.json({ error: message }, { status: 409 });
  }
  if (/^(Invalid POS request\.|Payment method must be|Add at least one item\.|Item quantities must be|Custom item price must be|Invalid product\.|One or more products)/.test(message)) {
    return NextResponse.json({ error: message }, { status: 400 });
  }
  console.error("POS order request failed", error);
  return NextResponse.json({ error: "Could not confirm the sale. Check POS Orders, then retry the same sale if needed." }, { status: 503 });
}

export async function GET(request: Request, { params }: Context) {
  const businessId = Number((await params).businessId);
  if (!Number.isInteger(businessId) || businessId <= 0) {
    return NextResponse.json({ error: "Invalid business ID." }, { status: 400 });
  }
  const search = new URL(request.url).searchParams;
  const today = new Date().toISOString().slice(0, 10);
  try {
    return NextResponse.json(
      await listPosOrders(
        businessId,
        search.get("dateFrom") || today,
        search.get("dateTo") || search.get("dateFrom") || today
      )
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, { params }: Context) {
  const businessId = Number((await params).businessId);
  if (!Number.isInteger(businessId) || businessId <= 0) {
    return NextResponse.json({ error: "Invalid business ID." }, { status: 400 });
  }
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Request body is required." }, { status: 400 });
  }
  try {
    return NextResponse.json(await createPosOrder(businessId, body));
  } catch (error) {
    return errorResponse(error);
  }
}
