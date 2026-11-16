import { prisma } from "@/lib/prisma";

// Read-only queries for the Super Admin area. Callers must have passed requirePlatformAdmin().

export const PLATFORM_PAGE_SIZE = 50;

export type RestaurantFilter = "all" | "live" | "pending" | "off";

export const pageOffset = (page: number) => (Math.max(1, page) - 1) * PLATFORM_PAGE_SIZE;

export function parsePage(value: string | string[] | undefined) {
  const page = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(page) && page > 0 && page <= 10_000 ? page : 1;
}

export function parseSearch(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim().slice(0, 100) ?? "";
}

export async function getPlatformOverview() {
  const [restaurants, live, pending, off, customers, owners, reviews, platformReviews, stories, requests] = await Promise.all([
    prisma.business.count(),
    prisma.business.count({ where: { APPROVED: 1, STATUS: 1 } }),
    prisma.business.count({ where: { OR: [{ APPROVED: 0 }, { APPROVED: null }] } }),
    prisma.business.count({ where: { APPROVED: 1, NOT: { STATUS: 1 } } }),
    prisma.visitors_account.count(),
    prisma.business_owner.count(),
    prisma.visitor_business_review.count({ where: { APPROVED: 0 } }),
    prisma.foodeez_review.count({ where: { APPROVED: 0 } }),
    prisma.visitor_food_journey.count({ where: { APPROVED: 0 } }),
    prisma.business_onboarding_request.count({ where: { STATUS: "pending" } }),
  ]);
  return { restaurants, live, pending, off, customers, owners, reviews, platformReviews, stories, requests };
}

function restaurantWhere(search: string, filter: RestaurantFilter) {
  const byFilter =
    filter === "live" ? { APPROVED: 1, STATUS: 1 }
    : filter === "pending" ? { OR: [{ APPROVED: 0 }, { APPROVED: null }] }
    : filter === "off" ? { APPROVED: 1, NOT: { STATUS: 1 } }
    : {};
  if (!search) return byFilter;
  const id = /^\d+$/.test(search) ? Number(search) : null;
  return {
    AND: [
      byFilter,
      {
        OR: [
          { BUSINESS_NAME: { contains: search } },
          { EMAIL_ADDRESS: { contains: search } },
          { ADDRESS_TOWN: { contains: search } },
          ...(id !== null && id <= 2_147_483_647 ? [{ BUSINESS_ID: id }] : []),
        ],
      },
    ],
  };
}

export async function listRestaurants(input: { search: string; filter: RestaurantFilter; page: number }) {
  const where = restaurantWhere(input.search, input.filter);
  const [rows, total] = await Promise.all([
    prisma.business.findMany({
      where,
      orderBy: { BUSINESS_ID: "desc" },
      skip: pageOffset(input.page),
      take: PLATFORM_PAGE_SIZE,
      select: {
        BUSINESS_ID: true,
        BUSINESS_NAME: true,
        EMAIL_ADDRESS: true,
        ADDRESS_TOWN: true,
        ADDRESS_ZIP: true,
        APPROVED: true,
        STATUS: true,
        CREATION_DATETIME: true,
      },
    }),
    prisma.business.count({ where }),
  ]);
  const links = rows.length
    ? await prisma.business_owner_2_business.findMany({
        where: { BUSINESS_ID: { in: rows.map((row) => BigInt(row.BUSINESS_ID)) } },
        select: { BUSINESS_ID: true },
      })
    : [];
  const owned = new Set(links.map((link) => Number(link.BUSINESS_ID)));
  return {
    total,
    rows: rows.map((row) => ({
      id: row.BUSINESS_ID,
      name: row.BUSINESS_NAME || `Restaurant #${row.BUSINESS_ID}`,
      email: row.EMAIL_ADDRESS,
      town: [row.ADDRESS_ZIP ? String(row.ADDRESS_ZIP) : null, row.ADDRESS_TOWN].filter(Boolean).join(" "),
      approved: row.APPROVED === 1,
      active: row.STATUS === 1,
      hasOwner: owned.has(row.BUSINESS_ID),
      createdAt: row.CREATION_DATETIME,
    })),
  };
}

export async function listCustomers(input: { search: string; page: number }) {
  const where = input.search
    ? {
        OR: [
          { EMAIL_ADDRESS: { contains: input.search } },
          { FIRST_NAME: { contains: input.search } },
          { LAST_NAME: { contains: input.search } },
        ],
      }
    : {};
  const [rows, total] = await Promise.all([
    prisma.visitors_account.findMany({
      where,
      orderBy: { VISITORS_ACCOUNT_ID: "desc" },
      skip: pageOffset(input.page),
      take: PLATFORM_PAGE_SIZE,
      select: {
        VISITORS_ACCOUNT_ID: true,
        EMAIL_ADDRESS: true,
        FIRST_NAME: true,
        LAST_NAME: true,
        CREATION_DATETIME: true,
        PLATFORM_ROLE: true,
        PASSWORD: true,
      },
    }),
    prisma.visitors_account.count({ where }),
  ]);
  const ids = rows.map((row) => Number(row.VISITORS_ACCOUNT_ID));
  const [orders, owners] = ids.length
    ? await Promise.all([
        prisma.business_order.groupBy({
          by: ["VISITOR_ID"],
          where: { VISITOR_ID: { in: ids }, PAYMENT_DONE: { in: [1, 2] } },
          _count: { _all: true },
          _sum: { ORDER_FINAL_AMOUNT: true },
        }),
        prisma.business_owner.findMany({ where: { VISITORS_ACCOUNT_ID: { in: ids } }, select: { VISITORS_ACCOUNT_ID: true } }),
      ])
    : [[], []];
  const orderStats = new Map(orders.map((row) => [row.VISITOR_ID, row]));
  const ownerIds = new Set(owners.map((row) => row.VISITORS_ACCOUNT_ID));
  return {
    total,
    rows: rows.map((row) => {
      const id = Number(row.VISITORS_ACCOUNT_ID);
      const stats = orderStats.get(id);
      return {
        id,
        email: row.EMAIL_ADDRESS,
        name: [row.FIRST_NAME, row.LAST_NAME].filter(Boolean).join(" "),
        createdAt: row.CREATION_DATETIME,
        // Never return the hash itself; only whether the account can sign in with a password.
        signIn: row.PASSWORD ? "Password" : "Google",
        isOwner: ownerIds.has(id),
        isSuperAdmin: row.PLATFORM_ROLE === "super_admin",
        paidOrders: stats?._count._all ?? 0,
        spent: Number(stats?._sum.ORDER_FINAL_AMOUNT ?? 0),
      };
    }),
  };
}

export type ModerationKind = "reviews" | "platform" | "stories";

export async function listPendingContent(kind: ModerationKind, page: number) {
  const skip = pageOffset(page);
  const take = PLATFORM_PAGE_SIZE;
  if (kind === "reviews") {
    const [rows, total] = await Promise.all([
      prisma.visitor_business_review.findMany({ where: { APPROVED: 0 }, orderBy: { VISITOR_BUSINESS_REVIEW_ID: "asc" }, skip, take }),
      prisma.visitor_business_review.count({ where: { APPROVED: 0 } }),
    ]);
    const businesses = await prisma.business.findMany({
      where: { BUSINESS_ID: { in: rows.map((row) => row.BUSINESS_ID) } },
      select: { BUSINESS_ID: true, BUSINESS_NAME: true },
    });
    const names = new Map(businesses.map((row) => [row.BUSINESS_ID, row.BUSINESS_NAME]));
    return {
      total,
      rows: rows.map((row) => ({
        id: row.VISITOR_BUSINESS_REVIEW_ID,
        createdAt: row.CREATION_DATETIME,
        heading: `${row.RATING}★ for ${names.get(row.BUSINESS_ID) || `restaurant #${row.BUSINESS_ID}`}`,
        author: `Account #${row.VISITORS_ACCOUNT_ID}`,
        text: row.REMARKS,
        media: [row.PIC_1, row.PIC_2, row.PIC_3, row.PIC_4, row.PIC_5, row.PIC_6, row.PIC_7, row.PIC_8, row.PIC_9, row.PIC_10].filter((pic): pic is string => Boolean(pic)),
        video: row.VIDEO_1,
      })),
    };
  }
  if (kind === "platform") {
    const [rows, total] = await Promise.all([
      prisma.foodeez_review.findMany({ where: { APPROVED: 0 }, orderBy: { FOODEEZ_REVIEW_ID: "asc" }, skip, take }),
      prisma.foodeez_review.count({ where: { APPROVED: 0 } }),
    ]);
    return {
      total,
      rows: rows.map((row) => ({
        id: Number(row.FOODEEZ_REVIEW_ID),
        createdAt: row.CREATION_DATETIME,
        heading: `${row.RATING ?? "?"}★ for Foodeez`,
        author: row.REVIEWER_NAME || "Anonymous",
        text: row.REVIEW ?? "",
        media: [row.PIC_1, row.PIC_2, row.PIC_3].filter((pic): pic is string => Boolean(pic)),
        video: null,
      })),
    };
  }
  const [rows, total] = await Promise.all([
    prisma.visitor_food_journey.findMany({ where: { APPROVED: 0 }, orderBy: { VISITOR_FOOD_JOURNEY_ID: "asc" }, skip, take }),
    prisma.visitor_food_journey.count({ where: { APPROVED: 0 } }),
  ]);
  return {
    total,
    rows: rows.map((row) => ({
      id: row.VISITOR_FOOD_JOURNEY_ID,
      createdAt: row.CREATION_DATETIME,
      heading: `${row.TITLE || "Food story"}${row.RESTAURANT_NAME ? ` at ${row.RESTAURANT_NAME}` : ""}`,
      author: row.VISITOR_NAME || `Account #${row.VISITORS_ACCOUNT_ID}`,
      text: row.DESCRIPTION ?? "",
      media: [row.PIC_1, row.PIC_2, row.PIC_3].filter((pic): pic is string => Boolean(pic)),
      video: null,
    })),
  };
}
