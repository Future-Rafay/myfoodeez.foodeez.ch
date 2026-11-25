"use client";

import { useState } from "react";
import {
  MoreHorizontal,
  Pencil,
  Plus,
  Tag,
  Trash2,
} from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MenuTagRow } from "@/services/menu-management";

interface TagsTableProps {
  businessId: number;
  initialTags: MenuTagRow[];
}

export default function TagsTable({ businessId, initialTags }: TagsTableProps) {
  const [tags, setTags] = useState(initialTags);
  const [deleteTarget, setDeleteTarget] = useState<MenuTagRow | null>(null);
  const [editingTag, setEditingTag] = useState<MenuTagRow | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  function openAdd() {
    setEditingTag(null);
    setTitle("");
    setError("");
    setIsFormOpen(true);
  }

  function openEdit(tag: MenuTagRow) {
    setEditingTag(tag);
    setTitle(tag.title);
    setError("");
    setIsFormOpen(true);
  }

  async function reloadTags() {
    const res = await fetch(`/api/dashboard/${businessId}/tags`);
    if (!res.ok) throw new Error("Failed to reload tags.");
    const data = await res.json();
    setTags(data.tags);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const url = editingTag
        ? `/api/dashboard/${businessId}/tags/${editingTag.id}`
        : `/api/dashboard/${businessId}/tags`;
      const res = await fetch(url, {
        method: editingTag ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save tag.");
      }

      await reloadTags();
      setIsFormOpen(false);
      setEditingTag(null);
      setTitle("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save tag.");
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
        `/api/dashboard/${businessId}/tags/${deleteTarget.id}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete tag.");
      }

      setTags((current) => current.filter((tag) => tag.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete tag.");
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
              Tags
              <span className="ml-2 text-sm font-normal text-gray-500">
                {tags.length}
              </span>
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Manage labels shared by products and categories.
            </p>
          </div>
          <Button
            className="bg-foodeez-primary text-white hover:bg-foodeez-secondary"
            onClick={openAdd}
          >
            <Plus className="size-4" />
            Add Tag
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
              <TableHead>Status</TableHead>
              <TableHead>Products</TableHead>
              <TableHead>Categories</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tags.length ? (
              tags.map((tag) => (
                <TableRow key={tag.id}>
                  <TableCell className="font-medium text-gray-950">
                    {tag.title}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={tag.status} />
                  </TableCell>
                  <TableCell>{tag.productCount}</TableCell>
                  <TableCell>{tag.categoryCount}</TableCell>
                  <TableCell className="text-right">
                    <RowActions
                      onEdit={() => openEdit(tag)}
                      onDelete={() => setDeleteTarget(tag)}
                    />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5}>
                  <EmptyState onAdd={openAdd} />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 p-4 md:hidden">
        {tags.length ? (
          tags.map((tag) => (
            <Card key={tag.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-950">{tag.title}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                    <StatusBadge status={tag.status} />
                    <span>{tag.productCount} products</span>
                    <span>{tag.categoryCount} categories</span>
                  </div>
                </div>
                <RowActions
                  onEdit={() => openEdit(tag)}
                  onDelete={() => setDeleteTarget(tag)}
                />
              </div>
            </Card>
          ))
        ) : (
          <EmptyState onAdd={openAdd} />
        )}
      </div>

      <Dialog
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) setEditingTag(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTag ? "Edit tag" : "Add tag"}</DialogTitle>
            <DialogDescription>
              Tags can be assigned to categories and products.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="tag-title">Tag Name</Label>
              <Input
                id="tag-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Enter tag name"
                className="mt-2"
                maxLength={45}
                required
                disabled={saving}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsFormOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save tag"}
              </Button>
            </DialogFooter>
          </form>
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
            <DialogTitle>Delete tag</DialogTitle>
            <DialogDescription>
              This will archive the tag and remove it from associated products
              and categories.
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
              {deleting ? "Deleting..." : "Delete tag"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: MenuTagRow["status"] }) {
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
          <span className="sr-only">Open tag actions</span>
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
        <Tag className="size-8" />
      </div>
      <h3 className="text-lg font-semibold text-gray-950">No tags found</h3>
      <p className="mt-2 max-w-md text-sm text-gray-500">
        Add your first tag to organize products and category membership.
      </p>
      <Button
        onClick={onAdd}
        className="mt-5 bg-foodeez-primary text-white hover:bg-foodeez-secondary"
      >
        <Plus className="size-4" />
        Add Tag
      </Button>
    </div>
  );
}
