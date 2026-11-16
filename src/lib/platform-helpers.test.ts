import assert from "node:assert/strict";
import test from "node:test";
import { businessSlug } from "./customer-site";
import { parsePage, parseSearch } from "../services/platform-data";

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
