import { NextResponse } from "next/server";
import { getPosCatalog } from "@/services/pos-management";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const businessId = Number((await params).businessId);
  if (!Number.isInteger(businessId) || businessId <= 0) {
    return NextResponse.json({ error: "Invalid business ID." }, { status: 400 });
  }
  try {
    return NextResponse.json(await getPosCatalog(businessId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load POS catalog.";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
