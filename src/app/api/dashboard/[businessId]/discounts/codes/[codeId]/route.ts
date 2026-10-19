import { NextResponse } from "next/server";
import { setCodeActive } from "@/services/discount-management";
import { apiError, parseId } from "../../../menu-cards/route-utils";

export async function PATCH(request: Request, { params }: { params: Promise<{ businessId: string; codeId: string }> }) {
  const { businessId: rawBusiness, codeId: rawCode } = await params;
  const businessId = parseId(rawBusiness);
  const codeId = parseId(rawCode);
  if (!businessId || !codeId) return NextResponse.json({ error: "Invalid code ID." }, { status: 400 });
  try {
    const body = await request.json();
    if (typeof body.active !== "boolean") return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    await setCodeActive(businessId, codeId, body.active);
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, "Could not deactivate code.");
  }
}
