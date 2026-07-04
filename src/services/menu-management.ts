import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export type EntityStatus = "active" | "inactive";

export type MenuTagRow = {
  id: number;
  title: string;
  status: EntityStatus;
  productCount: number;
  categoryCount: number;
};

export type MenuTagOption = {
  id: number;
  title: string;
  status: EntityStatus;
};

export type MenuCategoryRow = {
  id: number;
  title: string;
  description: string | null;
  pic: string | null;
  status: EntityStatus;
  tagIds: number[];
  tags: MenuTagOption[];
  productCount: number;
};

export type MenuProductRow = {
  id: number;
  title: string;
  description: string | null;
  productPrice: number;
  costPrice: number;
  compareAtPrice: number;
  pic: string | null;
  status: EntityStatus;
  stock: number;
  trackInventory: boolean;
  inventoryOnHand: number;
  inventoryAvailable: number;
  inventoryCommitted: number;
  weight: number;
  weightUnit: string;
  categoryId: number | null;
  categoryName: string;
  tagIds: number[];
  tags: MenuTagOption[];
};

export type PaginatedMenuProducts = {
  products: MenuProductRow[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
};

export type MenuCardRecordStatus = "active" | "inactive";
export type MenuCardAvailability = "active" | "scheduled" | "expired";

export type MenuCardRow = {
  id: number;
  title: string;
  validFrom: string | null;
  validTo: string | null;
  status: MenuCardRecordStatus;
  availability: MenuCardAvailability;
  repeatWeekly: boolean;
  activeDays: WeekdayKey[];
  isUnlimited: boolean;
  categoryCount: number;
  productCount: number;
};

export type MenuCardAvailableCategory = {
  id: number;
  title: string;
  productCount: number;
};

export type MenuCardPreviewProduct = {
  id: number;
  name: string;
  description: string;
  price: number;
  pic: string | null;
  status: EntityStatus;
};

export type MenuCardDetailRow = {
  id: number;
  categoryId: number;
  categoryTitle: string;
  productCount: number;
  displayOrder: number;
  products: MenuCardPreviewProduct[];
};

export type MenuCardWorkspace = {
  card: MenuCardRow;
  availableCategories: MenuCardAvailableCategory[];
  details: MenuCardDetailRow[];
};

const DELETED_STATUS = -1;
export const WEEKDAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];
const WEEKDAY_SET = new Set<string>(WEEKDAY_KEYS);

function toNumber(value: unknown) {
  if (value && typeof value === "object" && "toNumber" in value) {
    return (value as { toNumber: () => number }).toNumber();
  }

  return Number(value ?? 0);
}

function mapStatus(status?: number | null): EntityStatus {
  return status === 1 ? "active" : "inactive";
}

function mapMenuCardStatus(status?: number | null): MenuCardRecordStatus {
  return status === 0 ? "inactive" : "active";
}

function statusCode(status?: string | null) {
  if (status === "active") return 1;
  if (status === "inactive") return 0;
  return null;
}

function padDatePart(value: number) {
  return value.toString().padStart(2, "0");
}

function toDateValue(value?: Date | null) {
  if (!value) return null;

  return [
    value.getFullYear(),
    padDatePart(value.getMonth() + 1),
    padDatePart(value.getDate()),
  ].join("-");
}

function parseDateInput(value: unknown, fieldName: string, endOfDay = false) {
  const text = String(value || "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);

  if (!match) {
    throw new Error(`${fieldName} is required.`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(
    year,
    month - 1,
    day,
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0
  );

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error(`${fieldName} must be a valid date.`);
  }

  return date;
}

function isEnabled(value: unknown) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function parseActiveDaysJson(value?: string | null): WeekdayKey[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (day): day is WeekdayKey =>
        typeof day === "string" && WEEKDAY_SET.has(day)
    );
  } catch {
    return [];
  }
}

function normalizeActiveDays(values: unknown): WeekdayKey[] {
  if (!Array.isArray(values)) return [];

  return Array.from(
    new Set(
      values.filter(
        (day): day is WeekdayKey =>
          typeof day === "string" && WEEKDAY_SET.has(day)
      )
    )
  );
}

function todayWeekdayKey(): WeekdayKey {
  const index = new Date().getDay();
  return WEEKDAY_KEYS[index === 0 ? 6 : index - 1];
}

function computeMenuCardAvailability(
  validFrom: string | null,
  validTo: string | null,
  isUnlimited = false,
  repeatWeekly = false,
  activeDays: WeekdayKey[] = []
): MenuCardAvailability {
  const today = toDateValue(new Date()) || "";

  if (validFrom && validFrom > today) return "scheduled";
  if (!isUnlimited && validTo && validTo < today) return "expired";
  if (repeatWeekly && !activeDays.includes(todayWeekdayKey())) {
    return "scheduled";
  }

  return "active";
}

function normalizeMenuCardValues(values: {
  title?: unknown;
  validFrom?: unknown;
  validTo?: unknown;
  status?: unknown;
  repeatWeekly?: unknown;
  activeDays?: unknown;
  isUnlimited?: unknown;
}) {
  const title = String(values.title || "").trim();

  if (!title) throw new Error("Menu title is required.");
  if (title.length > 45) {
    throw new Error("Menu title must be at most 45 characters.");
  }

  const validFrom = parseDateInput(values.validFrom, "Valid from");
  const isUnlimited = isEnabled(values.isUnlimited);
  const repeatWeekly = isUnlimited || isEnabled(values.repeatWeekly);
  const activeDays = isUnlimited
    ? [...WEEKDAY_KEYS]
    : normalizeActiveDays(values.activeDays);
  const validTo = isUnlimited
    ? null
    : parseDateInput(values.validTo, "Valid to", true);

  if (validTo && validFrom.getTime() > validTo.getTime()) {
    throw new Error("Valid from must be before valid to.");
  }

  if ((repeatWeekly || isUnlimited) && !activeDays.length) {
    throw new Error("Select at least one active day.");
  }

  return {
    title,
    validFrom,
    validTo,
    status: statusCode(String(values.status || "active")) ?? 1,
    repeatWeekly: repeatWeekly ? 1 : 0,
    activeDaysJson: repeatWeekly ? JSON.stringify(activeDays) : null,
    isUnlimited: isUnlimited ? 1 : 0,
  };
}

function uniqueIds(values: unknown) {
  if (!Array.isArray(values)) return [];

  return Array.from(
    new Set(
      values
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    )
  );
}

function parseMoneyInput(value: unknown, fieldName: string, required = false) {
  const text = String(value ?? "").trim();

  if (!text && !required) return "0";

  const amount = Number(text);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`${fieldName} must be 0 or more.`);
  }

  return text || "0";
}

function parseWholeNumberInput(value: unknown, fieldName: string) {
  const amount = Number(String(value ?? "0").trim() || "0");

  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error(`${fieldName} must be a whole number 0 or more.`);
  }

  return amount;
}

function normalizeWeightUnit(value: unknown) {
  const unit = String(value || "gm");
  return ["gm", "kg", "ml", "l"].includes(unit) ? unit : "gm";
}

function normalizeProductValues(values: {
  title?: unknown;
  description?: unknown;
  product_price?: unknown;
  cost_price?: unknown;
  compare_as_price?: unknown;
  track_inventory?: unknown;
  inventory_on_hand?: unknown;
  inventory_commited?: unknown;
  weight?: unknown;
  weight_unit?: unknown;
  pic?: unknown;
}) {
  const title = String(values.title || "").trim();
  const price = parseMoneyInput(values.product_price, "Product price", true);
  const costPrice = parseMoneyInput(values.cost_price, "Cost price");
  const compareAtPrice = parseMoneyInput(
    values.compare_as_price,
    "Compare-at price"
  );

  if (!title) throw new Error("Product name and price are required.");
  if (title.length > 100) {
    throw new Error("Product name must be at most 100 characters.");
  }
  if (Number(compareAtPrice) > 0 && Number(compareAtPrice) <= Number(price)) {
    throw new Error("Compare-at price should be greater than product price.");
  }

  const trackInventory =
    values.track_inventory === true ||
    values.track_inventory === "true" ||
    values.track_inventory === 1 ||
    values.track_inventory === "1";
  const committed = trackInventory
    ? parseWholeNumberInput(values.inventory_commited, "Committed inventory")
    : 0;
  const onHand = trackInventory
    ? parseWholeNumberInput(values.inventory_on_hand, "Stock quantity")
    : 0;

  return {
    title,
    description: String(values.description || "").trim() || null,
    productPrice: price,
    costPrice,
    compareAtPrice,
    trackInventory,
    inventoryOnHand: onHand,
    inventoryAvailable: trackInventory ? Math.max(onHand - committed, 0) : 0,
    inventoryCommitted: committed,
    weight: parseWholeNumberInput(values.weight, "Weight"),
    weightUnit: normalizeWeightUnit(values.weight_unit),
    pic: String(values.pic || "").trim() || null,
  };
}

function parsePositiveInt(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function containsTag(tagIds: number[], expectedIds: number[]) {
  return tagIds.some((tagId) => expectedIds.includes(tagId));
}

async function getVisitorAccountId() {
  const session = await getServerSession(authOptions);
  const id = Number(session?.user?.id);

  if (Number.isFinite(id)) return id;

  if (!session?.user?.email) return null;

  const user = await prisma.visitors_account.findUnique({
    where: { EMAIL_ADDRESS: session.user.email },
  });

  return user?.VISITORS_ACCOUNT_ID ? Number(user.VISITORS_ACCOUNT_ID) : null;
}

export async function requireMenuBusinessAccess(businessId: number) {
  const visitorAccountId = await getVisitorAccountId();

  if (!visitorAccountId) {
    throw new Error("Unauthorized");
  }

  const owner = await prisma.business_owner.findFirst({
    where: { VISITORS_ACCOUNT_ID: visitorAccountId },
  });

  if (!owner) {
    throw new Error("Forbidden");
  }

  const access = await prisma.business_owner_2_business.findFirst({
    where: {
      BUSINESS_OWNER_ID: BigInt(owner.BUSINESS_OWNER_ID),
      BUSINESS_ID: BigInt(businessId),
    },
  });

  if (!access) {
    throw new Error("Forbidden");
  }
}

async function getActiveTagsForBusiness(businessId: number) {
  return prisma.business_product_tag.findMany({
    where: {
      BUSINESS_ID: businessId,
      STATUS: { not: DELETED_STATUS },
    },
    orderBy: { TITLE: "asc" },
  });
}

async function assertTagsBelongToBusiness(businessId: number, tagIds: number[]) {
  if (!tagIds.length) return;

  const count = await prisma.business_product_tag.count({
    where: {
      BUSINESS_ID: businessId,
      BUSINESS_PRODUCT_TAG_ID: { in: tagIds },
      STATUS: { not: DELETED_STATUS },
    },
  });

  if (count !== tagIds.length) {
    throw new Error("One or more tags are invalid.");
  }
}

async function getCategoryTagIds(categoryId: number) {
  const links = await prisma.business_product_category_2_tag.findMany({
    where: { BUSINESS_PRODUCT_CATEGORY_ID: categoryId },
  });

  return links
    .map((link) => link.BUSINESS_PRODUCT_TAG_ID)
    .filter((id): id is number => id !== null);
}

async function getOwnedCategory(businessId: number, categoryId: number) {
  const category = await prisma.business_product_category.findFirst({
    where: {
      BUSINESS_PRODUCT_CATEGORY_ID: categoryId,
      BUSINESS_ID: businessId,
      STATUS: { not: DELETED_STATUS },
    },
  });

  if (!category) {
    throw new Error("Category not found.");
  }

  return category;
}

async function getOwnedProduct(businessId: number, productId: number) {
  const product = await prisma.business_product.findFirst({
    where: {
      BUSINESS_PRODUCT_ID: productId,
      BUSINESS_ID: businessId,
      STATUS: { not: DELETED_STATUS },
    },
  });

  if (!product) {
    throw new Error("Product not found.");
  }

  return product;
}

async function getOwnedTag(businessId: number, tagId: number) {
  const tag = await prisma.business_product_tag.findFirst({
    where: {
      BUSINESS_PRODUCT_TAG_ID: tagId,
      BUSINESS_ID: businessId,
      STATUS: { not: DELETED_STATUS },
    },
  });

  if (!tag) {
    throw new Error("Tag not found.");
  }

  return tag;
}

type RawMenuCard = {
  BUSINESS_FOOD_MENU_CARD_ID: number;
  TITLE: string | null;
  VALID_FROM: Date | null;
  VALID_TO: Date | null;
  STATUS: number | null;
  REPEAT_WEEKLY: number | null;
  ACTIVE_DAYS_JSON: string | null;
  IS_UNLIMITED: number | null;
};

async function getOwnedMenuCard(businessId: number, cardId: number) {
  const card = await prisma.business_food_menu_card.findFirst({
    where: {
      BUSINESS_FOOD_MENU_CARD_ID: cardId,
      BUSINESS_ID: businessId,
      STATUS: { not: DELETED_STATUS },
    },
  });

  if (!card) {
    throw new Error("Menu card not found.");
  }

  return card;
}

function mapMenuCardRow(
  card: RawMenuCard,
  categoryCount = 0,
  productCount = 0
): MenuCardRow {
  const validFrom = toDateValue(card.VALID_FROM);
  const validTo = toDateValue(card.VALID_TO);
  const repeatWeekly = card.REPEAT_WEEKLY === 1;
  const isUnlimited = card.IS_UNLIMITED === 1;
  const activeDays = parseActiveDaysJson(card.ACTIVE_DAYS_JSON);

  return {
    id: card.BUSINESS_FOOD_MENU_CARD_ID,
    title: card.TITLE || `Menu #${card.BUSINESS_FOOD_MENU_CARD_ID}`,
    validFrom,
    validTo,
    status: mapMenuCardStatus(card.STATUS),
    availability: computeMenuCardAvailability(
      validFrom,
      validTo,
      isUnlimited,
      repeatWeekly,
      activeDays
    ),
    repeatWeekly,
    activeDays,
    isUnlimited,
    categoryCount,
    productCount,
  };
}

export async function listMenuTags(businessId: number): Promise<MenuTagRow[]> {
  await requireMenuBusinessAccess(businessId);

  const [tags, productLinks, categoryLinks, products, categories] =
    await Promise.all([
      getActiveTagsForBusiness(businessId),
      prisma.business_product_2_tag.findMany(),
      prisma.business_product_category_2_tag.findMany(),
      prisma.business_product.findMany({
        where: {
          BUSINESS_ID: businessId,
          STATUS: { not: DELETED_STATUS },
        },
        select: { BUSINESS_PRODUCT_ID: true },
      }),
      prisma.business_product_category.findMany({
        where: {
          BUSINESS_ID: businessId,
          STATUS: { not: DELETED_STATUS },
        },
        select: { BUSINESS_PRODUCT_CATEGORY_ID: true },
      }),
    ]);
  const productIds = new Set(products.map((product) => product.BUSINESS_PRODUCT_ID));
  const categoryIds = new Set(
    categories.map((category) => category.BUSINESS_PRODUCT_CATEGORY_ID)
  );

  return tags.map((tag) => ({
    id: tag.BUSINESS_PRODUCT_TAG_ID,
    title: tag.TITLE || `Tag #${tag.BUSINESS_PRODUCT_TAG_ID}`,
    status: mapStatus(tag.STATUS),
    productCount: productLinks.filter(
      (link) =>
        link.BUSINESS_PRODUCT_TAG_ID === tag.BUSINESS_PRODUCT_TAG_ID &&
        link.BUSINESS_PRODUCT_ID !== null &&
        productIds.has(link.BUSINESS_PRODUCT_ID)
    ).length,
    categoryCount: categoryLinks.filter(
      (link) =>
        link.BUSINESS_PRODUCT_TAG_ID === tag.BUSINESS_PRODUCT_TAG_ID &&
        link.BUSINESS_PRODUCT_CATEGORY_ID !== null &&
        categoryIds.has(link.BUSINESS_PRODUCT_CATEGORY_ID)
    ).length,
  }));
}

export async function createMenuTag(businessId: number, title: unknown) {
  await requireMenuBusinessAccess(businessId);

  const normalizedTitle = String(title || "").trim();
  if (!normalizedTitle) {
    throw new Error("Tag name is required.");
  }

  if (normalizedTitle.length > 45) {
    throw new Error("Tag name must be at most 45 characters.");
  }

  const tag = await prisma.business_product_tag.create({
    data: {
      BUSINESS_ID: businessId,
      TITLE: normalizedTitle,
      STATUS: 1,
      CREATION_DATETIME: new Date(),
    },
  });

  return {
    id: tag.BUSINESS_PRODUCT_TAG_ID,
    title: tag.TITLE || normalizedTitle,
    status: mapStatus(tag.STATUS),
    productCount: 0,
    categoryCount: 0,
  } satisfies MenuTagRow;
}

export async function updateMenuTag(
  businessId: number,
  tagId: number,
  values: { title?: unknown; status?: unknown }
) {
  await requireMenuBusinessAccess(businessId);
  await getOwnedTag(businessId, tagId);

  const data: { TITLE?: string; STATUS?: number } = {};
  if (values.title !== undefined) {
    const title = String(values.title || "").trim();
    if (!title) throw new Error("Tag name is required.");
    if (title.length > 45) {
      throw new Error("Tag name must be at most 45 characters.");
    }
    data.TITLE = title;
  }

  const nextStatus = statusCode(String(values.status || ""));
  if (nextStatus !== null) {
    data.STATUS = nextStatus;
  }

  const tag = await prisma.business_product_tag.update({
    where: { BUSINESS_PRODUCT_TAG_ID: tagId },
    data,
  });

  return {
    id: tag.BUSINESS_PRODUCT_TAG_ID,
    title: tag.TITLE || `Tag #${tag.BUSINESS_PRODUCT_TAG_ID}`,
    status: mapStatus(tag.STATUS),
    productCount: 0,
    categoryCount: 0,
  } satisfies MenuTagRow;
}

export async function deleteMenuTag(businessId: number, tagId: number) {
  await requireMenuBusinessAccess(businessId);
  await getOwnedTag(businessId, tagId);

  await prisma.$transaction([
    prisma.business_product_2_tag.deleteMany({
      where: { BUSINESS_PRODUCT_TAG_ID: tagId },
    }),
    prisma.business_product_category_2_tag.deleteMany({
      where: { BUSINESS_PRODUCT_TAG_ID: tagId },
    }),
    prisma.business_product_tag.update({
      where: { BUSINESS_PRODUCT_TAG_ID: tagId },
      data: { STATUS: DELETED_STATUS },
    }),
  ]);
}

export async function listMenuCategories(
  businessId: number
): Promise<MenuCategoryRow[]> {
  await requireMenuBusinessAccess(businessId);

  const [categories, tags, categoryLinks, productLinks, products] =
    await Promise.all([
      prisma.business_product_category.findMany({
        where: {
          BUSINESS_ID: businessId,
          STATUS: { not: DELETED_STATUS },
        },
        orderBy: { BUSINESS_PRODUCT_CATEGORY_ID: "desc" },
      }),
      getActiveTagsForBusiness(businessId),
      prisma.business_product_category_2_tag.findMany(),
      prisma.business_product_2_tag.findMany(),
      prisma.business_product.findMany({
        where: {
          BUSINESS_ID: businessId,
          STATUS: { not: DELETED_STATUS },
        },
        select: { BUSINESS_PRODUCT_ID: true },
      }),
    ]);
  const productIds = new Set(products.map((product) => product.BUSINESS_PRODUCT_ID));

  return categories.map((category) => {
    const tagIds = categoryLinks
      .filter(
        (link) =>
          link.BUSINESS_PRODUCT_CATEGORY_ID ===
          category.BUSINESS_PRODUCT_CATEGORY_ID
      )
      .map((link) => link.BUSINESS_PRODUCT_TAG_ID)
      .filter((id): id is number => id !== null);
    const categoryTags = tags
      .filter((tag) => tagIds.includes(tag.BUSINESS_PRODUCT_TAG_ID))
      .map<MenuTagOption>((tag) => ({
        id: tag.BUSINESS_PRODUCT_TAG_ID,
        title: tag.TITLE || `Tag #${tag.BUSINESS_PRODUCT_TAG_ID}`,
        status: mapStatus(tag.STATUS),
      }));
    const productCount = products.filter((product) => {
      const currentTagIds = productLinks
        .filter((link) => link.BUSINESS_PRODUCT_ID === product.BUSINESS_PRODUCT_ID)
        .map((link) => link.BUSINESS_PRODUCT_TAG_ID)
        .filter((id): id is number => id !== null);

      return containsTag(currentTagIds, tagIds) && productIds.has(product.BUSINESS_PRODUCT_ID);
    }).length;

    return {
      id: category.BUSINESS_PRODUCT_CATEGORY_ID,
      title: category.TITLE || `Category #${category.BUSINESS_PRODUCT_CATEGORY_ID}`,
      description: category.DESCRIPTION,
      pic: category.PIC,
      status: mapStatus(category.STATUS),
      tagIds,
      tags: categoryTags,
      productCount,
    };
  });
}

export async function createMenuCategory(
  businessId: number,
  values: {
    title?: unknown;
    description?: unknown;
    pic?: unknown;
    status?: unknown;
    tag_ids?: unknown;
  }
) {
  await requireMenuBusinessAccess(businessId);

  const title = String(values.title || "").trim();
  if (!title) throw new Error("Category name is required.");
  if (title.length > 45) throw new Error("Category name must be at most 45 characters.");

  const tagIds = uniqueIds(values.tag_ids);
  await assertTagsBelongToBusiness(businessId, tagIds);

  const status = statusCode(String(values.status || "active"));
  const category = await prisma.$transaction(async (tx) => {
    const created = await tx.business_product_category.create({
      data: {
        BUSINESS_ID: businessId,
        TITLE: title,
        DESCRIPTION: String(values.description || "").trim() || null,
        PIC: String(values.pic || "").trim() || null,
        STATUS: status ?? 1,
        CREATION_DATETIME: new Date(),
      },
    });

    if (tagIds.length) {
      await tx.business_product_category_2_tag.createMany({
        data: tagIds.map((tagId) => ({
          BUSINESS_PRODUCT_CATEGORY_ID: created.BUSINESS_PRODUCT_CATEGORY_ID,
          BUSINESS_PRODUCT_TAG_ID: tagId,
          CREATION_DATETIME: new Date(),
        })),
      });
    }

    return created;
  });

  return category;
}

export async function updateMenuCategory(
  businessId: number,
  categoryId: number,
  values: {
    title?: unknown;
    description?: unknown;
    pic?: unknown;
    status?: unknown;
    tag_ids?: unknown;
  }
) {
  await requireMenuBusinessAccess(businessId);
  await getOwnedCategory(businessId, categoryId);

  const title = String(values.title || "").trim();
  if (!title) throw new Error("Category name is required.");
  if (title.length > 45) throw new Error("Category name must be at most 45 characters.");

  const tagIds = uniqueIds(values.tag_ids);
  await assertTagsBelongToBusiness(businessId, tagIds);
  const nextStatus = statusCode(String(values.status || ""));

  return prisma.$transaction(async (tx) => {
    const updated = await tx.business_product_category.update({
      where: { BUSINESS_PRODUCT_CATEGORY_ID: categoryId },
      data: {
        TITLE: title,
        DESCRIPTION: String(values.description || "").trim() || null,
        PIC: String(values.pic || "").trim() || null,
        ...(nextStatus !== null ? { STATUS: nextStatus } : {}),
      },
    });

    await tx.business_product_category_2_tag.deleteMany({
      where: { BUSINESS_PRODUCT_CATEGORY_ID: categoryId },
    });

    if (tagIds.length) {
      await tx.business_product_category_2_tag.createMany({
        data: tagIds.map((tagId) => ({
          BUSINESS_PRODUCT_CATEGORY_ID: categoryId,
          BUSINESS_PRODUCT_TAG_ID: tagId,
          CREATION_DATETIME: new Date(),
        })),
      });
    }

    return updated;
  });
}

export async function deleteMenuCategory(businessId: number, categoryId: number) {
  await requireMenuBusinessAccess(businessId);
  await getOwnedCategory(businessId, categoryId);

  await prisma.$transaction([
    prisma.business_product_category_2_tag.deleteMany({
      where: { BUSINESS_PRODUCT_CATEGORY_ID: categoryId },
    }),
    prisma.business_product_category.update({
      where: { BUSINESS_PRODUCT_CATEGORY_ID: categoryId },
      data: { STATUS: DELETED_STATUS },
    }),
  ]);
}

export async function listMenuProducts({
  businessId,
  search,
  categoryId,
  status,
  page,
  pageSize,
}: {
  businessId: number;
  search?: string | null;
  categoryId?: string | null;
  status?: string | null;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedMenuProducts> {
  await requireMenuBusinessAccess(businessId);

  const pageNumber = parsePositiveInt(page, 1);
  const size = Math.min(parsePositiveInt(pageSize, 20), 100);
  const searchText = search?.trim();
  const nextStatus = statusCode(status);
  const where: Record<string, unknown> = {
    BUSINESS_ID: businessId,
    STATUS: { not: DELETED_STATUS },
  };

  if (nextStatus !== null) {
    where.STATUS = nextStatus;
  }

  if (searchText) {
    where.OR = [
      { TITLE: { contains: searchText } },
      { DESCRIPTION: { contains: searchText } },
    ];
  }

  const [products, categories, tags, productLinks, categoryLinks] =
    await Promise.all([
      prisma.business_product.findMany({
        where,
        orderBy: { BUSINESS_PRODUCT_ID: "desc" },
      }),
      prisma.business_product_category.findMany({
        where: {
          BUSINESS_ID: businessId,
          STATUS: { not: DELETED_STATUS },
        },
        orderBy: { TITLE: "asc" },
      }),
      getActiveTagsForBusiness(businessId),
      prisma.business_product_2_tag.findMany(),
      prisma.business_product_category_2_tag.findMany(),
    ]);
  const requestedCategoryId = Number(categoryId);

  const rows = products.map<MenuProductRow>((product) => {
    const tagIds = productLinks
      .filter((link) => link.BUSINESS_PRODUCT_ID === product.BUSINESS_PRODUCT_ID)
      .map((link) => link.BUSINESS_PRODUCT_TAG_ID)
      .filter((id): id is number => id !== null);
    const matchedCategory = categories.find((category) => {
      const categoryTagIds = categoryLinks
        .filter(
          (link) =>
            link.BUSINESS_PRODUCT_CATEGORY_ID ===
            category.BUSINESS_PRODUCT_CATEGORY_ID
        )
        .map((link) => link.BUSINESS_PRODUCT_TAG_ID)
        .filter((id): id is number => id !== null);

      return containsTag(tagIds, categoryTagIds);
    });

    return {
      id: product.BUSINESS_PRODUCT_ID,
      title: product.TITLE,
      description: product.DESCRIPTION,
      productPrice: toNumber(product.PRODUCT_PRICE),
      costPrice: toNumber(product.COST_PRICE),
      compareAtPrice: toNumber(product.COMPARE_AS_PRICE),
      pic: product.PIC,
      status: mapStatus(product.STATUS),
      stock: product.INVENTORY_AVAILABLE ?? product.INVENTORY_ON_HAND ?? 0,
      trackInventory: product.TRACK_INVENTORY === 1,
      inventoryOnHand: product.INVENTORY_ON_HAND ?? 0,
      inventoryAvailable: product.INVENTORY_AVAILABLE ?? 0,
      inventoryCommitted: product.INVENTORY_COMMITED ?? 0,
      weight: product.WEIGHT ?? 0,
      weightUnit: product.WEIGHT_UNIT || "gm",
      categoryId: matchedCategory?.BUSINESS_PRODUCT_CATEGORY_ID || null,
      categoryName: matchedCategory?.TITLE || "Uncategorized",
      tagIds,
      tags: tags
        .filter((tag) => tagIds.includes(tag.BUSINESS_PRODUCT_TAG_ID))
        .map((tag) => ({
          id: tag.BUSINESS_PRODUCT_TAG_ID,
          title: tag.TITLE || `Tag #${tag.BUSINESS_PRODUCT_TAG_ID}`,
          status: mapStatus(tag.STATUS),
        })),
    };
  });
  const categoryFilteredRows =
    Number.isFinite(requestedCategoryId) && requestedCategoryId > 0
      ? rows.filter((row) => row.categoryId === requestedCategoryId)
      : rows;
  const totalCount = categoryFilteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / size));

  return {
    products: categoryFilteredRows.slice((pageNumber - 1) * size, pageNumber * size),
    pagination: {
      page: pageNumber,
      pageSize: size,
      totalCount,
      totalPages,
    },
  };
}

export async function createMenuProduct(
  businessId: number,
  values: {
    title?: unknown;
    description?: unknown;
    product_price?: unknown;
    cost_price?: unknown;
    compare_as_price?: unknown;
    track_inventory?: unknown;
    inventory_on_hand?: unknown;
    inventory_commited?: unknown;
    weight?: unknown;
    weight_unit?: unknown;
    pic?: unknown;
    tag_ids?: unknown;
    categoryId?: unknown;
  }
) {
  await requireMenuBusinessAccess(businessId);

  const normalized = normalizeProductValues(values);

  const categoryId = Number(values.categoryId);
  const explicitTagIds = uniqueIds(values.tag_ids);
  const categoryTagIds =
    Number.isInteger(categoryId) && categoryId > 0
      ? await getCategoryTagIds((await getOwnedCategory(businessId, categoryId)).BUSINESS_PRODUCT_CATEGORY_ID)
      : [];
  const tagIds = Array.from(new Set([...explicitTagIds, ...categoryTagIds]));
  await assertTagsBelongToBusiness(businessId, tagIds);

  return prisma.$transaction(async (tx) => {
    const product = await tx.business_product.create({
      data: {
        BUSINESS_ID: businessId,
        TITLE: normalized.title,
        DESCRIPTION: normalized.description,
        PRODUCT_PRICE: normalized.productPrice,
        COST_PRICE: normalized.costPrice,
        COMPARE_AS_PRICE: normalized.compareAtPrice,
        TRACK_INVENTORY: normalized.trackInventory ? 1 : 0,
        INVENTORY_ON_HAND: normalized.inventoryOnHand,
        INVENTORY_AVAILABLE: normalized.inventoryAvailable,
        INVENTORY_COMMITED: normalized.inventoryCommitted,
        WEIGHT: normalized.weight,
        WEIGHT_UNIT: normalized.weightUnit,
        PIC: normalized.pic,
        STATUS: 1,
        CREATION_DATETIME: new Date(),
      },
    });

    if (tagIds.length) {
      await tx.business_product_2_tag.createMany({
        data: tagIds.map((tagId) => ({
          BUSINESS_PRODUCT_ID: product.BUSINESS_PRODUCT_ID,
          BUSINESS_PRODUCT_TAG_ID: tagId,
          CREATION_DATETIME: new Date(),
        })),
      });
    }

    return product;
  });
}

export async function updateMenuProduct(
  businessId: number,
  productId: number,
  values: {
    title?: unknown;
    description?: unknown;
    product_price?: unknown;
    cost_price?: unknown;
    compare_as_price?: unknown;
    track_inventory?: unknown;
    inventory_on_hand?: unknown;
    inventory_commited?: unknown;
    weight?: unknown;
    weight_unit?: unknown;
    pic?: unknown;
    status?: unknown;
    tag_ids?: unknown;
    categoryId?: unknown;
  }
) {
  await requireMenuBusinessAccess(businessId);
  await getOwnedProduct(businessId, productId);

  const normalized = normalizeProductValues(values);

  const categoryId = Number(values.categoryId);
  const explicitTagIds = uniqueIds(values.tag_ids);
  const categoryTagIds =
    Number.isInteger(categoryId) && categoryId > 0
      ? await getCategoryTagIds((await getOwnedCategory(businessId, categoryId)).BUSINESS_PRODUCT_CATEGORY_ID)
      : [];
  const tagIds = Array.from(new Set([...explicitTagIds, ...categoryTagIds]));
  await assertTagsBelongToBusiness(businessId, tagIds);
  const nextStatus = statusCode(String(values.status || ""));

  return prisma.$transaction(async (tx) => {
    const product = await tx.business_product.update({
      where: { BUSINESS_PRODUCT_ID: productId },
      data: {
        TITLE: normalized.title,
        DESCRIPTION: normalized.description,
        PRODUCT_PRICE: normalized.productPrice,
        COST_PRICE: normalized.costPrice,
        COMPARE_AS_PRICE: normalized.compareAtPrice,
        TRACK_INVENTORY: normalized.trackInventory ? 1 : 0,
        INVENTORY_ON_HAND: normalized.inventoryOnHand,
        INVENTORY_AVAILABLE: normalized.inventoryAvailable,
        INVENTORY_COMMITED: normalized.inventoryCommitted,
        WEIGHT: normalized.weight,
        WEIGHT_UNIT: normalized.weightUnit,
        PIC: normalized.pic,
        ...(nextStatus !== null ? { STATUS: nextStatus } : {}),
      },
    });

    await tx.business_product_2_tag.deleteMany({
      where: { BUSINESS_PRODUCT_ID: productId },
    });

    if (tagIds.length) {
      await tx.business_product_2_tag.createMany({
        data: tagIds.map((tagId) => ({
          BUSINESS_PRODUCT_ID: productId,
          BUSINESS_PRODUCT_TAG_ID: tagId,
          CREATION_DATETIME: new Date(),
        })),
      });
    }

    return product;
  });
}

export async function updateMenuProductStatus(
  businessId: number,
  productId: number,
  status: string
) {
  await requireMenuBusinessAccess(businessId);
  await getOwnedProduct(businessId, productId);

  const nextStatus = statusCode(status);
  if (nextStatus === null) throw new Error("Invalid product status.");

  return prisma.business_product.update({
    where: { BUSINESS_PRODUCT_ID: productId },
    data: { STATUS: nextStatus },
  });
}

export async function deleteMenuProduct(businessId: number, productId: number) {
  await requireMenuBusinessAccess(businessId);
  await getOwnedProduct(businessId, productId);

  await prisma.business_product.update({
    where: { BUSINESS_PRODUCT_ID: productId },
    data: { STATUS: DELETED_STATUS },
  });
}

async function getBusinessCategoryProductIdMap(businessId: number) {
  const [categories, products, categoryLinks, productLinks] = await Promise.all([
    prisma.business_product_category.findMany({
      where: {
        BUSINESS_ID: businessId,
        STATUS: { not: DELETED_STATUS },
      },
      select: { BUSINESS_PRODUCT_CATEGORY_ID: true },
    }),
    prisma.business_product.findMany({
      where: {
        BUSINESS_ID: businessId,
        STATUS: { not: DELETED_STATUS },
      },
      select: { BUSINESS_PRODUCT_ID: true },
    }),
    prisma.business_product_category_2_tag.findMany(),
    prisma.business_product_2_tag.findMany(),
  ]);
  const productIds = new Set(
    products.map((product) => product.BUSINESS_PRODUCT_ID)
  );
  const productIdsByTag = new Map<number, Set<number>>();

  for (const link of productLinks) {
    if (
      link.BUSINESS_PRODUCT_ID === null ||
      link.BUSINESS_PRODUCT_TAG_ID === null ||
      !productIds.has(link.BUSINESS_PRODUCT_ID)
    ) {
      continue;
    }

    const current = productIdsByTag.get(link.BUSINESS_PRODUCT_TAG_ID) || new Set();
    current.add(link.BUSINESS_PRODUCT_ID);
    productIdsByTag.set(link.BUSINESS_PRODUCT_TAG_ID, current);
  }

  const productIdsByCategory = new Map<number, Set<number>>();
  for (const category of categories) {
    productIdsByCategory.set(category.BUSINESS_PRODUCT_CATEGORY_ID, new Set());
  }

  for (const link of categoryLinks) {
    if (
      link.BUSINESS_PRODUCT_CATEGORY_ID === null ||
      link.BUSINESS_PRODUCT_TAG_ID === null ||
      !productIdsByCategory.has(link.BUSINESS_PRODUCT_CATEGORY_ID)
    ) {
      continue;
    }

    const categoryProductIds = productIdsByCategory.get(
      link.BUSINESS_PRODUCT_CATEGORY_ID
    );
    const tagProductIds = productIdsByTag.get(link.BUSINESS_PRODUCT_TAG_ID);

    if (!categoryProductIds || !tagProductIds) continue;

    for (const productId of tagProductIds) {
      categoryProductIds.add(productId);
    }
  }

  return productIdsByCategory;
}

async function getMenuCategorySummaries(
  businessId: number
): Promise<MenuCardAvailableCategory[]> {
  const [categories, productIdsByCategory] = await Promise.all([
    prisma.business_product_category.findMany({
      where: {
        BUSINESS_ID: businessId,
        STATUS: { not: DELETED_STATUS },
      },
      orderBy: { TITLE: "asc" },
    }),
    getBusinessCategoryProductIdMap(businessId),
  ]);

  return categories.map((category) => ({
    id: category.BUSINESS_PRODUCT_CATEGORY_ID,
    title:
      category.TITLE || `Category #${category.BUSINESS_PRODUCT_CATEGORY_ID}`,
    productCount:
      productIdsByCategory.get(category.BUSINESS_PRODUCT_CATEGORY_ID)?.size || 0,
  }));
}

async function getActiveMenuCardDetails(cardId: number) {
  return prisma.business_food_menu_card_detail.findMany({
    where: {
      BUSINESS_FOOD_MENU_CARD_ID: cardId,
      STATUS: { not: DELETED_STATUS },
    },
    orderBy: [
      { DISPLAY_ORDER: "asc" },
      { BUSINESS_FOOD_MENU_CARD_DETAIL_ID: "asc" },
    ],
  });
}

async function getMenuCardPreviewProducts(
  businessId: number,
  cardId: number
) {
  const rows = await prisma.business_food_menu_card_detail_view.findMany({
    where: {
      BUSINESS_ID: businessId,
      BUSINESS_FOOD_MENU_CARD_ID: cardId,
    },
    orderBy: [{ BUSINESS_PRODUCT_CATEGORY_ID: "asc" }, { PRODUCT_NAME: "asc" }],
  });
  const productsByCategory = new Map<number, MenuCardPreviewProduct[]>();
  const seenProductKeys = new Set<string>();

  for (const row of rows) {
    if (row.BUSINESS_PRODUCT_CATEGORY_ID === null) continue;

    const productKey = `${row.BUSINESS_PRODUCT_CATEGORY_ID}:${row.BUSINESS_PRODUCT_ID}`;
    if (seenProductKeys.has(productKey)) continue;
    seenProductKeys.add(productKey);

    const products =
      productsByCategory.get(row.BUSINESS_PRODUCT_CATEGORY_ID) || [];
    products.push({
      id: row.BUSINESS_PRODUCT_ID,
      name: row.PRODUCT_NAME,
      description: row.PRODUCT_DESCRIPTION || "",
      price: toNumber(row.PRODUCT_PRICE),
      pic: row.PIC || null,
      status: "active",
    });
    productsByCategory.set(row.BUSINESS_PRODUCT_CATEGORY_ID, products);
  }

  return productsByCategory;
}

async function buildMenuCardDetailRows(
  businessId: number,
  cardId: number,
  details: Awaited<ReturnType<typeof getActiveMenuCardDetails>>
): Promise<MenuCardDetailRow[]> {
  const categoryIds = Array.from(
    new Set(
      details
        .map((detail) => detail.BUSINESS_PRODUCT_CATEGORY_ID)
        .filter((id): id is number => id !== null)
    )
  );

  if (!categoryIds.length) return [];

  const [categories, productIdsByCategory, previewProductsByCategory] =
    await Promise.all([
      prisma.business_product_category.findMany({
        where: {
          BUSINESS_ID: businessId,
          BUSINESS_PRODUCT_CATEGORY_ID: { in: categoryIds },
          STATUS: { not: DELETED_STATUS },
        },
      }),
      getBusinessCategoryProductIdMap(businessId),
      getMenuCardPreviewProducts(businessId, cardId),
    ]);
  const categoryById = new Map(
    categories.map((category) => [
      category.BUSINESS_PRODUCT_CATEGORY_ID,
      category,
    ])
  );

  return details
    .map((detail) => {
      const categoryId = detail.BUSINESS_PRODUCT_CATEGORY_ID;
      const category = categoryId ? categoryById.get(categoryId) : null;

      if (!categoryId || !category) return null;

      return {
        id: detail.BUSINESS_FOOD_MENU_CARD_DETAIL_ID,
        categoryId,
        categoryTitle:
          category.TITLE || `Category #${category.BUSINESS_PRODUCT_CATEGORY_ID}`,
        productCount: productIdsByCategory.get(categoryId)?.size || 0,
        displayOrder: detail.DISPLAY_ORDER || 1,
        products: previewProductsByCategory.get(categoryId) || [],
      } satisfies MenuCardDetailRow;
    })
    .filter((detail): detail is MenuCardDetailRow => detail !== null);
}

export async function listMenuCards(
  businessId: number
): Promise<MenuCardRow[]> {
  await requireMenuBusinessAccess(businessId);

  const cards = await prisma.business_food_menu_card.findMany({
    where: {
      BUSINESS_ID: businessId,
      STATUS: { not: DELETED_STATUS },
    },
    orderBy: { BUSINESS_FOOD_MENU_CARD_ID: "desc" },
  });

  if (!cards.length) return [];

  const cardIds = cards.map((card) => card.BUSINESS_FOOD_MENU_CARD_ID);
  const [details, productIdsByCategory] = await Promise.all([
    prisma.business_food_menu_card_detail.findMany({
      where: {
        BUSINESS_FOOD_MENU_CARD_ID: { in: cardIds },
        STATUS: { not: DELETED_STATUS },
      },
    }),
    getBusinessCategoryProductIdMap(businessId),
  ]);
  const countsByCard = new Map<
    number,
    { categoryIds: Set<number>; productIds: Set<number> }
  >();

  for (const cardId of cardIds) {
    countsByCard.set(cardId, {
      categoryIds: new Set(),
      productIds: new Set(),
    });
  }

  for (const detail of details) {
    const cardId = detail.BUSINESS_FOOD_MENU_CARD_ID;
    const categoryId = detail.BUSINESS_PRODUCT_CATEGORY_ID;

    if (cardId === null || categoryId === null) continue;

    const counts = countsByCard.get(cardId);
    if (!counts) continue;

    counts.categoryIds.add(categoryId);
    for (const productId of productIdsByCategory.get(categoryId) || []) {
      counts.productIds.add(productId);
    }
  }

  return cards.map((card) => {
    const counts = countsByCard.get(card.BUSINESS_FOOD_MENU_CARD_ID);

    return mapMenuCardRow(
      card,
      counts?.categoryIds.size || 0,
      counts?.productIds.size || 0
    );
  });
}

async function getMenuCardRowWithCounts(businessId: number, cardId: number) {
  const card = (await listMenuCards(businessId)).find((item) => item.id === cardId);

  if (!card) {
    throw new Error("Menu card not found.");
  }

  return card;
}

async function duplicateMenuCard(businessId: number, sourceCardId: number) {
  const source = await getOwnedMenuCard(businessId, sourceCardId);
  const sourceDetails = await getActiveMenuCardDetails(sourceCardId);
  const title = `Copy of ${source.TITLE || `Menu #${sourceCardId}`}`.slice(0, 45);

  const createdId = await prisma.$transaction(async (tx) => {
    const created = await tx.business_food_menu_card.create({
      data: {
        CREATION_DATETIME: new Date(),
        BUSINESS_ID: businessId,
        TITLE: title,
        VALID_FROM: source.VALID_FROM,
        VALID_TO: source.VALID_TO,
        STATUS: source.STATUS === 0 ? 0 : 1,
        REPEAT_WEEKLY: source.REPEAT_WEEKLY === 1 ? 1 : 0,
        ACTIVE_DAYS_JSON: source.ACTIVE_DAYS_JSON,
        IS_UNLIMITED: source.IS_UNLIMITED === 1 ? 1 : 0,
      },
    });

    const detailData = sourceDetails
      .filter((detail) => detail.BUSINESS_PRODUCT_CATEGORY_ID !== null)
      .map((detail) => ({
        BUSINESS_FOOD_MENU_CARD_ID: created.BUSINESS_FOOD_MENU_CARD_ID,
        BUSINESS_PRODUCT_CATEGORY_ID: detail.BUSINESS_PRODUCT_CATEGORY_ID,
        DISPLAY_ORDER: detail.DISPLAY_ORDER || 1,
        STATUS: 1,
      }));

    if (detailData.length) {
      await tx.business_food_menu_card_detail.createMany({
        data: detailData,
      });
    }

    return created.BUSINESS_FOOD_MENU_CARD_ID;
  });

  return getMenuCardRowWithCounts(businessId, createdId);
}

export async function createMenuCard(
  businessId: number,
  values: {
    title?: unknown;
    validFrom?: unknown;
    validTo?: unknown;
    status?: unknown;
    repeatWeekly?: unknown;
    activeDays?: unknown;
    isUnlimited?: unknown;
    duplicateFromId?: unknown;
  }
) {
  await requireMenuBusinessAccess(businessId);

  const duplicateFromId = Number(values.duplicateFromId);
  if (Number.isInteger(duplicateFromId) && duplicateFromId > 0) {
    return duplicateMenuCard(businessId, duplicateFromId);
  }

  const normalized = normalizeMenuCardValues(values);
  const created = await prisma.business_food_menu_card.create({
    data: {
      CREATION_DATETIME: new Date(),
      BUSINESS_ID: businessId,
      TITLE: normalized.title,
      VALID_FROM: normalized.validFrom,
      VALID_TO: normalized.validTo,
      STATUS: normalized.status,
      REPEAT_WEEKLY: normalized.repeatWeekly,
      ACTIVE_DAYS_JSON: normalized.activeDaysJson,
      IS_UNLIMITED: normalized.isUnlimited,
    },
  });

  return getMenuCardRowWithCounts(
    businessId,
    created.BUSINESS_FOOD_MENU_CARD_ID
  );
}

export async function updateMenuCard(
  businessId: number,
  cardId: number,
  values: {
    title?: unknown;
    validFrom?: unknown;
    validTo?: unknown;
    status?: unknown;
    repeatWeekly?: unknown;
    activeDays?: unknown;
    isUnlimited?: unknown;
  }
) {
  await requireMenuBusinessAccess(businessId);
  await getOwnedMenuCard(businessId, cardId);

  const normalized = normalizeMenuCardValues(values);

  await prisma.business_food_menu_card.update({
    where: { BUSINESS_FOOD_MENU_CARD_ID: cardId },
    data: {
      TITLE: normalized.title,
      VALID_FROM: normalized.validFrom,
      VALID_TO: normalized.validTo,
      STATUS: normalized.status,
      REPEAT_WEEKLY: normalized.repeatWeekly,
      ACTIVE_DAYS_JSON: normalized.activeDaysJson,
      IS_UNLIMITED: normalized.isUnlimited,
    },
  });

  return getMenuCardRowWithCounts(businessId, cardId);
}

export async function deleteMenuCard(businessId: number, cardId: number) {
  await requireMenuBusinessAccess(businessId);
  await getOwnedMenuCard(businessId, cardId);

  await prisma.$transaction([
    prisma.business_food_menu_card_detail.deleteMany({
      where: { BUSINESS_FOOD_MENU_CARD_ID: cardId },
    }),
    prisma.business_food_menu_card.delete({
      where: { BUSINESS_FOOD_MENU_CARD_ID: cardId },
    }),
  ]);
}

export async function getMenuCardWorkspace(
  businessId: number,
  cardId: number
): Promise<MenuCardWorkspace> {
  await requireMenuBusinessAccess(businessId);
  await getOwnedMenuCard(businessId, cardId);

  const [card, details, allCategories] = await Promise.all([
    getMenuCardRowWithCounts(businessId, cardId),
    getActiveMenuCardDetails(cardId),
    getMenuCategorySummaries(businessId),
  ]);
  const detailRows = await buildMenuCardDetailRows(businessId, cardId, details);
  const assignedCategoryIds = new Set(
    detailRows.map((detail) => detail.categoryId)
  );

  return {
    card,
    details: detailRows,
    availableCategories: allCategories.filter(
      (category) => !assignedCategoryIds.has(category.id)
    ),
  };
}

export async function addMenuCardDetail(
  businessId: number,
  cardId: number,
  values: { categoryId?: unknown; displayOrder?: unknown }
) {
  await requireMenuBusinessAccess(businessId);
  await getOwnedMenuCard(businessId, cardId);

  const categoryId = Number(values.categoryId);
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    throw new Error("Category is required.");
  }

  await getOwnedCategory(businessId, categoryId);

  const existing = await prisma.business_food_menu_card_detail.findFirst({
    where: {
      BUSINESS_FOOD_MENU_CARD_ID: cardId,
      BUSINESS_PRODUCT_CATEGORY_ID: categoryId,
      STATUS: { not: DELETED_STATUS },
    },
  });

  if (existing) {
    throw new Error("Category is already assigned to this menu card.");
  }

  const currentMax = await prisma.business_food_menu_card_detail.aggregate({
    where: {
      BUSINESS_FOOD_MENU_CARD_ID: cardId,
      STATUS: { not: DELETED_STATUS },
    },
    _max: { DISPLAY_ORDER: true },
  });
  const displayOrder = parsePositiveInt(
    values.displayOrder,
    (currentMax._max.DISPLAY_ORDER || 0) + 1
  );
  const detail = await prisma.business_food_menu_card_detail.create({
    data: {
      BUSINESS_FOOD_MENU_CARD_ID: cardId,
      BUSINESS_PRODUCT_CATEGORY_ID: categoryId,
      DISPLAY_ORDER: displayOrder,
      STATUS: 1,
    },
  });
  const rows = await buildMenuCardDetailRows(businessId, cardId, [detail]);

  return rows[0];
}

export async function removeMenuCardDetail(
  businessId: number,
  cardId: number,
  detailId: number
) {
  await requireMenuBusinessAccess(businessId);
  await getOwnedMenuCard(businessId, cardId);

  const detail = await prisma.business_food_menu_card_detail.findFirst({
    where: {
      BUSINESS_FOOD_MENU_CARD_DETAIL_ID: detailId,
      BUSINESS_FOOD_MENU_CARD_ID: cardId,
      STATUS: { not: DELETED_STATUS },
    },
  });

  if (!detail) {
    throw new Error("Menu card category not found.");
  }

  await prisma.business_food_menu_card_detail.delete({
    where: { BUSINESS_FOOD_MENU_CARD_DETAIL_ID: detailId },
  });
}

export async function reorderMenuCardDetails(
  businessId: number,
  cardId: number,
  values: unknown
) {
  await requireMenuBusinessAccess(businessId);
  await getOwnedMenuCard(businessId, cardId);

  if (!Array.isArray(values)) {
    throw new Error("Reorder payload must be a list.");
  }

  const updates = values.map((item) => ({
    detailId: Number((item as { detailId?: unknown }).detailId),
    displayOrder: Number((item as { displayOrder?: unknown }).displayOrder),
  }));
  const uniqueDetailIds = new Set(updates.map((item) => item.detailId));

  if (
    !updates.length ||
    uniqueDetailIds.size !== updates.length ||
    updates.some(
      (item) =>
        !Number.isInteger(item.detailId) ||
        item.detailId <= 0 ||
        !Number.isInteger(item.displayOrder) ||
        item.displayOrder <= 0
    )
  ) {
    throw new Error("Reorder payload is invalid.");
  }

  const existing = await prisma.business_food_menu_card_detail.findMany({
    where: {
      BUSINESS_FOOD_MENU_CARD_ID: cardId,
      BUSINESS_FOOD_MENU_CARD_DETAIL_ID: {
        in: updates.map((item) => item.detailId),
      },
      STATUS: { not: DELETED_STATUS },
    },
    select: { BUSINESS_FOOD_MENU_CARD_DETAIL_ID: true },
  });

  if (existing.length !== updates.length) {
    throw new Error("One or more menu card categories are invalid.");
  }

  await prisma.$transaction(
    updates.map((item) =>
      prisma.business_food_menu_card_detail.update({
        where: { BUSINESS_FOOD_MENU_CARD_DETAIL_ID: item.detailId },
        data: { DISPLAY_ORDER: item.displayOrder },
      })
    )
  );

  return buildMenuCardDetailRows(
    businessId,
    cardId,
    await getActiveMenuCardDetails(cardId)
  );
}
