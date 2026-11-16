// Links from the admin app to public foodeez.ch pages.
// The customer site reads only the trailing "-<id>" of a slug (parseSlug), so the name part is cosmetic.

const baseUrl = () => (process.env.CUSTOMER_SITE_URL || "https://foodeez.ch").replace(/\/+$/, "");

export function customerSiteUrl(path: string) {
  return `${baseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

export function businessSlug(name: string | null | undefined, id: number) {
  const base = (name || "restaurant")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "restaurant"}-${id}`;
}

/** Public restaurant profile. */
export const restaurantProfileUrl = (name: string | null | undefined, id: number) => customerSiteUrl(`/business/${businessSlug(name, id)}`);

/** Owner-facing profile with the "Claim this business" card. */
export const restaurantClaimUrl = (name: string | null | undefined, id: number) => customerSiteUrl(`/manage-business/${businessSlug(name, id)}`);

/** Restaurant websites are often stored without a protocol ("www.pizza.ch"); same rule as the customer site's toExternalUrl. */
export function toExternalUrl(url: string | null | undefined) {
  const value = url?.trim();
  if (!value || value === "0" || value === "null") return undefined;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}
