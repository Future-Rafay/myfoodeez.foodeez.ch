import assert from "node:assert/strict";
import test from "node:test";
import { requireOwnerBusinessLink } from "./business-access";

test("owner authorization rejects cross-business access", async () => {
  const seen: Array<{ ownerId: bigint; businessId: bigint }> = [];
  const db = {
    business_owner: {
      findFirst: async () => ({ BUSINESS_OWNER_ID: BigInt(17) }),
    },
    business_owner_2_business: {
      findFirst: async ({ where }: { where: { BUSINESS_OWNER_ID: bigint; BUSINESS_ID: bigint } }) => {
        seen.push({ ownerId: where.BUSINESS_OWNER_ID, businessId: where.BUSINESS_ID });
        return where.BUSINESS_ID === BigInt(4)
          ? { BUSINESS_OWNER_2_BUSINESS_ID: BigInt(1) }
          : null;
      },
    },
  };

  await requireOwnerBusinessLink(db as never, 22, 4);
  await assert.rejects(requireOwnerBusinessLink(db as never, 22, 5), /Forbidden/);
  assert.deepEqual(seen, [
    { ownerId: BigInt(17), businessId: BigInt(4) },
    { ownerId: BigInt(17), businessId: BigInt(5) },
  ]);
});

test("owner authorization rejects non-owners", async () => {
  const db = {
    business_owner: { findFirst: async () => null },
    business_owner_2_business: { findFirst: async () => null },
  };
  await assert.rejects(requireOwnerBusinessLink(db as never, 22, 4), /Forbidden/);
});
