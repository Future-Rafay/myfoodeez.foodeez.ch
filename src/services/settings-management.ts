import prisma from "@/lib/prisma";
import { isDeliveryEnabled, parseDeliveryZones, type DeliveryZone } from "@/lib/fulfillment";
import { requireBusinessAccess } from "@/services/admin-data";

export type BusinessSettingsRow = {
  id: number;
  businessId: number;
  deliveryAreas: string;
};

export type FulfillmentSettingsPayload = {
  deliveryEnabled: boolean;
  deliveryZones: DeliveryZone[];
  pickupEnabled: boolean;
  cashOnDeliveryEnabled: boolean;
  cashOnPickupEnabled: boolean;
  pickupInstructions: string;
  defaultPickupPrepMinutes: number;
  defaultDeliveryPrepMinutes: number;
};

export type FulfillmentSettingsRow = FulfillmentSettingsPayload & {
  id: number | null;
  businessId: number;
  legacyDeliveryAreas: string;
};

export type BusinessInfo = {
  name: string;
  email: string;
};

export function normalizeDeliveryAreas(value: string) {
  return value
    .split(",")
    .map((area) => area.trim())
    .filter(Boolean)
    .join(", ");
}

function toBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  return fallback;
}

function toFiniteNumber(value: unknown, field: string) {
  const numberValue =
    typeof value === "string" && value.trim() !== ""
      ? Number(value)
      : Number(value);

  if (!Number.isFinite(numberValue)) {
    throw new Error(`${field} must be a valid number.`);
  }

  return numberValue;
}

function toPrepMinutes(value: unknown, field: string) {
  const minutes = toFiniteNumber(value, field);

  if (minutes < 0) {
    throw new Error(`${field} must be greater than or equal to 0.`);
  }

  return Math.round(minutes);
}

function normalizePostalCodes(value: unknown) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((code) => String(code ?? "").trim())
        .filter(Boolean)
    )
  );
}

export function normalizeDeliveryZones(value: unknown): DeliveryZone[] {
  if (!Array.isArray(value)) {
    throw new Error("deliveryZones must be an array.");
  }

  return value.map((zone, index) => {
    const zoneName = String(zone?.zoneName ?? "").trim();
    const postalCodes = normalizePostalCodes(zone?.postalCodes);
    const minimumOrderPrice = toFiniteNumber(
      zone?.minimumOrderPrice ?? 0,
      `deliveryZones[${index}].minimumOrderPrice`
    );
    const deliveryPrice = toFiniteNumber(
      zone?.deliveryPrice ?? 0,
      `deliveryZones[${index}].deliveryPrice`
    );
    const freeDeliveryAbove =
      zone?.freeDeliveryAbove === null ||
      zone?.freeDeliveryAbove === undefined ||
      zone?.freeDeliveryAbove === ""
        ? null
        : toFiniteNumber(
            zone.freeDeliveryAbove,
            `deliveryZones[${index}].freeDeliveryAbove`
          );

    if (!zoneName) {
      throw new Error("Each delivery zone needs a name.");
    }

    if (!postalCodes.length) {
      throw new Error(`${zoneName} needs at least one postal code.`);
    }

    if (minimumOrderPrice < 0 || deliveryPrice < 0) {
      throw new Error("Delivery zone prices must be greater than or equal to 0.");
    }

    if (freeDeliveryAbove !== null && freeDeliveryAbove < 0) {
      throw new Error("Free delivery above must be greater than or equal to 0.");
    }

    if (
      freeDeliveryAbove !== null &&
      freeDeliveryAbove < minimumOrderPrice
    ) {
      throw new Error(
        "Free delivery above must be greater than or equal to the minimum order price."
      );
    }

    return {
      zoneName,
      postalCodes,
      minimumOrderPrice,
      deliveryPrice,
      freeDeliveryAbove,
      deliveryInformation: String(zone?.deliveryInformation ?? "").trim(),
    };
  });
}

function normalizeFulfillmentPayload(
  payload: Partial<FulfillmentSettingsPayload>
): FulfillmentSettingsPayload {
  if (typeof payload.deliveryEnabled !== "boolean") {
    throw new Error("deliveryEnabled must be a boolean.");
  }

  if (typeof payload.pickupEnabled !== "boolean") {
    throw new Error("pickupEnabled must be a boolean.");
  }

  if (typeof payload.cashOnDeliveryEnabled !== "boolean") {
    throw new Error("cashOnDeliveryEnabled must be a boolean.");
  }

  if (typeof payload.cashOnPickupEnabled !== "boolean") {
    throw new Error("cashOnPickupEnabled must be a boolean.");
  }

  if (typeof payload.pickupInstructions !== "string") {
    throw new Error("pickupInstructions must be a string.");
  }

  return {
    deliveryEnabled: payload.deliveryEnabled,
    deliveryZones: normalizeDeliveryZones(payload.deliveryZones),
    pickupEnabled: payload.pickupEnabled,
    cashOnDeliveryEnabled: payload.cashOnDeliveryEnabled,
    cashOnPickupEnabled: payload.cashOnPickupEnabled,
    pickupInstructions: payload.pickupInstructions.trim(),
    defaultPickupPrepMinutes: toPrepMinutes(
      payload.defaultPickupPrepMinutes,
      "defaultPickupPrepMinutes"
    ),
    defaultDeliveryPrepMinutes: toPrepMinutes(
      payload.defaultDeliveryPrepMinutes,
      "defaultDeliveryPrepMinutes"
    ),
  };
}

function mapFulfillmentSettings(
  businessId: number,
  settings: {
    BUSINESS_SETTINGS_ID: number;
    BUSINESS_ID: number;
    DELIVERY_RANGE_ZIP_CODES: string | null;
    DELIVERY_ENABLED: number | null;
    DELIVERY_ZONES_JSON: string | null;
    PICKUP_ENABLED: number | null;
    PICKUP_INSTRUCTIONS: string | null;
    DEFAULT_PICKUP_PREP_MINUTES: number | null;
    DEFAULT_DELIVERY_PREP_MINUTES: number | null;
  } | null,
  cashSettings?: {
    CASH_ON_DELIVERY_ENABLED: number | null;
    CASH_ON_PICKUP_ENABLED: number | null;
  } | null
): FulfillmentSettingsRow {
  return {
    id: settings?.BUSINESS_SETTINGS_ID ?? null,
    businessId,
    legacyDeliveryAreas: settings?.DELIVERY_RANGE_ZIP_CODES || "",
    deliveryEnabled: isDeliveryEnabled(settings),
    deliveryZones: parseDeliveryZones(settings),
    pickupEnabled: toBoolean(settings?.PICKUP_ENABLED, false),
    cashOnDeliveryEnabled: toBoolean(
      cashSettings?.CASH_ON_DELIVERY_ENABLED,
      false
    ),
    cashOnPickupEnabled: toBoolean(
      cashSettings?.CASH_ON_PICKUP_ENABLED,
      false
    ),
    pickupInstructions: settings?.PICKUP_INSTRUCTIONS || "",
    defaultPickupPrepMinutes: settings?.DEFAULT_PICKUP_PREP_MINUTES ?? 20,
    defaultDeliveryPrepMinutes: settings?.DEFAULT_DELIVERY_PREP_MINUTES ?? 45,
  };
}

export async function getBusinessInfo(businessId: number): Promise<BusinessInfo> {
  await requireBusinessAccess(businessId);

  const business = await prisma.business.findUnique({
    where: { BUSINESS_ID: businessId },
    select: {
      BUSINESS_NAME: true,
      EMAIL_ADDRESS: true,
    },
  });

  if (!business) {
    throw new Error("Business not found");
  }

  return {
    name: business.BUSINESS_NAME || `Business #${businessId}`,
    email: business.EMAIL_ADDRESS || "Not provided",
  };
}

export async function getFulfillmentSettings(
  businessId: number
): Promise<FulfillmentSettingsRow> {
  await requireBusinessAccess(businessId);

  const [settings, cashSettings] = await Promise.all([
    prisma.business_settings.findUnique({
      where: { BUSINESS_ID: businessId },
    }),
    prisma.$queryRaw<
      Array<{
        CASH_ON_DELIVERY_ENABLED: number | null;
        CASH_ON_PICKUP_ENABLED: number | null;
      }>
    >`
      SELECT CASH_ON_DELIVERY_ENABLED, CASH_ON_PICKUP_ENABLED
      FROM business_settings
      WHERE BUSINESS_ID = ${businessId}
      LIMIT 1
    `,
  ]);

  return mapFulfillmentSettings(businessId, settings, cashSettings[0]);
}

export async function updateFulfillmentSettings(
  businessId: number,
  payload: Partial<FulfillmentSettingsPayload>
): Promise<FulfillmentSettingsRow> {
  await requireBusinessAccess(businessId);

  const normalizedPayload = normalizeFulfillmentPayload(payload);

  const settings = await prisma.$transaction(async (tx) => {
    const saved = await tx.business_settings.upsert({
      where: { BUSINESS_ID: businessId },
      create: {
        BUSINESS_ID: businessId,
        DELIVERY_ENABLED: normalizedPayload.deliveryEnabled ? 1 : 0,
        DELIVERY_ZONES_JSON: JSON.stringify(normalizedPayload.deliveryZones),
        PICKUP_ENABLED: normalizedPayload.pickupEnabled ? 1 : 0,
        PICKUP_INSTRUCTIONS: normalizedPayload.pickupInstructions,
        DEFAULT_PICKUP_PREP_MINUTES: normalizedPayload.defaultPickupPrepMinutes,
        DEFAULT_DELIVERY_PREP_MINUTES:
          normalizedPayload.defaultDeliveryPrepMinutes,
      },
      update: {
        DELIVERY_ENABLED: normalizedPayload.deliveryEnabled ? 1 : 0,
        DELIVERY_ZONES_JSON: JSON.stringify(normalizedPayload.deliveryZones),
        PICKUP_ENABLED: normalizedPayload.pickupEnabled ? 1 : 0,
        PICKUP_INSTRUCTIONS: normalizedPayload.pickupInstructions,
        DEFAULT_PICKUP_PREP_MINUTES: normalizedPayload.defaultPickupPrepMinutes,
        DEFAULT_DELIVERY_PREP_MINUTES:
          normalizedPayload.defaultDeliveryPrepMinutes,
        LAST_UPDATE_DATETIME: new Date(),
      },
    });

    await tx.$executeRaw`
      UPDATE business_settings
      SET CASH_ON_DELIVERY_ENABLED = ${normalizedPayload.cashOnDeliveryEnabled ? 1 : 0},
          CASH_ON_PICKUP_ENABLED = ${normalizedPayload.cashOnPickupEnabled ? 1 : 0}
      WHERE BUSINESS_ID = ${businessId}
    `;

    return saved;
  });

  return mapFulfillmentSettings(businessId, settings, {
    CASH_ON_DELIVERY_ENABLED: normalizedPayload.cashOnDeliveryEnabled ? 1 : 0,
    CASH_ON_PICKUP_ENABLED: normalizedPayload.cashOnPickupEnabled ? 1 : 0,
  });
}

export async function getBusinessSettings(
  businessId: number
): Promise<BusinessSettingsRow | null> {
  await requireBusinessAccess(businessId);

  const settings = await prisma.business_settings.findUnique({
    where: { BUSINESS_ID: businessId },
  });

  if (!settings) return null;

  return {
    id: settings.BUSINESS_SETTINGS_ID,
    businessId: settings.BUSINESS_ID,
    deliveryAreas: settings.DELIVERY_RANGE_ZIP_CODES || "",
  };
}

export async function upsertBusinessSettings(
  businessId: number,
  deliveryAreas: string
) {
  await requireBusinessAccess(businessId);

  const normalizedDeliveryAreas = normalizeDeliveryAreas(deliveryAreas);

  const settings = await prisma.business_settings.upsert({
    where: { BUSINESS_ID: businessId },
    create: {
      BUSINESS_ID: businessId,
      DELIVERY_RANGE_ZIP_CODES: normalizedDeliveryAreas,
      DELIVERY_ENABLED: 0,
    },
    update: {
      DELIVERY_RANGE_ZIP_CODES: normalizedDeliveryAreas,
      LAST_UPDATE_DATETIME: new Date(),
    },
  });

  return {
    id: settings.BUSINESS_SETTINGS_ID,
    businessId: settings.BUSINESS_ID,
    deliveryAreas: settings.DELIVERY_RANGE_ZIP_CODES || "",
  };
}
