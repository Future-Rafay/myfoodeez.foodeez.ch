import { normalizeOrderType } from "@/lib/orderStatus";

type EtaOrder = {
  DELIVERY_ET?: Date | string | null;
  CREATION_DATETIME?: Date | string | null;
  ORDER_TYPE?: string | null;
};

type EtaBusinessSettings = {
  DEFAULT_DELIVERY_PREP_MINUTES?: number | null;
  DEFAULT_PICKUP_PREP_MINUTES?: number | null;
  defaultDeliveryPrepMinutes?: number | null;
  defaultPickupPrepMinutes?: number | null;
};

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function toDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? new Date(value) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatEtaTimeOnly(date: Date | string | null | undefined): string {
  const parsed = toDate(date);
  return parsed ? timeFormatter.format(parsed) : "Not available";
}

export function getDisplayEta(
  order: EtaOrder,
  businessSettings: EtaBusinessSettings
): { time: string; isDefault: boolean } {
  const explicitEta = toDate(order.DELIVERY_ET);

  if (explicitEta) {
    return { time: formatEtaTimeOnly(explicitEta), isDefault: false };
  }

  const fallbackEta = toDate(order.CREATION_DATETIME);
  if (!fallbackEta) return { time: "Not available", isDefault: true };

  fallbackEta.setMinutes(
    fallbackEta.getMinutes() +
      (normalizeOrderType(order.ORDER_TYPE) === "pickup"
        ? businessSettings.DEFAULT_PICKUP_PREP_MINUTES ??
          businessSettings.defaultPickupPrepMinutes ??
          20
        : businessSettings.DEFAULT_DELIVERY_PREP_MINUTES ??
          businessSettings.defaultDeliveryPrepMinutes ??
          45)
  );

  return { time: formatEtaTimeOnly(fallbackEta), isDefault: true };
}
