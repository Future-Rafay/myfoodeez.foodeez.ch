export type RawPosItem =
  | { kind: "product"; productId: number; quantity: number }
  | { kind: "custom"; price: number; quantity: number };

export function normalizePosItems(items: RawPosItem[]) {
  if (!Array.isArray(items) || items.length === 0) throw new Error("Add at least one item.");
  return items.map((item) => {
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 999) {
      throw new Error("Item quantities must be whole numbers between 1 and 999.");
    }
    if (item.kind === "custom") {
      const price = Number(item.price);
      if (!Number.isFinite(price) || price <= 0 || price > 999999.99) {
        throw new Error("Custom item price must be greater than CHF 0.");
      }
      return {
        kind: "custom" as const,
        price: Math.round(price * 100) / 100,
        quantity,
      };
    }
    const productId = Number(item.productId);
    if (!Number.isInteger(productId) || productId <= 0) throw new Error("Invalid product.");
    return { kind: "product" as const, productId, quantity };
  });
}
