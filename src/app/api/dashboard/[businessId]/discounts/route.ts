import { NextResponse } from "next/server";
import { listCodes, listDiscounts, saveDiscount } from "@/services/discount-management";
import { apiError, parseId } from "../menu-cards/route-utils";

type Context = { params: Promise<{ businessId: string }> };

export async function GET(_request: Request, { params }: Context) {
  const businessId = parseId((await params).businessId);
  if (!businessId) return NextResponse.json({ error: "Invalid business ID." }, { status: 400 });
  try {
    const [discounts, codes] = await Promise.all([listDiscounts(businessId), listCodes(businessId)]);
    return NextResponse.json({ discounts, codes });
  } catch (error) {
    return apiError(error, "Could not load discounts.");
  }
}

export async function POST(request: Request, { params }: Context) {
  const businessId = parseId((await params).businessId);
  if (!businessId) return NextResponse.json({ error: "Invalid business ID." }, { status: 400 });
  try {
    return NextResponse.json({ discount: await saveDiscount(businessId, await request.json()) }, { status: 201 });
  } catch (error) {
    return apiError(error, "Could not create discount.");
  }
}
