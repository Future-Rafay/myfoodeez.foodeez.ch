import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("shared order schema keeps atomic IDs and request idempotency keys", async () => {
  const schema = await readFile(new URL("../../prisma/schema.prisma", import.meta.url), "utf8");

  assert.match(
    schema,
    /BUSINESS_ORDER_ID\s+Int\s+@id\s+@default\(autoincrement\(\)\)/
  );
  assert.match(
    schema,
    /BUSINESS_ORDER_DETAIL_ID\s+Int\s+@id\s+@default\(autoincrement\(\)\)/
  );
  assert.match(schema, /POS_REQUEST_ID\s+String\?\s+@unique/);
  assert.match(schema, /CHECKOUT_REQUEST_ID\s+String\?\s+@unique/);
});
