"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ImageIcon,
  MoreHorizontal,
  PackageOpen,
  Pencil,
  Plus,
  Power,
  Search,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import ProductForm from "@/components/products/ProductForm";
import {
  AdminProductRow,
  ProductCategoryOption,
  deleteProduct,
  saveProduct,
  toggleProductStatus,
} from "@/services/admin-data";
import { resolveMediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

type SortKey = "name" | "categoryName" | "price" | "stock" | "status";
type SortDirection = "asc" | "desc";

interface AdminProductsTableProps {
  businessId: number;
  products: AdminProductRow[];
  categories: ProductCategoryOption[];
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "CHF",
});

export default function AdminProductsTable({
  businessId,
  products: initialProducts,
  categories,
}: AdminProductsTableProps) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [isPending, startTransition] = useTransition();
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [selectedProduct, setSelectedProduct] =
    useState<AdminProductRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminProductRow | null>(null);
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return products
      .filter((product) => {
        const matchesSearch =
          !normalizedSearch ||
          product.name.toLowerCase().includes(normalizedSearch) ||
          product.categoryName.toLowerCase().includes(normalizedSearch);
        const matchesCategory =
          categoryFilter === "all" ||
          product.categoryId?.toString() === categoryFilter;

        return matchesSearch && matchesCategory;
      })
      .sort((first, second) => {
        const firstValue = first[sortKey];
        const secondValue = second[sortKey];
        const direction = sortDirection === "asc" ? 1 : -1;

        if (typeof firstValue === "number" && typeof secondValue === "number") {
          return (firstValue - secondValue) * direction;
        }

        return String(firstValue).localeCompare(String(secondValue)) * direction;
      });
  }, [categoryFilter, products, search, sortDirection, sortKey]);
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const paginatedProducts = filteredProducts.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  useEffect(() => {
    setPage(1);
  }, [categoryFilter, search]);

  function handleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection("asc");
  }

  function refreshProducts() {
    startTransition(() => {
      router.refresh();
    });
  }

  async function handleSubmit(values: {
    title: string;
    description: string;
    product_price: string;
    cost_price: string;
    compare_as_price: string;
    track_inventory: boolean;
    inventory_on_hand: string;
    inventory_commited: string;
    weight: string;
    weight_unit: string;
    pic: string;
    tag_ids: number[];
    categoryId: number | null;
  }) {
    setFormError("");

    try {
      await saveProduct({
        ...values,
        businessId,
        id: selectedProduct?.id,
      });
      setFormMode(null);
      setSelectedProduct(null);
      refreshProducts();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Failed to save product."
      );
    }
  }

  async function handleToggle(product: AdminProductRow) {
    setActionError("");
    const nextStatus = product.status === "active" ? "inactive" : "active";
    setProducts((current) =>
      current.map((item) =>
        item.id === product.id ? { ...item, status: nextStatus } : item
      )
    );

    try {
      await toggleProductStatus(businessId, product.id, nextStatus);
      refreshProducts();
    } catch (error) {
      setProducts((current) =>
        current.map((item) =>
          item.id === product.id ? { ...item, status: product.status } : item
        )
      );
      setActionError(
        error instanceof Error ? error.message : "Failed to update product."
      );
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;

    setActionError("");
    const previousProducts = products;
    setProducts((current) =>
      current.filter((product) => product.id !== deleteTarget.id)
    );

    try {
      await deleteProduct(businessId, deleteTarget.id);
      setDeleteTarget(null);
      refreshProducts();
    } catch (error) {
      setProducts(previousProducts);
      setActionError(
        error instanceof Error ? error.message : "Failed to delete product."
      );
    }
  }

  function openAddModal() {
    setSelectedProduct(null);
    setFormError("");
    setFormMode("add");
  }

  function openEditModal(product: AdminProductRow) {
    setSelectedProduct(product);
    setFormError("");
    setFormMode("edit");
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-950">Products</h2>
              <p className="mt-1 text-sm text-gray-500">
                Search, sort, and manage this restaurant&apos;s catalog.
              </p>
            </div>
            <Button
              onClick={openAddModal}
              className="bg-foodeez-primary text-white hover:bg-foodeez-secondary"
            >
              <Plus className="size-4" />
              Add Product
            </Button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-[1fr_220px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search products"
                className="h-10 bg-white pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-10 w-full bg-white">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id.toString()}>
                    {category.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {actionError && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {actionError}
            </p>
          )}
        </div>

        {filteredProducts.length ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 hover:bg-gray-50">
                  <SortableHead
                    label="Product"
                    sortKey="name"
                    activeKey={sortKey}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableHead
                    label="Category"
                    sortKey="categoryName"
                    activeKey={sortKey}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableHead
                    label="Price"
                    sortKey="price"
                    activeKey={sortKey}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableHead
                    label="Stock"
                    sortKey="stock"
                    activeKey={sortKey}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableHead
                    label="Status"
                    sortKey="status"
                    activeKey={sortKey}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedProducts.map((product) => (
                  <TableRow key={product.id} className="hover:bg-gray-50">
                    <TableCell className="min-w-[220px]">
                      <div className="flex items-center gap-3">
                        <ProductThumbnail product={product} />
                        <div className="min-w-0">
                          <p className="font-medium text-gray-950">
                            {product.name}
                          </p>
                          {product.description && (
                            <p className="mt-1 max-w-xs truncate text-sm text-gray-500">
                              {product.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{product.categoryName}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium text-gray-950">
                          {currencyFormatter.format(product.price)}
                        </p>
                        {product.compareAtPrice > 0 && (
                          <p className="text-sm text-gray-400 line-through">
                            {currencyFormatter.format(product.compareAtPrice)}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StockStatus product={product} />
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          product.status === "active"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-gray-200 bg-gray-50 text-gray-600"
                        }
                      >
                        {product.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="icon">
                            <MoreHorizontal className="size-4" />
                            <span className="sr-only">Open product actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => openEditModal(product)}>
                            <Pencil className="size-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggle(product)}>
                            <Power className="size-4" />
                            Mark{" "}
                            {product.status === "active"
                              ? "inactive"
                              : "active"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setDeleteTarget(product)}
                          >
                            <Trash2 className="size-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm text-gray-500">
              <span>
                Showing {(page - 1) * pageSize + 1}-
                {Math.min(page * pageSize, filteredProducts.length)} of{" "}
                {filteredProducts.length}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPage((current) => Math.min(totalPages, current + 1))
                  }
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-foodeez-primary/10 text-foodeez-primary">
              <PackageOpen className="size-8" />
            </div>
            <h3 className="text-lg font-semibold text-gray-950">
              No products found
            </h3>
            <p className="mt-2 max-w-md text-sm text-gray-500">
              Add your first product or adjust the search and category filter to
              find an existing item.
            </p>
            <Button
              onClick={openAddModal}
              className="mt-5 bg-foodeez-primary text-white hover:bg-foodeez-secondary"
            >
              <Plus className="size-4" />
              Add Product
            </Button>
          </div>
        )}
      </div>

      <Dialog
        open={formMode !== null}
        onOpenChange={(open) => {
          if (!open) {
            setFormMode(null);
            setSelectedProduct(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {formMode === "edit" ? "Edit product" : "Add product"}
            </DialogTitle>
            <DialogDescription>
              Product changes are saved to this restaurant&apos;s catalog.
            </DialogDescription>
          </DialogHeader>
          {formMode && (
            <ProductForm
              mode={formMode}
              initialValues={
                selectedProduct
                  ? {
                      title: selectedProduct.name,
                      description: selectedProduct.description || "",
                      product_price: selectedProduct.price,
                      cost_price: selectedProduct.costPrice,
                      compare_as_price: selectedProduct.compareAtPrice,
                      track_inventory: selectedProduct.trackInventory,
                      inventory_on_hand: selectedProduct.inventoryOnHand,
                      inventory_available: selectedProduct.inventoryAvailable,
                      inventory_commited: selectedProduct.inventoryCommitted,
                      weight: selectedProduct.weight,
                      weight_unit: selectedProduct.weightUnit,
                      pic: selectedProduct.imageUrl || "",
                      tag_ids: selectedProduct.tagIds,
                      categoryId: selectedProduct.categoryId,
                    }
                  : undefined
              }
              categoryOptions={categories}
              onSubmit={handleSubmit}
              loading={isPending}
              error={formError}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete product</DialogTitle>
            <DialogDescription>
              This will archive{" "}
              <span className="font-medium text-gray-950">
                {deleteTarget?.name}
              </span>{" "}
              and hide it from the catalog.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StockStatus({ product }: { product: AdminProductRow }) {
  if (!product.trackInventory) return <span className="text-gray-400">-</span>;

  return (
    <div className="space-y-0.5 text-xs text-gray-600">
      <p>
        <span className="font-medium text-gray-900">Available:</span>{" "}
        {product.inventoryAvailable}
      </p>
      <p>
        <span className="font-medium text-gray-900">On hand:</span>{" "}
        {product.inventoryOnHand}
      </p>
      <p>
        <span className="font-medium text-gray-900">Committed:</span>{" "}
        {product.inventoryCommitted}
      </p>
    </div>
  );
}

function ProductThumbnail({ product }: { product: AdminProductRow }) {
  const imageUrl = resolveMediaUrl(product.imageUrl);

  return (
    <Avatar className="size-12 rounded-full border border-gray-200 bg-gray-100">
      {imageUrl && (
        <AvatarImage
          src={imageUrl}
          alt={product.name}
          className="rounded-lg object-cover"
        />
      )}
      <AvatarFallback className="rounded-lg bg-gray-100 text-gray-400">
        <ImageIcon className="size-5" />
      </AvatarFallback>
    </Avatar>
  );
}

function SortableHead({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
}) {
  const isActive = activeKey === sortKey;

  return (
    <TableHead>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 font-medium text-gray-700 hover:text-gray-950",
          isActive && "text-gray-950"
        )}
      >
        {label}
        {isActive &&
          (direction === "asc" ? (
            <ArrowUp className="size-3.5" />
          ) : (
            <ArrowDown className="size-3.5" />
          ))}
      </button>
    </TableHead>
  );
}
