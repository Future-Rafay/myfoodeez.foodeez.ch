export const ORDER_STATUS = {
  PREPARING: 1,
  OUT_FOR_DELIVERY: 2,
  DELIVERED: 3,
  REJECTED: 4,
  READY_FOR_PICKUP: 5,
  PICKED_UP: 6,
} as const;

export const PAYMENT_DONE = {
  PENDING: 0,
  PAID: 1,
  REFUNDED: 2,
  FAILED: 3,
} as const;

export type OrderType = "delivery" | "pickup";

export type OrderStatusName =
  | "preparing"
  | "out_for_delivery"
  | "delivered"
  | "rejected"
  | "ready_for_pickup"
  | "picked_up";

export type OrderAction = {
  label: string;
  status: OrderStatusName;
  variant?: "destructive";
};

type OrderLike = {
  ORDER_STATUS?: number | string | null;
  ORDER_TYPE?: string | null;
  PAYMENT_DONE?: number | null;
  PAYMENT_MODE?: string | null;
  STRIPE_REFUND_STATUS?: string | null;
};

export const STATUS_CODE_BY_NAME: Record<OrderStatusName, number> = {
  preparing: ORDER_STATUS.PREPARING,
  out_for_delivery: ORDER_STATUS.OUT_FOR_DELIVERY,
  delivered: ORDER_STATUS.DELIVERED,
  rejected: ORDER_STATUS.REJECTED,
  ready_for_pickup: ORDER_STATUS.READY_FOR_PICKUP,
  picked_up: ORDER_STATUS.PICKED_UP,
};

export function normalizeOrderType(value?: string | null): OrderType {
  return value === "pickup" ? "pickup" : "delivery";
}

export function normalizeOrderStatus(value: unknown): OrderStatusName {
  const name = String(value ?? "").trim().toLowerCase();
  if (name in STATUS_CODE_BY_NAME) return name as OrderStatusName;

  const status = Number(value);
  if (status === ORDER_STATUS.OUT_FOR_DELIVERY) return "out_for_delivery";
  if (status === ORDER_STATUS.DELIVERED) return "delivered";
  if (status === ORDER_STATUS.REJECTED) return "rejected";
  if (status === ORDER_STATUS.READY_FOR_PICKUP) return "ready_for_pickup";
  if (status === ORDER_STATUS.PICKED_UP) return "picked_up";
  return "preparing";
}

export function getOrderStatusLabel(order: OrderLike) {
  const status = normalizeOrderStatus(order.ORDER_STATUS);
  const orderType = normalizeOrderType(order.ORDER_TYPE);

  if (status === "rejected") return "Rejected";
  if (status === "preparing") return "Preparing";
  if (orderType === "pickup" && status === "ready_for_pickup") {
    return "Ready for pickup";
  }
  if (orderType === "pickup" && status === "picked_up") return "Picked up";
  if (status === "out_for_delivery") return "Out for delivery";
  if (status === "delivered") return "Delivered";
  return "Preparing";
}

export function getOrderStatusBadgeColor(order: OrderLike) {
  const status = normalizeOrderStatus(order.ORDER_STATUS);
  if (status === "preparing") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "out_for_delivery") {
    return "border-purple-200 bg-purple-50 text-purple-700";
  }
  if (status === "ready_for_pickup") {
    return "border-purple-200 bg-purple-50 text-purple-700";
  }
  if (status === "delivered" || status === "picked_up") {
    return "border-green-200 bg-green-50 text-green-700";
  }
  return "border-red-200 bg-red-50 text-red-700";
}

export function canTransitionOrderStatus(
  currentStatus: number | string | null,
  nextStatus: number | string | OrderStatusName,
  orderType: string | null | undefined
) {
  const current = normalizeOrderStatus(currentStatus);
  const next =
    typeof nextStatus === "string" && nextStatus in STATUS_CODE_BY_NAME
      ? nextStatus
      : normalizeOrderStatus(nextStatus);
  const type = normalizeOrderType(orderType);

  if (current === "preparing" && next === "rejected") return true;
  if (type === "delivery") {
    return (
      (current === "preparing" && next === "out_for_delivery") ||
      (current === "out_for_delivery" && next === "delivered")
    );
  }

  return (
    (current === "preparing" && next === "ready_for_pickup") ||
    (current === "ready_for_pickup" && next === "picked_up")
  );
}

export function getAllowedOrderActions(order: OrderLike): OrderAction[] {
  const status = normalizeOrderStatus(order.ORDER_STATUS);
  const orderType = normalizeOrderType(order.ORDER_TYPE);

  if (status !== "preparing" && status !== "out_for_delivery" && status !== "ready_for_pickup") {
    return [];
  }

  if (orderType === "delivery") {
    if (status === "preparing") {
      return [
        { label: "Mark out for delivery", status: "out_for_delivery" },
        { label: "Reject", status: "rejected", variant: "destructive" },
      ];
    }

    return status === "out_for_delivery"
      ? [{ label: "Mark delivered", status: "delivered" }]
      : [];
  }

  if (status === "preparing") {
    return [
      { label: "Mark ready for pickup", status: "ready_for_pickup" },
      { label: "Reject", status: "rejected", variant: "destructive" },
    ];
  }

  return status === "ready_for_pickup"
    ? [{ label: "Mark picked up", status: "picked_up" }]
    : [];
}

export function getPaymentStatusLabel(
  value?: number | null,
  orderType?: string | null
) {
  if (value === PAYMENT_DONE.PAID) return "Paid";
  if (value === PAYMENT_DONE.REFUNDED) return "Refunded";
  if (value === PAYMENT_DONE.FAILED) return "Failed";
  if (normalizeOrderType(orderType) === "pickup") return "Cash on pickup";
  if (normalizeOrderType(orderType) === "delivery") return "Cash on delivery";
  return "Pending / unpaid";
}

export function getPaymentStatusBadgeColor(value?: number | null) {
  if (value === PAYMENT_DONE.PAID) return "border-green-200 bg-green-50 text-green-700";
  if (value === PAYMENT_DONE.REFUNDED) return "border-purple-200 bg-purple-50 text-purple-700";
  if (value === PAYMENT_DONE.FAILED) return "border-red-200 bg-red-50 text-red-700";
  return "border-yellow-200 bg-yellow-50 text-yellow-800";
}

export function isStripePaidOrder(order: OrderLike) {
  const mode = String(order.PAYMENT_MODE || "").toLowerCase();
  return order.PAYMENT_DONE === PAYMENT_DONE.PAID && /stripe|card/.test(mode);
}

export function countsAsRevenue(order: OrderLike) {
  return (
    normalizeOrderStatus(order.ORDER_STATUS) !== "rejected" &&
    order.PAYMENT_DONE !== PAYMENT_DONE.REFUNDED &&
    order.PAYMENT_DONE !== PAYMENT_DONE.FAILED &&
    !order.STRIPE_REFUND_STATUS
  );
}
