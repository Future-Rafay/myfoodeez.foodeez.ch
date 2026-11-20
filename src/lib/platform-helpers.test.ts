import assert from "node:assert/strict";
import test from "node:test";
import { businessSlug } from "./customer-site";
import { customerSearchWhere, parseCustomerRole, parseKpiRange, parsePage, parseSearch } from "../services/platform-data";

test("restaurant slugs end in the id the customer site parses", () => {
  assert.equal(businessSlug("Café Zürich & Co.", 42), "cafe-zurich-co-42");
  assert.equal(businessSlug(null, 7), "restaurant-7");
  assert.equal(businessSlug("!!!", 7), "restaurant-7");
});

test("paging and search inputs are bounded", () => {
  assert.equal(parsePage("3"), 3);
  assert.equal(parsePage("0"), 1);
  assert.equal(parsePage("-1"), 1);
  assert.equal(parsePage("1.5"), 1);
  assert.equal(parsePage("abc"), 1);
  assert.equal(parsePage(["2", "9"]), 2);
  assert.equal(parseSearch("  pizza  "), "pizza");
  assert.equal(parseSearch("x".repeat(500)).length, 100);
  assert.equal(parseSearch(undefined), "");
});

test("customer search also matches an account number and a full name", () => {
  assert.deepEqual(customerSearchWhere(""), {});
  const byId = customerSearchWhere("#17").OR ?? [];
  assert.ok(byId.some((clause) => "VISITORS_ACCOUNT_ID" in clause && clause.VISITORS_ACCOUNT_ID === BigInt(17)));
  const byName = customerSearchWhere("Rafay Nadeem").OR ?? [];
  assert.ok(byName.some((clause) => JSON.stringify(clause) === JSON.stringify({ FIRST_NAME: { contains: "Rafay" }, LAST_NAME: { contains: "Nadeem" } })));
  assert.ok(!(customerSearchWhere("rafay").OR ?? []).some((clause) => "VISITORS_ACCOUNT_ID" in clause));
});

test("role and KPI range inputs fall back to safe defaults", () => {
  assert.equal(parseCustomerRole("owners"), "owners");
  assert.equal(parseCustomerRole("root"), "all");
  assert.equal(parseKpiRange("7"), 7);
  assert.equal(parseKpiRange("365"), 30);
  assert.equal(parseKpiRange(undefined), 30);
});
