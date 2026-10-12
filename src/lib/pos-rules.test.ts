import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript test runner requires the file extension.
import { normalizePosItems } from "./pos-rules.ts";

test("POS item validation accepts catalog and positive custom items", () => {
  assert.deepEqual(
    normalizePosItems([
      { kind: "product", productId: 12, quantity: 2 },
      { kind: "custom", price: 4.5, quantity: 1 },
    ]),
    [
      { kind: "product", productId: 12, quantity: 2 },
      { kind: "custom", price: 4.5, quantity: 1 },
    ]
  );
  assert.throws(
    () => normalizePosItems([{ kind: "custom", price: 0, quantity: 1 }]),
    /greater than CHF 0/
  );
  assert.throws(
    () => normalizePosItems([{ kind: "product", productId: 12, quantity: 0 }]),
    /whole numbers/
  );
});
