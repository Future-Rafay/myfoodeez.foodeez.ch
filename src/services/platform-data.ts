import { prisma } from "@/lib/prisma";
import { PAYMENT_DONE, STATUS_CODE_BY_NAME } from "@/lib/orderStatus";
import type { Prisma } from "../../prisma/generated/prisma/client";

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

export type CustomerRole = "all" | "customers" | "owners" | "admins";

export function parseCustomerRole(value: string | string[] | undefined): CustomerRole {
  const role = Array.isArray(value) ? value[0] : value;
  return role === "customers" || role === "owners" || role === "admins" ? role : "all";
}

/** Matches email, first or last name, "first last", or an account ID ("17" or "#17"). */
export function customerSearchWhere(search: string): Prisma.visitors_accountWhereInput {
  if (!search) return {};
  const or: Prisma.visitors_accountWhereInput[] = [
    { EMAIL_ADDRESS: { contains: search } },
    { FIRST_NAME: { contains: search } },
    { LAST_NAME: { contains: search } },
  ];
  const id = /^#?(\d{1,12})$/.exec(search)?.[1];
  if (id) or.push({ VISITORS_ACCOUNT_ID: BigInt(id) });
  const [first, ...rest] = search.split(/\s+/);
  if (rest.length) or.push({ FIRST_NAME: { contains: first }, LAST_NAME: { contains: rest.join(" ") } });
  return { OR: or };
}

export async function listCustomers(input: { search: string; page: number; role?: CustomerRole }) {
  const role = input.role ?? "all";
  const ownerAccountIds =
    role === "owners" || role === "customers"
      ? (await prisma.business_owner.findMany({ where: { VISITORS_ACCOUNT_ID: { not: null } }, select: { VISITORS_ACCOUNT_ID: true } })).map((row) =>
          BigInt(row.VISITORS_ACCOUNT_ID as number)
        )
      : [];
  const roleWhere: Prisma.visitors_accountWhereInput =
    role === "admins"
      ? { PLATFORM_ROLE: "super_admin" }
      : role === "owners"
        ? { VISITORS_ACCOUNT_ID: { in: ownerAccountIds } }
        : role === "customers"
          ? { VISITORS_ACCOUNT_ID: { notIn: ownerAccountIds }, OR: [{ PLATFORM_ROLE: null }, { NOT: { PLATFORM_ROLE: "super_admin" } }] }
          : {};
  const where: Prisma.visitors_accountWhereInput = { AND: [customerSearchWhere(input.search), roleWhere] };
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

// Same rule as countsAsRevenue in src/lib/orderStatus.ts, expressed as a database filter.
const REVENUE_ORDER_WHERE: Prisma.business_orderWhereInput = {
  AND: [
    { OR: [{ ORDER_STATUS: null }, { ORDER_STATUS: { not: STATUS_CODE_BY_NAME.rejected } }] },
    { OR: [{ PAYMENT_DONE: null }, { PAYMENT_DONE: { notIn: [PAYMENT_DONE.REFUNDED, PAYMENT_DONE.FAILED] } }] },
  ],
  STRIPE_REFUND_STATUS: null,
};

export const KPI_RANGES = [7, 30, 90] as const;
export type KpiRange = (typeof KPI_RANGES)[number];

export function parseKpiRange(value: string | string[] | undefined): KpiRange {
  const days = Number(Array.isArray(value) ? value[0] : value);
  return (KPI_RANGES as readonly number[]).includes(days) ? (days as KpiRange) : 30;
}

/** Signups, orders, revenue and new restaurants in the last `days`, next to the period before it. */
export async function getPlatformKpis(days: KpiRange, now = new Date()) {
  const span = days * 24 * 60 * 60 * 1000;
  const since = new Date(now.getTime() - span);
  const before = new Date(since.getTime() - span);
  const period = async (from: Date, to: Date) => {
    const created = { gte: from, lt: to };
    const [signups, orders, revenue, restaurants] = await Promise.all([
      prisma.visitors_account.count({ where: { CREATION_DATETIME: created } }),
      prisma.business_order.count({ where: { CREATION_DATETIME: created } }),
      prisma.business_order.aggregate({ where: { ...REVENUE_ORDER_WHERE, CREATION_DATETIME: created }, _sum: { ORDER_FINAL_AMOUNT: true } }),
      prisma.business.count({ where: { CREATION_DATETIME: created } }),
    ]);
    return { signups, orders, revenue: Number(revenue._sum.ORDER_FINAL_AMOUNT ?? 0), restaurants };
  };
  const [current, previous] = await Promise.all([period(since, now), period(before, since)]);
  return { days, current, previous };
}

type AuditRow = {
  AUDIT_LOG_ID: bigint;
  CREATION_DATETIME: Date;
  ACTOR_VISITORS_ACCOUNT_ID: bigint;
  ACTION: string;
  ENTITY_TYPE: string;
  ENTITY_ID: string;
  DETAILS_JSON: string | null;
};

async function withActors(rows: AuditRow[]) {
  const ids = [...new Set(rows.map((row) => row.ACTOR_VISITORS_ACCOUNT_ID))];
  const actors = ids.length
    ? await prisma.visitors_account.findMany({ where: { VISITORS_ACCOUNT_ID: { in: ids } }, select: { VISITORS_ACCOUNT_ID: true, EMAIL_ADDRESS: true } })
    : [];
  const emails = new Map(actors.map((row) => [row.VISITORS_ACCOUNT_ID, row.EMAIL_ADDRESS]));
  return rows.map((row) => ({
    id: Number(row.AUDIT_LOG_ID),
    createdAt: row.CREATION_DATETIME,
    action: row.ACTION,
    entityType: row.ENTITY_TYPE,
    entityId: row.ENTITY_ID,
    details: row.DETAILS_JSON,
    actor: emails.get(row.ACTOR_VISITORS_ACCOUNT_ID) ?? `Account #${row.ACTOR_VISITORS_ACCOUNT_ID}`,
  }));
}

export async function listAuditLog(input: { page: number; action: string; entityType: string; entityId: string }) {
  const where: Prisma.platform_audit_logWhereInput = {
    ...(input.action ? { ACTION: input.action } : {}),
    ...(input.entityType ? { ENTITY_TYPE: input.entityType } : {}),
    ...(input.entityId ? { ENTITY_ID: input.entityId } : {}),
  };
  const [rows, total, actions] = await Promise.all([
    prisma.platform_audit_log.findMany({ where, orderBy: { AUDIT_LOG_ID: "desc" }, skip: pageOffset(input.page), take: PLATFORM_PAGE_SIZE }),
    prisma.platform_audit_log.count({ where }),
    prisma.platform_audit_log.findMany({ distinct: ["ACTION"], select: { ACTION: true }, orderBy: { ACTION: "asc" } }),
  ]);
  return { rows: await withActors(rows), total, actions: actions.map((row) => row.ACTION) };
}

export async function getRestaurantDetail(businessId: number) {
  const business = await prisma.business.findUnique({
    where: { BUSINESS_ID: businessId },
    select: {
      BUSINESS_ID: true,
      BUSINESS_NAME: true,
      ADDRESS_ZIP: true,
      ADDRESS_TOWN: true,
      PHONE_NUMBER: true,
      EMAIL_ADDRESS: true,
      WEB_ADDRESS: true,
      APPROVED: true,
      STATUS: true,
      CREATION_DATETIME: true,
    },
  });
  if (!business) return null;

  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [links, orderCount, orders30, revenue, recentOrders, requests] = await Promise.all([
    prisma.business_owner_2_business.findMany({ where: { BUSINESS_ID: BigInt(businessId) }, select: { BUSINESS_OWNER_ID: true, CREATION_DATETIME: true } }),
    prisma.business_order.count({ where: { BUSINESS_ID: businessId } }),
    prisma.business_order.count({ where: { BUSINESS_ID: businessId, CREATION_DATETIME: { gte: since30 } } }),
    prisma.business_order.aggregate({ where: { ...REVENUE_ORDER_WHERE, BUSINESS_ID: businessId }, _sum: { ORDER_FINAL_AMOUNT: true } }),
    prisma.business_order.findMany({
      where: { BUSINESS_ID: businessId },
      orderBy: { CREATION_DATETIME: "desc" },
      take: 10,
      select: {
        BUSINESS_ORDER_ID: true,
        ORDER_NUMBER: true,
        CREATION_DATETIME: true,
        ORDER_FINAL_AMOUNT: true,
        ORDER_STATUS: true,
        ORDER_TYPE: true,
        PAYMENT_DONE: true,
        STRIPE_REFUND_STATUS: true,
      },
    }),
    prisma.business_onboarding_request.findMany({
      where: { BUSINESS_ID: businessId },
      orderBy: { CREATION_DATETIME: "desc" },
      select: { REQUEST_ID: true, REQUEST_TYPE: true, STATUS: true, CREATION_DATETIME: true, VISITORS_ACCOUNT_ID: true, REVIEW_NOTE: true },
    }),
  ]);

  const owners = links.length
    ? await prisma.business_owner.findMany({
        where: { BUSINESS_OWNER_ID: { in: links.map((link) => Number(link.BUSINESS_OWNER_ID)) } },
        select: { BUSINESS_OWNER_ID: true, VISITORS_ACCOUNT_ID: true },
      })
    : [];
  const accountIds = [...owners.map((owner) => owner.VISITORS_ACCOUNT_ID), ...requests.map((request) => Number(request.VISITORS_ACCOUNT_ID))].filter(
    (id): id is number => typeof id === "number"
  );
  const [accounts, audit] = await Promise.all([
    accountIds.length
      ? prisma.visitors_account.findMany({
          where: { VISITORS_ACCOUNT_ID: { in: accountIds.map((id) => BigInt(id)) } },
          select: { VISITORS_ACCOUNT_ID: true, EMAIL_ADDRESS: true, FIRST_NAME: true, LAST_NAME: true },
        })
      : [],
    prisma.platform_audit_log.findMany({
      where: {
        OR: [
          { ENTITY_TYPE: "business", ENTITY_ID: String(businessId) },
          ...(requests.length
            ? [{ ENTITY_TYPE: "business_onboarding_request", ENTITY_ID: { in: requests.map((request) => String(request.REQUEST_ID)) } }]
            : []),
        ],
      },
      orderBy: { AUDIT_LOG_ID: "desc" },
      take: 25,
    }),
  ]);
  const accountById = new Map(accounts.map((account) => [Number(account.VISITORS_ACCOUNT_ID), account]));
  const describe = (id: number | null | undefined) => {
    const account = id ? accountById.get(id) : undefined;
    return { id: id ?? null, email: account?.EMAIL_ADDRESS ?? null, name: [account?.FIRST_NAME, account?.LAST_NAME].filter(Boolean).join(" ") };
  };

  return {
    business: {
      id: business.BUSINESS_ID,
      name: business.BUSINESS_NAME || `Restaurant #${business.BUSINESS_ID}`,
      town: [business.ADDRESS_ZIP?.toString(), business.ADDRESS_TOWN].filter(Boolean).join(" "),
      phone: business.PHONE_NUMBER,
      email: business.EMAIL_ADDRESS,
      website: business.WEB_ADDRESS,
      approved: business.APPROVED === 1,
      active: business.STATUS === 1,
      createdAt: business.CREATION_DATETIME,
    },
    owners: owners.map((owner) => ({
      ...describe(owner.VISITORS_ACCOUNT_ID),
      since: links.find((link) => Number(link.BUSINESS_OWNER_ID) === owner.BUSINESS_OWNER_ID)?.CREATION_DATETIME ?? null,
    })),
    orders: {
      total: orderCount,
      last30Days: orders30,
      revenue: Number(revenue._sum.ORDER_FINAL_AMOUNT ?? 0),
      recent: recentOrders.map((order) => ({ ...order, ORDER_FINAL_AMOUNT: Number(order.ORDER_FINAL_AMOUNT ?? 0) })),
    },
    requests: requests.map((request) => ({
      id: request.REQUEST_ID,
      type: request.REQUEST_TYPE,
      status: request.STATUS,
      createdAt: request.CREATION_DATETIME,
      note: request.REVIEW_NOTE,
      account: describe(Number(request.VISITORS_ACCOUNT_ID)),
    })),
    history: await withActors(audit),
  };
}
