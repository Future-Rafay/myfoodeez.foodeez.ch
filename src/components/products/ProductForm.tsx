"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ImageUploadField from "@/components/ui/ImageUploadField";
import { uploadImagesToS3 } from "@/lib/media-upload";
import TagSelect from "./TagSelect";
import { ProductCategoryOption } from "@/services/admin-data";

interface ProductFormProps {
  mode: "add" | "edit";
  initialValues?: {
    title?: string;
    description?: string;
    product_price?: string | number;
    cost_price?: string | number;
    compare_as_price?: string | number;
    track_inventory?: boolean;
    inventory_on_hand?: string | number;
    inventory_available?: string | number;
    inventory_commited?: string | number;
    weight?: string | number;
    weight_unit?: string;
    pic?: string;
    tag_ids?: number[];
    categoryId?: number | null;
  };
  onSubmit: (values: {
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
  }) => Promise<void>;
  loading?: boolean;
  error?: string;
  categoryOptions?: ProductCategoryOption[];
}

export default function ProductForm({
  mode,
  initialValues,
  onSubmit,
  loading,
  error,
  categoryOptions = [],
}: ProductFormProps) {
  const [form, setForm] = useState({
    title: initialValues?.title || "",
    description: initialValues?.description || "",
    product_price: initialValues?.product_price?.toString() || "",
    cost_price: initialValues?.cost_price?.toString() || "",
    compare_as_price: initialValues?.compare_as_price?.toString() || "",
    track_inventory: initialValues?.track_inventory || false,
    inventory_on_hand: initialValues?.inventory_on_hand?.toString() || "0",
    inventory_available: initialValues?.inventory_available?.toString() || "0",
    inventory_commited: initialValues?.inventory_commited?.toString() || "0",
    weight: initialValues?.weight?.toString() || "0",
    weight_unit: initialValues?.weight_unit || "gm",
    pic: initialValues?.pic || "",
    tag_ids: initialValues?.tag_ids || [],
    categoryId: initialValues?.categoryId?.toString() || "none",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function validate() {
    if (!form.title.trim()) return "Title is required.";
    const price = Number(form.product_price);
    const costPrice = Number(form.cost_price || 0);
    const compareAtPrice = Number(form.compare_as_price || 0);
    const stockQuantity = Number(form.inventory_on_hand || 0);
    const weight = Number(form.weight || 0);

    if (!form.product_price.trim() || !Number.isFinite(price) || price < 0)
      return "Valid product price is required.";
    if (!Number.isFinite(costPrice) || costPrice < 0)
      return "Cost price must be 0 or more.";
    if (!Number.isFinite(compareAtPrice) || compareAtPrice < 0)
      return "Compare-at price must be 0 or more.";
    if (compareAtPrice > 0 && compareAtPrice <= price)
      return "Compare-at price should be greater than product price.";
    if (
      form.track_inventory &&
      (!Number.isInteger(stockQuantity) || stockQuantity < 0)
    )
      return "Stock quantity must be a whole number 0 or more.";
    if (!Number.isInteger(weight) || weight < 0)
      return "Weight must be a whole number 0 or more.";
    if (form.title.length > 100) return "Title must be at most 100 characters.";
    if (form.description.length > 1000)
      return "Description must be at most 1000 characters.";
    if (form.pic.length > 255) return "Image URL must be at most 255 characters.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) {
      setFormError(err);
      return;
    }
    setFormError(null);

    let picUrl = form.pic.trim();

    if (imageFile) {
      setUploadingImage(true);
      try {
        const urls = await uploadImagesToS3([imageFile]);
        if (!urls.length) {
          setFormError("Failed to upload image to S3.");
          return;
        }
        picUrl = urls[0];
      } catch {
        setFormError("Failed to upload image. Please try again.");
        return;
      } finally {
        setUploadingImage(false);
      }
    }

    await onSubmit({
      title: form.title.trim(),
      description: form.description.trim(),
      product_price: form.product_price.trim(),
      cost_price: form.cost_price.trim(),
      compare_as_price: form.compare_as_price.trim(),
      track_inventory: form.track_inventory,
      inventory_on_hand: form.track_inventory ? form.inventory_on_hand.trim() : "0",
      inventory_commited: form.track_inventory
        ? form.inventory_commited.trim()
        : "0",
      weight: form.weight.trim() || "0",
      weight_unit: form.weight_unit,
      pic: picUrl,
      tag_ids: form.tag_ids,
      categoryId: form.categoryId === "none" ? null : Number(form.categoryId),
    });
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  const isBusy = loading || uploadingImage;
  const availableStock = Math.max(
    Number(form.inventory_on_hand || 0) - Number(form.inventory_commited || 0),
    0
  );

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
      {formError && (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Product Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label htmlFor="title">Product Name</Label>
            <Input
              id="title"
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="Enter product name"
              maxLength={100}
              required
              disabled={isBusy}
              className="text-lg py-3 px-4 mt-1"
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Enter product description"
              maxLength={1000}
              rows={5}
              disabled={isBusy}
              className="text-base py-3 px-4 mt-1"
            />
          </div>

          {categoryOptions.length > 0 && (
            <div>
              <Label htmlFor="category">Category</Label>
              <Select
                value={form.categoryId}
                onValueChange={(value) =>
                  setForm((f) => ({ ...f, categoryId: value }))
                }
                disabled={isBusy}
              >
                <SelectTrigger id="category" className="mt-1 h-11 w-full">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No category</SelectItem>
                  {categoryOptions.map((category) => (
                    <SelectItem key={category.id} value={category.id.toString()}>
                      {category.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-2 text-xs text-gray-500">
                Products inherit category membership through the category tags.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pricing</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-3">
          <div>
            <Label htmlFor="product_price">Selling price (CHF)</Label>
            <Input
              id="product_price"
              name="product_price"
              type="number"
              min="0"
              step="0.01"
              value={form.product_price}
              onChange={handleChange}
              placeholder="e.g. 16.50"
              required
              disabled={isBusy}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="cost_price">Cost price (CHF)</Label>
            <Input
              id="cost_price"
              name="cost_price"
              type="number"
              min="0"
              step="0.01"
              value={form.cost_price}
              onChange={handleChange}
              placeholder="0.00"
              disabled={isBusy}
              className="mt-1"
            />
            <p className="mt-2 text-xs text-gray-500">
              Cost price is only visible to your business.
            </p>
          </div>
          <div>
            <Label htmlFor="compare_as_price">Compare-at price (CHF)</Label>
            <Input
              id="compare_as_price"
              name="compare_as_price"
              type="number"
              min="0"
              step="0.01"
              value={form.compare_as_price}
              onChange={handleChange}
              placeholder="0.00"
              disabled={isBusy}
              className="mt-1"
            />
            <p className="mt-2 text-xs text-gray-500">
              Compare-at price appears as a strikethrough price on the customer
              menu.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Inventory</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-3 rounded-lg border border-gray-200 p-3">
            <Checkbox
              checked={form.track_inventory}
              onCheckedChange={(checked) =>
                setForm((f) => ({
                  ...f,
                  track_inventory: checked === true,
                  inventory_on_hand: checked === true ? f.inventory_on_hand : "0",
                }))
              }
              disabled={isBusy}
            />
            <span className="text-sm font-medium text-gray-900">
              Track inventory for this product
            </span>
          </label>

          {form.track_inventory && (
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label htmlFor="inventory_on_hand">Stock quantity</Label>
                <Input
                  id="inventory_on_hand"
                  name="inventory_on_hand"
                  type="number"
                  min="0"
                  step="1"
                  value={form.inventory_on_hand}
                  onChange={handleChange}
                  disabled={isBusy}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Available</Label>
                <Input value={availableStock} disabled className="mt-1" />
              </div>
              <div>
                <Label>Committed</Label>
                <Input
                  value={form.inventory_commited}
                  disabled
                  className="mt-1"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Weight</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-[1fr_160px]">
          <div>
            <Label htmlFor="weight">Weight</Label>
            <Input
              id="weight"
              name="weight"
              type="number"
              min="0"
              step="1"
              value={form.weight}
              onChange={handleChange}
              disabled={isBusy}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="weight_unit">Unit</Label>
            <Select
              value={form.weight_unit}
              onValueChange={(value) =>
                setForm((f) => ({ ...f, weight_unit: value }))
              }
              disabled={isBusy}
            >
              <SelectTrigger id="weight_unit" className="mt-1 h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gm">gm</SelectItem>
                <SelectItem value="kg">kg</SelectItem>
                <SelectItem value="ml">ml</SelectItem>
                <SelectItem value="l">l</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Product Image</CardTitle>
        </CardHeader>
        <CardContent>
          <ImageUploadField
            value={form.pic}
            onChange={(url) => setForm((f) => ({ ...f, pic: url }))}
            onFileSelect={setImageFile}
            imageFile={imageFile}
            previewUrl={imagePreview}
            onPreviewChange={setImagePreview}
            disabled={isBusy}
            uploading={uploadingImage}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tags</CardTitle>
        </CardHeader>
        <CardContent>
          <TagSelect
            selectedTags={form.tag_ids}
            onTagsChange={(tagIds) =>
              setForm((f) => ({ ...f, tag_ids: tagIds }))
            }
          />
        </CardContent>
      </Card>

      <Button
        type="submit"
        className="bg-foodeez-primary text-white hover:bg-foodeez-secondary text-lg py-3"
        disabled={isBusy}
      >
        {uploadingImage
          ? "Uploading image..."
          : loading
            ? mode === "add"
              ? "Adding..."
              : "Saving..."
            : mode === "add"
              ? "Add Product"
              : "Save Changes"}
      </Button>
    </form>
  );
}
