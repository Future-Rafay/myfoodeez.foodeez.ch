"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Expand, Minus, Plus, Printer, ReceiptText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { localDateInputValue, localDayIsoRange } from "@/lib/pos-date-range";
import { resolveMediaUrl } from "@/lib/media";
import type { PosCatalog, PosReceipt } from "@/services/pos-management";

type Product = PosCatalog["menus"][number]["categories"][number]["products"][number];
type CartLine = {
  key: string;
  kind: "product" | "custom";
  productId?: number;
  name: string;
  price: number;
  quantity: number;
};

const pageSize = 24;
const money = new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" });

export default function PosWorkspace({
  businessId,
  initialCatalog,
}: {
  businessId: number;
  initialCatalog: PosCatalog;
}) {
  const [catalog, setCatalog] = useState(initialCatalog);
  const [menuId, setMenuId] = useState(initialCatalog.menus[0]?.id ?? 0);
  const [categoryId, setCategoryId] = useState(initialCatalog.menus[0]?.categories[0]?.categoryId ?? 0);
  const [page, setPage] = useState(1);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [customOpen, setCustomOpen] = useState(false);
  const [cardConfirmOpen, setCardConfirmOpen] = useState(false);
  const [customPrice, setCustomPrice] = useState("");
  const [receipt, setReceipt] = useState<PosReceipt | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryDate, setSummaryDate] = useState(localDateInputValue);
  const [orders, setOrders] = useState<PosReceipt[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const workspaceRef = useRef<HTMLDivElement>(null);

  const selectedMenu = catalog.menus.find((menu) => menu.id === menuId);
  const selectedCategory =
    selectedMenu?.categories.find((category) => category.categoryId === categoryId) ??
    selectedMenu?.categories[0];
  const products = selectedCategory?.products ?? [];
  const pageCount = Math.max(1, Math.ceil(products.length / pageSize));
  const visibleProducts = products.slice((page - 1) * pageSize, page * pageSize);
  const total = cart.reduce((sum, line) => sum + line.price * line.quantity, 0);

  useEffect(() => {
    setCategoryId((current) =>
      selectedMenu?.categories.some((category) => category.categoryId === current)
        ? current
        : selectedMenu?.categories[0]?.categoryId ?? 0
    );
    setPage(1);
  }, [menuId, selectedMenu]);
  useEffect(() => setPage(1), [categoryId]);
  useEffect(() => setRequestId(crypto.randomUUID()), [cart]);
  useEffect(() => {
    const update = () => setFullscreen(document.fullscreenElement === workspaceRef.current);
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);

  function addProduct(product: Product) {
    if (busy) return;
    setCart((current) => {
      const found = current.find((line) => line.productId === product.id);
      return found
        ? current.map((line) => line.key === found.key ? { ...line, quantity: line.quantity + 1 } : line)
        : [...current, {
            key: "product-" + product.id,
            kind: "product",
            productId: product.id,
            name: product.name,
            price: product.price,
            quantity: 1,
          }];
    });
  }

  function changeQuantity(key: string, delta: number) {
    if (busy) return;
    setCart((current) =>
      current
        .map((line) => line.key === key ? { ...line, quantity: line.quantity + delta } : line)
        .filter((line) => line.quantity > 0)
    );
  }

  function addCustomItem() {
    if (busy) return;
    const price = Number(customPrice);
    if (!Number.isFinite(price) || price <= 0) {
      setError("Enter a custom item price greater than CHF 0.");
      return;
    }
    setCart((current) => [...current, {
      key: "custom-" + crypto.randomUUID(),
      kind: "custom",
      name: "Custom item",
      price,
      quantity: 1,
    }]);
    setCustomPrice("");
    setCustomOpen(false);
    setError("");
  }

  async function refreshCatalog() {
    const response = await fetch("/api/dashboard/" + businessId + "/pos/catalog", { cache: "no-store" });
    if (response.ok) setCatalog((await response.json()) as PosCatalog);
  }

  async function completeSale(paymentMethod: "cash" | "card") {
    if (!cart.length || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/dashboard/" + businessId + "/pos/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          paymentMethod,
          items: cart.map((line) =>
            line.kind === "product"
              ? { kind: "product", productId: line.productId, quantity: line.quantity }
              : { kind: "custom", price: line.price, quantity: line.quantity }
          ),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Sale could not be completed.");
      setReceipt(data as PosReceipt);
      setCart([]);
      void refreshCatalog().catch(() => setError("Sale completed, but the POS menu could not refresh."));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sale could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  async function loadSummary() {
    setSummaryLoading(true);
    setError("");
    try {
      const query = new URLSearchParams(localDayIsoRange(summaryDate));
      const response = await fetch("/api/dashboard/" + businessId + "/pos/orders?" + query, { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Could not load POS orders.");
      setOrders(data as PosReceipt[]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load POS orders.");
    } finally {
      setSummaryLoading(false);
    }
  }

  async function enterFullscreen() {
    setError("");
    try {
      if (workspaceRef.current?.requestFullscreen) await workspaceRef.current.requestFullscreen();
      else setError("Fullscreen mode is not supported in this browser.");
    } catch {
      setError("Fullscreen mode could not be started. Sales remain available.");
    }
  }

  return (
    <div ref={workspaceRef} className="pos-workspace flex min-h-[580px] flex-col lg:h-[calc(100dvh-7.25rem)] lg:overflow-hidden">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-950">Web POS</h1>
          <p className="text-sm text-gray-500">Walk-in customer · prices in CHF{fullscreen && " · Press Esc to exit full screen"}</p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            onClick={() => { setSummaryOpen(true); void loadSummary(); }}
            className="min-h-11 gap-2"
          >
            <ReceiptText className="size-4" /> Orders
          </Button>
          {!fullscreen && <Button variant="outline" onClick={enterFullscreen} className="min-h-11 gap-2">
            <Expand className="size-4" /> Full Screen
          </Button>}
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="flex min-h-0 flex-col rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <div className="flex gap-2 overflow-x-auto border-b border-gray-100 pb-2" aria-label="Menus">
            {catalog.menus.map((menu) => (
              <button
                key={menu.id}
                aria-pressed={menu.id === menuId}
                onClick={() => setMenuId(menu.id)}
                className={"min-h-11 shrink-0 rounded-md px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foodeez-primary " +
                  (menu.id === menuId
                    ? "bg-foodeez-primary text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200")}
              >
                {menu.title}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2 overflow-x-auto" aria-label="Categories">
            {selectedMenu?.categories.map((category) => (
              <button
                key={category.categoryId}
                aria-pressed={category.categoryId === selectedCategory?.categoryId}
                onClick={() => setCategoryId(category.categoryId)}
                className={"min-h-10 shrink-0 border-b-2 px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foodeez-primary " +
                  (category.categoryId === selectedCategory?.categoryId
                    ? "border-foodeez-primary text-foodeez-primary"
                    : "border-transparent text-gray-600 hover:text-gray-950")}
              >
                {category.categoryTitle}
              </button>
            ))}
          </div>

          {visibleProducts.length ? (
            <div className="mt-3 grid min-h-0 flex-1 content-start grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {visibleProducts.map((product) => (
                <PosProductTile key={product.id} product={product} busy={busy} onClick={() => addProduct(product)} />
              ))}
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center text-center text-sm text-gray-500">
              {catalog.menus.length
                ? "No products in this category. Choose another category or add products to the menu."
                : "No active POS menus. Set a menu card channel to POS or Both."}
            </div>
          )}
          <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2">
            <Button variant="outline" onClick={() => setCustomOpen(true)} disabled={busy} className="min-h-11 gap-2">
              <Plus className="size-4" /> Custom item
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} aria-label="Previous product page" className="size-11">
                <ChevronLeft className="size-4" />
              </Button>
              <span className="min-w-16 text-center text-sm">Page {page} / {pageCount}</span>
              <Button variant="outline" size="icon" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page === pageCount} aria-label="Next product page" className="size-11">
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </section>

        <aside className="flex min-h-0 flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="border-b border-gray-100 pb-3">
            <h2 className="text-lg font-semibold text-gray-950">Current sale</h2>
            <p className="text-sm text-gray-500">Walk-in · Pickup</p>
          </div>
          <div className="min-h-0 flex-1 divide-y divide-gray-100 overflow-y-auto">
            {cart.length ? cart.map((line) => (
              <div key={line.key} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">{line.name}</p>
                    <p className="text-xs text-gray-500">{money.format(line.price)} each</p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold">{money.format(line.price * line.quantity)}</p>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                     <Button variant="outline" size="icon" className="size-10" disabled={busy} onClick={() => changeQuantity(line.key, -1)} aria-label={"Decrease " + line.name}>
                      <Minus className="size-4" />
                    </Button>
                    <span className="min-w-7 text-center text-sm font-medium">{line.quantity}</span>
                     <Button variant="outline" size="icon" className="size-10" disabled={busy} onClick={() => changeQuantity(line.key, 1)} aria-label={"Increase " + line.name}>
                      <Plus className="size-4" />
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                     className="ml-3 size-10 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                     disabled={busy}
                    onClick={() => setCart((current) => current.filter((item) => item.key !== line.key))}
                    aria-label={"Remove " + line.name}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            )) : (
              <div className="flex h-full items-center justify-center text-center text-sm text-gray-500">
                Select a product to start the sale.
              </div>
            )}
          </div>
          <div className="border-t border-gray-200 pt-3">
            <div className="mb-3 flex items-center justify-between text-lg font-bold">
              <span>Total</span><span>{money.format(total)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => completeSale("cash")} disabled={!cart.length || busy} className="min-h-12 bg-foodeez-primary text-white hover:bg-foodeez-secondary">
                {busy ? "Completing…" : "Pay Cash"}
              </Button>
              <Button onClick={() => setCardConfirmOpen(true)} disabled={!cart.length || busy} className="min-h-12 bg-foodeez-primary text-white hover:bg-foodeez-secondary">
                {busy ? "Completing…" : "Card Terminal"}
              </Button>
            </div>
          </div>
        </aside>
      </div>

      <Dialog open={customOpen} onOpenChange={setCustomOpen}>
        <DialogContent portalContainer={workspaceRef.current}>
          <DialogHeader><DialogTitle>Add custom item</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="customPrice">Price, CHF</Label>
            <Input id="customPrice" type="number" min="0.01" step="0.05" value={customPrice} onChange={(event) => setCustomPrice(event.target.value)} autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomOpen(false)}>Cancel</Button>
            <Button onClick={addCustomItem}>Add item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cardConfirmOpen} onOpenChange={setCardConfirmOpen}>
        <DialogContent portalContainer={workspaceRef.current}>
          <DialogHeader><DialogTitle>Confirm Card Terminal Payment</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-700">
            Complete the payment on your separate card terminal first. Foodeez cannot verify that payment automatically.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCardConfirmOpen(false)}>Go Back</Button>
            <Button onClick={() => { setCardConfirmOpen(false); void completeSale("card"); }}>
              Confirm Payment Received
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(receipt)} onOpenChange={(open) => !open && setReceipt(null)}>
        <DialogContent portalContainer={workspaceRef.current} className="sm:max-w-md">
          <DialogHeader><DialogTitle>Sale completed</DialogTitle></DialogHeader>
          {receipt && <Receipt receipt={receipt} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceipt(null)}>Close</Button>
            <Button onClick={() => window.print()} className="gap-2"><Printer className="size-4" /> Print</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent portalContainer={workspaceRef.current} className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader><DialogTitle>POS orders</DialogTitle></DialogHeader>
          <div className="flex items-end gap-2">
            <div className="space-y-2">
              <Label htmlFor="summaryDate">Date</Label>
              <Input id="summaryDate" type="date" value={summaryDate} onChange={(event) => setSummaryDate(event.target.value)} />
            </div>
            <Button onClick={loadSummary} disabled={summaryLoading}>{summaryLoading ? "Loading…" : "Apply"}</Button>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr><th className="p-3">Order</th><th className="p-3">Time</th><th className="p-3">Payment</th><th className="p-3 text-right">Total</th><th className="p-3 text-right">Receipt</th></tr>
              </thead>
              <tbody className="divide-y">
                {orders.map((order) => (
                  <tr key={order.orderId}>
                    <td className="p-3 font-medium">{order.orderNumber}</td>
                    <td className="p-3">{new Date(order.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="p-3 capitalize">{order.paymentMethod}</td>
                    <td className="p-3 text-right">{money.format(order.total)}</td>
                    <td className="p-3 text-right">
                      <Button variant="outline" size="sm" onClick={() => { setSummaryOpen(false); setReceipt(order); }} className="gap-2"><Printer className="size-4" /> Reprint</Button>
                    </td>
                  </tr>
                ))}
                {!orders.length && !summaryLoading && (
                  <tr><td colSpan={5} className="p-8 text-center text-gray-500">No POS orders for this date.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PosProductTile({ product, busy, onClick }: { product: Product; busy: boolean; onClick: () => void }) {
  const imageUrl = resolveMediaUrl(product.pic);
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [imageUrl]);
  const showImage = Boolean(imageUrl && !imageFailed);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      aria-label={`Add ${product.name}, ${money.format(product.price)}`}
      className={`flex min-h-40 min-w-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white text-left shadow-sm transition hover:border-foodeez-primary hover:bg-foodeez-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foodeez-primary disabled:opacity-60 ${showImage ? "" : "justify-center"}`}
    >
      {showImage && imageUrl && (
        <div className="relative h-24 w-full overflow-hidden bg-gray-100">
          <Image src={imageUrl} alt="" fill sizes="(max-width: 640px) 45vw, 200px" className="object-cover" unoptimized={imageUrl.startsWith("http")} onError={() => setImageFailed(true)} />
        </div>
      )}
      <span className="block w-full px-3 py-3">
        <span className="line-clamp-2 block text-base font-semibold leading-snug text-gray-950">{product.name}</span>
        <span className="mt-1 block text-base font-semibold text-foodeez-primary">{money.format(product.price)}</span>
      </span>
    </button>
  );
}

function Receipt({ receipt }: { receipt: PosReceipt }) {
  return (
    <div className="pos-receipt space-y-3 bg-white text-sm text-gray-950">
      <div className="text-center">
        <p className="text-lg font-bold">{receipt.restaurantName}</p>
        {receipt.restaurantAddress && <p>{receipt.restaurantAddress}</p>}
        <p>{receipt.orderNumber}</p>
        <p>{new Date(receipt.createdAt).toLocaleString("de-CH")}</p>
      </div>
      <div className="border-y border-dashed border-gray-400 py-2">
        {receipt.items.map((item, index) => (
          <div key={index} className="flex justify-between gap-3 py-1">
            <span>{item.quantity} × {item.name}</span><span>{money.format(item.subtotal)}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-base font-bold">
        <span>Total</span><span>{money.format(receipt.total)}</span>
      </div>
      <p className="text-center capitalize">Paid by {receipt.paymentMethod}</p>
    </div>
  );
}
