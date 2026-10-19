import { NextResponse } from "next/server";
import { saveDiscount } from "@/services/discount-management";
import { apiError, parseId } from "../../menu-cards/route-utils";

export async function PATCH(request: Request, { params }: { params: Promise<{ businessId: string; discountId: string }> }) {
  const { businessId: rawBusiness, discountId: rawDiscount } = await params;
  const businessId = parseId(rawBusiness);
  const discountId = parseId(rawDiscount);
  if (!businessId || !discountId) return NextResponse.json({ error: "Invalid discount ID." }, { status: 400 });
  try {
    return NextResponse.json({ discount: await saveDiscount(businessId, await request.json(), discountId) });
  } catch (error) {
    return apiError(error, "Could not update discount.");
  }
}
