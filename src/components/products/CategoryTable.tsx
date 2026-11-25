"use client";

import { useState } from "react";
import {
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import CategoryForm from "@/components/products/CategoryForm";
import { resolveMediaUrl } from "@/lib/media";
import { MenuCategoryRow } from "@/services/menu-management";

interface CategoryTableProps {
  businessId: number;
  initialCategories: MenuCategoryRow[];
}

export default function CategoryTable({
  businessId,
  initialCategories,
}: CategoryTableProps) {
  const [categories, setCategories] = useState(initialCategories);
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [selectedCategory, setSelectedCategory] =
    useState<MenuCategoryRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MenuCategoryRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function reloadCategories() {
    const res = await fetch(`/api/dashboard/${businessId}/categories`);
    if (!res.ok) throw new Error("Failed to reload categories.");
    const data = await res.json();
    setCategories(data.categories);
  }

  function openAdd() {
    setSelectedCategory(null);
    setError("");
    setFormMode("add");
  }

  function openEdit(category: MenuCategoryRow) {
    setSelectedCategory(category);
    setError("");
    setFormMode("edit");
  }

  async function handleSubmit(values: {
    title: string;
    description: string;
    pic: string;
    status: number;
    tag_ids: number[];
  }) {
    setSaving(true);
    setError("");

    try {
      const url = selectedCategory
        ? `/api/dashboard/${businessId}/categories/${selectedCategory.id}`
        : `/api/dashboard/${businessId}/categories`;
      const res = await fetch(url, {
        method: selectedCategory ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          status: values.status === 1 ? "active" : "inactive",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save category.");
      }

      await reloadCategories();
      setFormMode(null);
      setSelectedCategory(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save category."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;

    setDeleting(true);
    setError("");

    try {
      const res = await fetch(
        `/api/dashboard/${businessId}/categories/${deleteTarget.id}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete category.");
      }

      setCategories((current) =>
        current.filter((category) => category.id !== deleteTarget.id)
      );
      setDeleteTarget(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete category."
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-950">
              Categories
              <span className="ml-2 text-sm font-normal text-gray-500">
                {categories.length}
              </span>
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Organize product groups through category-tag assignments.
            </p>
          </div>
          <Button
            className="bg-foodeez-primary text-white hover:bg-foodeez-secondary"
            onClick={openAdd}
          >
            <Plus className="size-4" />
            Add Category
          </Button>
        </div>
        {error && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>

      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 hover:bg-gray-50">
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Products</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.length ? (
              categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="min-w-[220px]">
                    <div className="flex items-center gap-3">
                      <CategoryAvatar category={category} />
                      <span className="font-medium text-gray-950">
                        {category.title}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-gray-600">
                    {category.description || "-"}
                  </TableCell>
                  <TableCell>
                    <TagBadges category={category} />
                  </TableCell>
                  <TableCell>{category.productCount}</TableCell>
                  <TableCell>
                    <StatusBadge status={category.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <RowActions
                      onEdit={() => openEdit(category)}
                      onDelete={() => setDeleteTarget(category)}
                    />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6}>
                  <EmptyState onAdd={openAdd} />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 p-4 md:hidden">
        {categories.length ? (
          categories.map((category) => (
            <Card key={category.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 gap-3">
                  <CategoryAvatar category={category} />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-950">
                      {category.title}
                    </p>
                    {category.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-gray-500">
                        {category.description}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <StatusBadge status={category.status} />
                      <Badge variant="outline">
                        {category.productCount} products
                      </Badge>
                    </div>
                  </div>
                </div>
                <RowActions
                  onEdit={() => openEdit(category)}
                  onDelete={() => setDeleteTarget(category)}
                />
              </div>
              <div className="mt-3">
                <TagBadges category={category} />
              </div>
            </Card>
          ))
        ) : (
          <EmptyState onAdd={openAdd} />
        )}
      </div>

      <Dialog
        open={formMode !== null}
        onOpenChange={(open) => {
          if (!open) {
            setFormMode(null);
            setSelectedCategory(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {formMode === "edit" ? "Edit category" : "Add category"}
            </DialogTitle>
            <DialogDescription>
              Category membership is defined by assigned tags.
            </DialogDescription>
          </DialogHeader>
          {formMode && (
            <CategoryForm
              mode={formMode}
              initialValues={
                selectedCategory
                  ? {
                      title: selectedCategory.title,
                      description: selectedCategory.description || "",
                      pic: selectedCategory.pic || "",
                      status: selectedCategory.status === "active" ? 1 : 0,
                      tag_ids: selectedCategory.tagIds,
                    }
                  : undefined
              }
              onSubmit={handleSubmit}
              loading={saving}
              error={error}
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
            <DialogTitle>Delete category</DialogTitle>
            <DialogDescription>
              This will archive the category and remove its tag assignments.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CategoryAvatar({ category }: { category: MenuCategoryRow }) {
  const imageUrl = resolveMediaUrl(category.pic);

  return (
    <Avatar className="size-11 border border-gray-100">
      {imageUrl && (
        <AvatarImage
          src={imageUrl}
          alt={category.title}
          className="object-cover"
        />
      )}
      <AvatarFallback className="bg-gray-100 text-gray-600">
        {category.title[0]?.toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}

function StatusBadge({ status }: { status: MenuCategoryRow["status"] }) {
  return (
    <Badge
      variant="outline"
      className={
        status === "active"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-gray-200 bg-gray-50 text-gray-600"
      }
    >
      {status}
    </Badge>
  );
}

function TagBadges({ category }: { category: MenuCategoryRow }) {
  if (!category.tags.length) {
    return <span className="text-sm text-gray-400">No tags</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {category.tags.slice(0, 3).map((tag) => (
        <Badge key={tag.id} variant="outline" className="text-xs">
          {tag.title}
        </Badge>
      ))}
      {category.tags.length > 3 && (
        <Badge variant="outline" className="text-xs">
          +{category.tags.length - 3}
        </Badge>
      )}
    </div>
  );
}

function RowActions({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <MoreHorizontal className="size-4" />
          <span className="sr-only">Open category actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="size-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 className="size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-foodeez-primary/10 text-foodeez-primary">
        <FolderOpen className="size-8" />
      </div>
      <h3 className="text-lg font-semibold text-gray-950">
        No categories found
      </h3>
      <p className="mt-2 max-w-md text-sm text-gray-500">
        Add a category and assign tags to group matching products.
      </p>
      <Button
        onClick={onAdd}
        className="mt-5 bg-foodeez-primary text-white hover:bg-foodeez-secondary"
      >
        <Plus className="size-4" />
        Add Category
      </Button>
    </div>
  );
}
