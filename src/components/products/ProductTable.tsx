"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell, TableCaption } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DeleteProductModal from "./DeleteProductModal";
import { business_product, business_product_tag } from "../../../prisma/generated/prisma/client";
import { useBusinessId } from "@/components/providers/BusinessProvider";
import TagFilter from "./TagFilter";
import { getBusinessProducts } from "@/services/HelperFunctions";
import { resolveMediaUrl } from "@/lib/media";

export type SerializedProduct = Omit<business_product, 'COST_PRICE' | 'PRODUCT_PRICE' | 'COMPARE_AS_PRICE'> & {
  COST_PRICE?: number | null;
  PRODUCT_PRICE: number;
  COMPARE_AS_PRICE?: number | null;
};

interface ProductWithCategory extends SerializedProduct {
  tags?: business_product_tag[];
}

export default function ProductTable() {
  const router = useRouter();
  const businessId = useBusinessId();

  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<ProductWithCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);

  useEffect(() => {
    if (!businessId) return;
    setLoading(true);
    const getProducts = async () => {
      const products = await getBusinessProducts(Number(businessId));
      setProducts(products);
      setFilteredProducts(products);
    }
    getProducts();
    setLoading(false);
  }, [businessId]);

  // Filter products when tags are selected
  useEffect(() => {
    if (selectedTags.length === 0) {
      setFilteredProducts(products);
    } else {
      setFilteredProducts(products.filter(product => {
        const productTags = product.tags?.map(tag => tag.BUSINESS_PRODUCT_TAG_ID) || [];
        return selectedTags.every(tagId => productTags.includes(tagId));
      }));
    }
  }, [selectedTags, products]);

  function handleAdd() {
    router.push(`/dashboard/${businessId}/menu/products/new`);
  }

  function handleEdit(id: number) {
    router.push(`/dashboard/${businessId}/menu/products/${id}/edit`);
  }

  function handleDelete(id: number) {
    setDeleteId(id);
  }

  function onDeleteConfirmed(id: number) {
    setProducts(p => p.filter(prod => prod.BUSINESS_PRODUCT_ID !== id));
    setDeleteId(null);
  }

  if (loading) {
    return <div className="text-center text-gray-400 py-8">Loading...</div>;
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="p-6 border-b border-gray-100">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Products</h2>
            <p className="text-sm text-gray-600 mt-1">
              Manage your product catalog and inventory
            </p>
          </div>
          <Button 
            className="bg-foodeez-primary text-white hover:bg-foodeez-secondary shadow-sm" 
            onClick={handleAdd}
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Product
          </Button>
        </div>

        <div className="mt-6">
          <TagFilter
            selectedTags={selectedTags}
            onTagsChange={setSelectedTags}
            className="pb-2"
          />
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block">
        <Table>
          <TableCaption className="text-sm text-gray-500">
            {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''} found
          </TableCaption>
          <TableHeader>
            <TableRow className="bg-gray-50 hover:bg-gray-50">
              <TableHead className="font-semibold text-gray-700">Name & Tags</TableHead>
              <TableHead className="font-semibold text-gray-700">Description</TableHead>
              <TableHead className="font-semibold text-gray-700">Price</TableHead>
              <TableHead className="font-semibold text-gray-700">Image</TableHead>
              <TableHead className="text-right font-semibold text-gray-700">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-gray-400 py-8">
                  No products found. Start by adding your first product!
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map(product => (
                <TableRow key={product.BUSINESS_PRODUCT_ID} className="hover:bg-gray-50 transition-colors">
                  <TableCell className="font-medium">
                    <div>
                      <div className="font-medium">{product.TITLE}</div>
                      {product.tags && product.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {product.tags.slice(0, 2).map((tag, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {tag.TITLE}
                            </Badge>  
                          ))}
                          {product.tags.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{product.tags.length - 2}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <div className="truncate">{product.DESCRIPTION}</div>
                  </TableCell>
                  <TableCell>CHF {product.PRODUCT_PRICE.toString()}</TableCell>
                  <TableCell>
                    {resolveMediaUrl(product.PIC) ? (
                      <div className="relative">
                        <Avatar className="w-12 h-12 border-2 border-gray-100 shadow-sm">
                          <AvatarImage 
                            src={resolveMediaUrl(product.PIC)!} 
                            alt={product.TITLE}
                            className="object-cover"
                          />
                          <AvatarFallback className="bg-gray-100 text-gray-600 font-medium">
                            {product.TITLE?.[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    ) : (
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center border-2 border-gray-200">
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleEdit(product.BUSINESS_PRODUCT_ID)}
                        className="border-gray-200 hover:bg-gray-50"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive" 
                        onClick={() => handleDelete(product.BUSINESS_PRODUCT_ID)}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {filteredProducts.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            No products found. Start by adding your first product!
          </div>
        ) : (
          filteredProducts.map(product => (
            <Card key={product.BUSINESS_PRODUCT_ID} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg truncate">{product.TITLE}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-lg font-semibold text-foodeez-primary">
                        CHF {product.PRODUCT_PRICE.toString()}
                      </span>
                    </div>
                  </div>
                  {resolveMediaUrl(product.PIC) ? (
                    <Avatar className="w-16 h-16 ml-3 flex-shrink-0 border-2 border-gray-100 shadow-sm">
                      <AvatarImage 
                        src={resolveMediaUrl(product.PIC)!} 
                        alt={product.TITLE}
                        className="object-cover"
                      />
                      <AvatarFallback className="bg-gray-100 text-gray-600 font-medium">
                        {product.TITLE?.[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className="w-16 h-16 ml-3 flex-shrink-0 bg-gray-100 rounded-full flex items-center justify-center border-2 border-gray-200">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {product.DESCRIPTION && (
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {product.DESCRIPTION}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(product.BUSINESS_PRODUCT_ID)}
                    className="flex-1"
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(product.BUSINESS_PRODUCT_ID)}
                    className="flex-1"
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {deleteId && (
        <DeleteProductModal
          productId={deleteId}
          onClose={() => setDeleteId(null)}
          onDeleted={onDeleteConfirmed}
        />
      )}
    </div>
  );
} 
