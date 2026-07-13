"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  PAYMENT_DONE,
  STATUS_CODE_BY_NAME,
  normalizeOrderStatus,
  type OrderStatusName,
} from "@/lib/orderStatus";
import { getDisplayOrderNumber } from "@/lib/orderNumber";
import prisma from "@/lib/prisma";
import { S3Storage } from "@/lib/s3-storage";

const storage = new S3Storage();

export type AdminBusinessCard = {
  id: number;
  name: string;
  shortName: string | null;
  logo: string | null;
  imageUrl: string | null;
  town: string | null;
  status: "active" | "inactive";
};

export type DashboardKpis = {
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
  activeProducts: number;
};

export type RecentOrderRow = {
  id: number;
  orderNumber: string;
  customer: string;
  items: number;
  total: number;
  status: OrderStatusName;
  createdAt: string | null;
};

export type ProductCategoryOption = {
  id: number;
  title: string;
};

export type AdminProductRow = {
  id: number;
  name: string;
  description: string | null;
  categoryId: number | null;
  categoryName: string;
  price: number;
  costPrice: number;
  compareAtPrice: number;
  stock: number;
  trackInventory: boolean;
  inventoryOnHand: number;
  inventoryAvailable: number;
  inventoryCommitted: number;
  weight: number;
  weightUnit: string;
  status: "active" | "inactive";
  imageUrl: string | null;
  tagIds: number[];
};

export type ProductFormValues = {
  id?: number;
  businessId: number;
  title: string;
  description: string;
  product_price: string;
  cost_price?: string;
  compare_as_price?: string;
  track_inventory?: boolean;
  inventory_on_hand?: string;
  inventory_commited?: string;
  weight?: string;
  weight_unit?: string;
  pic: string;
  tag_ids: number[];
  categoryId?: number | null;
};

function toNumber(value: unknown) {
  if (value && typeof value === "object" && "toNumber" in value) {
    return (value as { toNumber: () => number }).toNumber();
  }

  return Number(value ?? 0);
}

function parseMoney(value: string | undefined, fieldName: string, required = false) {
  const text = String(value ?? "").trim();

  if (!text && !required) return 0;

  const amount = Number(text);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`${fieldName} must be 0 or more.`);
  }

  return text || "0";
}

function parseWholeNumber(value: string | undefined, fieldName: string) {
  const amount = Number(String(value ?? "0").trim() || "0");

  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error(`${fieldName} must be a whole number 0 or more.`);
  }

  return amount;
}

function normalizeWeightUnit(value: string | undefined) {
  return ["gm", "kg", "ml", "l"].includes(value || "") ? value : "gm";
}

function formatCustomer(firstName?: string | null, lastName?: string | null) {
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();
  return name || "Guest customer";
}

async function getVisitorAccountId() {
  const session = await getServerSession(authOptions);
  const id = Number(session?.user?.id);

  if (Number.isFinite(id)) {
    return id;
  }

  if (!session?.user?.email) {
    return null;
  }

  const user = await prisma.visitors_account.findUnique({
    where: { EMAIL_ADDRESS: session.user.email },
  });

  return user?.VISITORS_ACCOUNT_ID ? Number(user.VISITORS_ACCOUNT_ID) : null;
}

async function requireBusinessOwner() {
  const visitorAccountId = await getVisitorAccountId();

  if (!visitorAccountId) {
    throw new Error("Unauthorized");
  }

  const owner = await prisma.business_owner.findFirst({
    where: { VISITORS_ACCOUNT_ID: visitorAccountId },
  });

  if (!owner) {
    throw new Error("Business owner not found");
  }

  return owner;
}

export async function userOwnsBusiness(businessId: number) {
  const owner = await requireBusinessOwner();
  const access = await prisma.business_owner_2_business.findFirst({
    where: {
      BUSINESS_OWNER_ID: BigInt(owner.BUSINESS_OWNER_ID),
      BUSINESS_ID: BigInt(businessId),
    },
  });

  return Boolean(access);
}

export async function requireBusinessAccess(businessId: number) {
  const hasAccess = await userOwnsBusiness(businessId);

  if (!hasAccess) {
    throw new Error("Forbidden");
  }
}

export async function getOwnedBusinesses(): Promise<AdminBusinessCard[]> {
  const owner = await requireBusinessOwner();
  const links = await prisma.business_owner_2_business.findMany({
    where: { BUSINESS_OWNER_ID: BigInt(owner.BUSINESS_OWNER_ID) },
    orderBy: { BUSINESS_OWNER_2_BUSINESS_ID: "desc" },
  });
  const businessIds = links
    .map((link) => (link.BUSINESS_ID === null ? null : Number(link.BUSINESS_ID)))
    .filter((id): id is number => id !== null);

  if (!businessIds.length) return [];

  const businesses = await prisma.business.findMany({
    where: { BUSINESS_ID: { in: businessIds } },
  });

  return businessIds.map((businessId) => {
    const business = businesses.find((item) => item.BUSINESS_ID === businessId);

    return {
      id: businessId,
      name: business?.BUSINESS_NAME || `Business #${businessId}`,
      shortName: business?.SHORT_NAME || null,
      logo: business?.LOGO || null,
      imageUrl: business?.IMAGE_URL || null,
      town: business?.ADDRESS_TOWN || null,
      status: business?.STATUS === 1 ? "active" : "inactive",
    };
  });
}

export async function getBusinessDashboardData(businessId: number) {
  await requireBusinessAccess(businessId);

  const [recentOrders, totalOrders, revenue, pendingOrders, activeProducts] = await Promise.all([
    prisma.business_order.findMany({
      where: { BUSINESS_ID: businessId },
      orderBy: { CREATION_DATETIME: "desc" },
      take: 10,
    }),
    prisma.business_order.count({ where: { BUSINESS_ID: businessId } }),
    prisma.business_order.aggregate({
      where: {
        BUSINESS_ID: businessId,
        AND: [
          { OR: [{ ORDER_STATUS: null }, { ORDER_STATUS: { not: STATUS_CODE_BY_NAME.rejected } }] },
          { OR: [{ PAYMENT_DONE: null }, { PAYMENT_DONE: { notIn: [PAYMENT_DONE.REFUNDED, PAYMENT_DONE.FAILED] } }] },
        ],
        STRIPE_REFUND_STATUS: null,
      },
      _sum: { ORDER_FINAL_AMOUNT: true },
    }),
    prisma.business_order.count({
      where: {
        BUSINESS_ID: businessId,
        OR: [
          { ORDER_STATUS: null },
          {
            ORDER_STATUS: {
              notIn: [
                STATUS_CODE_BY_NAME.delivered,
                STATUS_CODE_BY_NAME.picked_up,
                STATUS_CODE_BY_NAME.rejected,
              ],
            },
          },
        ],
      },
    }),
    prisma.business_product.count({ where: { BUSINESS_ID: businessId, STATUS: 1 } }),
  ]);

  const recentOrderIds = recentOrders.map((order) => order.BUSINESS_ORDER_ID);
  const orderDetails = recentOrderIds.length
    ? await prisma.business_order_detail.findMany({
        where: { BUSINESS_ORDER_ID: { in: recentOrderIds } },
      })
    : [];

  const kpis: DashboardKpis = {
    totalOrders,
    totalRevenue: toNumber(revenue._sum.ORDER_FINAL_AMOUNT),
    pendingOrders,
    activeProducts,
  };

  return {
    kpis,
    recentOrders: recentOrders.map<RecentOrderRow>((order) => ({
      id: order.BUSINESS_ORDER_ID,
      orderNumber: getDisplayOrderNumber(order),
      customer: formatCustomer(order.FIRST_NAME, order.LAST_NAME),
      items: orderDetails
        .filter((detail) => detail.BUSINESS_ORDER_ID === order.BUSINESS_ORDER_ID)
        .reduce((total, detail) => total + (detail.ORDER_QUANTITY || 0), 0),
      total: toNumber(order.ORDER_FINAL_AMOUNT),
      status: normalizeOrderStatus(order.ORDER_STATUS),
      createdAt: order.CREATION_DATETIME?.toISOString() || null,
    })),
  };
}

export async function getProductsAdminData(businessId: number) {
  await requireBusinessAccess(businessId);

  const [products, categories, productTags, categoryTags] = await Promise.all([
    prisma.business_product.findMany({
      where: {
        BUSINESS_ID: businessId,
        STATUS: { not: -1 },
      },
      orderBy: { BUSINESS_PRODUCT_ID: "desc" },
    }),
    prisma.business_product_category.findMany({
      where: {
        BUSINESS_ID: businessId,
        STATUS: { not: -1 },
      },
      orderBy: { TITLE: "asc" },
    }),
    prisma.business_product_2_tag.findMany(),
    prisma.business_product_category_2_tag.findMany(),
  ]);

  const categoryOptions = categories.map<ProductCategoryOption>((category) => ({
    id: category.BUSINESS_PRODUCT_CATEGORY_ID,
    title: category.TITLE || `Category #${category.BUSINESS_PRODUCT_CATEGORY_ID}`,
  }));

  const rows = products.map<AdminProductRow>((product) => {
    const tagIds = productTags
      .filter((tag) => tag.BUSINESS_PRODUCT_ID === product.BUSINESS_PRODUCT_ID)
      .map((tag) => tag.BUSINESS_PRODUCT_TAG_ID)
      .filter((tagId): tagId is number => tagId !== null);
    const matchedCategory = categories.find((category) => {
      const tagsForCategory = categoryTags
        .filter(
          (tag) =>
            tag.BUSINESS_PRODUCT_CATEGORY_ID ===
            category.BUSINESS_PRODUCT_CATEGORY_ID
        )
        .map((tag) => tag.BUSINESS_PRODUCT_TAG_ID);

      return tagIds.some((tagId) => tagsForCategory.includes(tagId));
    });

    return {
      id: product.BUSINESS_PRODUCT_ID,
      name: product.TITLE,
      description: product.DESCRIPTION,
      categoryId: matchedCategory?.BUSINESS_PRODUCT_CATEGORY_ID || null,
      categoryName: matchedCategory?.TITLE || "Uncategorized",
      price: toNumber(product.PRODUCT_PRICE),
      costPrice: toNumber(product.COST_PRICE),
      compareAtPrice: toNumber(product.COMPARE_AS_PRICE),
      trackInventory: product.TRACK_INVENTORY === 1,
      inventoryOnHand: product.INVENTORY_ON_HAND ?? 0,
      inventoryAvailable: product.INVENTORY_AVAILABLE ?? 0,
      inventoryCommitted: product.INVENTORY_COMMITED ?? 0,
      stock: product.INVENTORY_AVAILABLE ?? product.INVENTORY_ON_HAND ?? 0,
      weight: product.WEIGHT ?? 0,
      weightUnit: product.WEIGHT_UNIT || "gm",
      status: product.STATUS === 1 ? "active" : "inactive",
      imageUrl: product.PIC,
      tagIds,
    };
  });

  return {
    products: rows,
    categories: categoryOptions,
  };
}

export async function saveProduct(values: ProductFormValues) {
  await requireBusinessAccess(values.businessId);

  if (!values.title.trim() || !values.product_price.trim()) {
    throw new Error("Product name and price are required.");
  }

  const price = parseMoney(values.product_price, "Product price", true);
  const costPrice = parseMoney(values.cost_price, "Cost price");
  const compareAtPrice = parseMoney(values.compare_as_price, "Compare-at price");
  if (Number(compareAtPrice) > 0 && Number(compareAtPrice) <= Number(price)) {
    throw new Error("Compare-at price should be greater than product price.");
  }

  const trackInventory = values.track_inventory === true;
  const committed = trackInventory
    ? parseWholeNumber(values.inventory_commited, "Committed inventory")
    : 0;
  const onHand = trackInventory
    ? parseWholeNumber(values.inventory_on_hand, "Stock quantity")
    : 0;
  const available = trackInventory ? Math.max(onHand - committed, 0) : 0;
  const weight = parseWholeNumber(values.weight, "Weight");

  const explicitTagIds = Array.from(new Set(values.tag_ids));
  const categoryTagIds =
    values.categoryId && Number.isInteger(values.categoryId)
      ? (
          await prisma.business_product_category_2_tag.findMany({
            where: { BUSINESS_PRODUCT_CATEGORY_ID: values.categoryId },
          })
        )
          .map((tag) => tag.BUSINESS_PRODUCT_TAG_ID)
          .filter((tagId): tagId is number => tagId !== null)
      : [];
  const tagIds = Array.from(new Set([...explicitTagIds, ...categoryTagIds]));

  if (values.categoryId) {
    const category = await prisma.business_product_category.findFirst({
      where: {
        BUSINESS_PRODUCT_CATEGORY_ID: values.categoryId,
        BUSINESS_ID: values.businessId,
        STATUS: { not: -1 },
      },
    });

    if (!category) {
      throw new Error("Category not found.");
    }
  }

  if (tagIds.length) {
    const ownedTags = await prisma.business_product_tag.count({
      where: {
        BUSINESS_ID: values.businessId,
        BUSINESS_PRODUCT_TAG_ID: { in: tagIds },
        STATUS: { not: -1 },
      },
    });

    if (ownedTags !== tagIds.length) {
      throw new Error("One or more tags are invalid.");
    }
  }

  const productData = {
    BUSINESS_ID: values.businessId,
    TITLE: values.title.trim(),
    DESCRIPTION: values.description.trim(),
    PRODUCT_PRICE: price,
    COST_PRICE: costPrice,
    COMPARE_AS_PRICE: compareAtPrice,
    TRACK_INVENTORY: trackInventory ? 1 : 0,
    INVENTORY_ON_HAND: onHand,
    INVENTORY_AVAILABLE: available,
    INVENTORY_COMMITED: committed,
    WEIGHT: weight,
    WEIGHT_UNIT: normalizeWeightUnit(values.weight_unit),
    PIC: values.pic.trim() || null,
  };

  await prisma.$transaction(async (tx) => {
    if (values.id) {
      const existingProduct = await tx.business_product.findUnique({
        where: { BUSINESS_PRODUCT_ID: values.id },
      });

      if (!existingProduct || existingProduct.BUSINESS_ID !== values.businessId) {
        throw new Error("Product not found.");
      }

      await tx.business_product.update({
        where: { BUSINESS_PRODUCT_ID: values.id },
        data: productData,
      });

      await tx.business_product_2_tag.deleteMany({
        where: { BUSINESS_PRODUCT_ID: values.id },
      });

      if (existingProduct.PIC && values.pic && existingProduct.PIC !== values.pic) {
        await storage.delete(existingProduct.PIC).catch(console.error);
      }
    } else {
      const createdProduct = await tx.business_product.create({
        data: productData,
      });

      values.id = createdProduct.BUSINESS_PRODUCT_ID;
    }

    if (values.id && tagIds.length) {
      await tx.business_product_2_tag.createMany({
        data: tagIds.map((tagId) => ({
          BUSINESS_PRODUCT_ID: values.id,
          BUSINESS_PRODUCT_TAG_ID: tagId,
          CREATION_DATETIME: new Date(),
        })),
      });
    }
  });

  revalidatePath(`/dashboard/${values.businessId}/menu/products`);
  revalidatePath(`/dashboard/${values.businessId}`);
}

export async function toggleProductStatus(
  businessId: number,
  productId: number,
  nextStatus: "active" | "inactive"
) {
  await requireBusinessAccess(businessId);

  const product = await prisma.business_product.findFirst({
    where: {
      BUSINESS_PRODUCT_ID: productId,
      BUSINESS_ID: businessId,
      STATUS: { not: -1 },
    },
  });

  if (!product) {
    throw new Error("Product not found.");
  }

  await prisma.business_product.update({
    where: { BUSINESS_PRODUCT_ID: productId },
    data: { STATUS: nextStatus === "active" ? 1 : 0 },
  });

  revalidatePath(`/dashboard/${businessId}/menu/products`);
  revalidatePath(`/dashboard/${businessId}`);
}

export async function deleteProduct(businessId: number, productId: number) {
  await requireBusinessAccess(businessId);

  const product = await prisma.business_product.findFirst({
    where: {
      BUSINESS_PRODUCT_ID: productId,
      BUSINESS_ID: businessId,
      STATUS: { not: -1 },
    },
  });

  if (!product) {
    throw new Error("Product not found.");
  }

  await prisma.business_product.update({
    where: { BUSINESS_PRODUCT_ID: productId },
    data: { STATUS: -1 },
  });

  revalidatePath(`/dashboard/${businessId}/menu/products`);
  revalidatePath(`/dashboard/${businessId}`);
}
