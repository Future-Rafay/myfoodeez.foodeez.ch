import prisma from "@/lib/prisma";

export type DeliveryZone = {
  zoneName: string;
  postalCodes: string[];
  minimumOrderPrice: number;
  deliveryPrice: number;
  freeDeliveryAbove: number | null;
  deliveryInformation: string;
};

export type DeliveryQuote = {
  available: boolean;
  reason?: string;
  zoneName?: string;
  deliveryPrice: number;
  freeDeliveryApplied: boolean;
  minimumOrderPrice?: number;
  freeDeliveryAbove?: number | null;
  deliveryInformation?: string;
};

type DeliverySettings = {
  DELIVERY_ENABLED?: number | boolean | null;
  DELIVERY_ZONES_JSON?: string | null;
};

export function isDeliveryEnabled(settings?: DeliverySettings | null) {
  return settings?.DELIVERY_ENABLED === 1 || settings?.DELIVERY_ENABLED === true;
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cleanPostalCodes(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.map((code) => String(code ?? "").trim()).filter(Boolean))
  );
}

export function parseDeliveryZones(
  settings?: DeliverySettings | string | null
): DeliveryZone[] {
  const json =
    typeof settings === "string"
      ? settings
      : settings?.DELIVERY_ZONES_JSON ?? null;

  if (!json) return [];

  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];

    return parsed.map((zone) => ({
      zoneName: String(zone?.zoneName ?? "").trim(),
      postalCodes: cleanPostalCodes(zone?.postalCodes),
      minimumOrderPrice: toNumber(zone?.minimumOrderPrice),
      deliveryPrice: toNumber(zone?.deliveryPrice),
      freeDeliveryAbove:
        zone?.freeDeliveryAbove === null ||
        zone?.freeDeliveryAbove === undefined ||
        zone?.freeDeliveryAbove === ""
          ? null
          : toNumber(zone.freeDeliveryAbove),
      deliveryInformation: String(zone?.deliveryInformation ?? "").trim(),
    }));
  } catch {
    return [];
  }
}

export function postalCodeMatchesZone(postalCode: string, zone: DeliveryZone) {
  const normalized = postalCode.trim();
  if (!normalized) return false;

  return zone.postalCodes.some((code) => {
    const value = code.trim();
    if (!value) return false;
    if (value.endsWith("*")) return normalized.startsWith(value.slice(0, -1));
    return normalized === value;
  });
}

export async function calculateDeliveryQuote({
  businessId,
  postalCode,
  cartTotal,
}: {
  businessId: number;
  postalCode: string;
  cartTotal: number;
}): Promise<DeliveryQuote> {
  const settings = await prisma.business_settings.findUnique({
    where: { BUSINESS_ID: businessId },
    select: {
      DELIVERY_ENABLED: true,
      DELIVERY_ZONES_JSON: true,
    },
  });

  if (!isDeliveryEnabled(settings)) {
    return {
      available: false,
      reason: "Delivery is not available for this restaurant.",
      deliveryPrice: 0,
      freeDeliveryApplied: false,
    };
  }

  const zone = parseDeliveryZones(settings).find((item) =>
    postalCodeMatchesZone(postalCode, item)
  );

  if (!zone) {
    return {
      available: false,
      reason: "Delivery is not available for this postal code.",
      deliveryPrice: 0,
      freeDeliveryApplied: false,
    };
  }

  if (cartTotal < zone.minimumOrderPrice) {
    return {
      available: false,
      reason: `Minimum order for ${zone.zoneName} is CHF ${zone.minimumOrderPrice}.`,
      zoneName: zone.zoneName,
      deliveryPrice: 0,
      freeDeliveryApplied: false,
      minimumOrderPrice: zone.minimumOrderPrice,
      freeDeliveryAbove: zone.freeDeliveryAbove,
      deliveryInformation: zone.deliveryInformation,
    };
  }

  const freeDeliveryApplied =
    zone.freeDeliveryAbove !== null && cartTotal >= zone.freeDeliveryAbove;

  return {
    available: true,
    zoneName: zone.zoneName,
    deliveryPrice: freeDeliveryApplied ? 0 : zone.deliveryPrice,
    freeDeliveryApplied,
    minimumOrderPrice: zone.minimumOrderPrice,
    freeDeliveryAbove: zone.freeDeliveryAbove,
    deliveryInformation: zone.deliveryInformation,
  };
}
