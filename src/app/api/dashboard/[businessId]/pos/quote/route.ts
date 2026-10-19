import { NextResponse } from "next/server";
import { quotePosOrder } from "@/services/pos-management";

export async function POST(request: Request, { params }: { params: Promise<{ businessId: string }> }) {
  const businessId = Number((await params).businessId);
  if (!Number.isInteger(businessId) || businessId <= 0) return NextResponse.json({ error: "Invalid business ID." }, { status: 400 });
  try {
    return NextResponse.json(await quotePosOrder(businessId, await request.json()));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not price sale.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 409 });
  }
}
