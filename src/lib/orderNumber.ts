type OrderNumberSource = {
  BUSINESS_ORDER_ID: number;
  ORDER_NUMBER?: string | null;
};

export function formatOrderNumberFromId(id: number): string {
  return `FDZ.${Math.trunc(id).toString().padStart(6, "0")}`;
}

export function generateOrderNumberFromId(id: number): string {
  return formatOrderNumberFromId(id);
}

export function getDisplayOrderNumber(order: OrderNumberSource): string {
  return order.ORDER_NUMBER || formatOrderNumberFromId(order.BUSINESS_ORDER_ID);
}
