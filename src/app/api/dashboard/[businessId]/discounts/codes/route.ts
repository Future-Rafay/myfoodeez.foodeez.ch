import { NextResponse } from "next/server";
import { createCode } from "@/services/discount-management";
import { apiError, parseId } from "../../menu-cards/route-utils";

export async function POST(request: Request, { params }: { params: Promise<{ businessId: string }> }) {
  const businessId = parseId((await params).businessId);
  if (!businessId) return NextResponse.json({ error: "Invalid business ID." }, { status: 400 });
  try {
    const body = await request.json();
    const discountId = parseId(String(body.discountId));
    if (!discountId) return NextResponse.json({ error: "Invalid discount ID." }, { status: 400 });
    return NextResponse.json({ code: await createCode(businessId, discountId, body.code) }, { status: 201 });
  } catch (error) {
    return apiError(error, "Could not create code.");
  }
}
