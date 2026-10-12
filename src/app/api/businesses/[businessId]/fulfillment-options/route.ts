import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isDeliveryEnabled } from "@/lib/fulfillment";

type RouteContext = {
  params: Promise<{ businessId: string }>;
};

function parseBusinessId(value: string) {
  const businessId = Number(value);
  return Number.isInteger(businessId) && businessId > 0 ? businessId : null;
}

export async function GET(_req: Request, { params }: RouteContext) {
  const { businessId: businessIdParam } = await params;
  const businessId = parseBusinessId(businessIdParam);

  if (!businessId) {
    return NextResponse.json({ error: "Invalid businessId" }, { status: 400 });
  }

  const settings = await prisma.business_settings.findUnique({
    where: { BUSINESS_ID: businessId },
    select: {
      DELIVERY_ENABLED: true,
      PICKUP_ENABLED: true,
      PICKUP_INSTRUCTIONS: true,
      DEFAULT_PICKUP_PREP_MINUTES: true,
      DEFAULT_DELIVERY_PREP_MINUTES: true,
    },
  });

  return NextResponse.json({
    deliveryEnabled: isDeliveryEnabled(settings),
    pickupEnabled: settings?.PICKUP_ENABLED === 1,
    pickupInstructions: settings?.PICKUP_INSTRUCTIONS || "",
    defaultPickupPrepMinutes: settings?.DEFAULT_PICKUP_PREP_MINUTES ?? 20,
    defaultDeliveryPrepMinutes: settings?.DEFAULT_DELIVERY_PREP_MINUTES ?? 45,
  });
}
