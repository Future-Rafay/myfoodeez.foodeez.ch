"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import ProductForm from "@/components/products/ProductForm";
import { useBusinessId } from "@/components/providers/BusinessProvider";

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const businessId = useBusinessId();
  const productId = params?.productId as string;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [product, setProduct] = useState<any>(null);

  useEffect(() => {
    if (!businessId || !productId) return;
    setLoading(true);
    fetch(`/api/dashboard/${businessId}/products?pageSize=100`)
      .then((res) => res.json())
      .then((data) => {
        const found = data.products.find(
          (p: any) => String(p.id) === String(productId)
        );
        setProduct(found);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load product");
        setLoading(false);
      });
  }, [businessId, productId]);

  async function handleEdit(values: {
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
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/dashboard/${businessId}/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: values.title,
          description: values.description,
          product_price: values.product_price,
          cost_price: values.cost_price,
          compare_as_price: values.compare_as_price,
          track_inventory: values.track_inventory,
          inventory_on_hand: values.inventory_on_hand,
          inventory_commited: values.inventory_commited,
          weight: values.weight,
          weight_unit: values.weight_unit,
          pic: values.pic,
          tag_ids: values.tag_ids,
          categoryId: values.categoryId,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update product");
      }
      router.push(`/dashboard/${businessId}/menu/products`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update product");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-gray-400">Loading product...</div>
    );
  }
  if (!product) {
    return (
      <div className="py-12 text-center text-red-500">Product not found.</div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Product</h1>
        </div>
      </div>
      <ProductForm
        mode="edit"
        initialValues={{
          title: product.title,
          description: product.description,
          product_price: product.productPrice,
          cost_price: product.costPrice,
          compare_as_price: product.compareAtPrice,
          track_inventory: product.trackInventory,
          inventory_on_hand: product.inventoryOnHand,
          inventory_available: product.inventoryAvailable,
          inventory_commited: product.inventoryCommitted,
          weight: product.weight,
          weight_unit: product.weightUnit,
          pic: product.pic,
          tag_ids: product.tagIds || [],
          categoryId: product.categoryId,
        }}
        onSubmit={handleEdit}
        loading={saving}
        error={error}
      />
    </div>
  );
}
