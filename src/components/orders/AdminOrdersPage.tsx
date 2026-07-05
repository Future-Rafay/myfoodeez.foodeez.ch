"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  MoreHorizontal,
  PackageCheck,
  Search,
  Wallet,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  getAllowedOrderActions,
  getOrderStatusBadgeColor,
  getOrderStatusLabel,
  getPaymentStatusBadgeColor,
  getPaymentStatusLabel,
  isStripePaidOrder,
  normalizeOrderType,
  PAYMENT_DONE,
} from "@/lib/orderStatus";
import { getDisplayEta } from "@/lib/eta";
import { getDisplayOrderNumber } from "@/lib/orderNumber";
import { cn } from "@/lib/utils";
import type {
  AdminOrderRow,
  NormalizedOrderStatus,
  OrderPrepDefaults,
  OrdersKpis,
} from "@/services/orders-management";

type OrdersResponse = {
  orders: AdminOrderRow[];
  totalCount: number;
  page: number;
  totalPages: number;
  kpi: OrdersKpis;
  prepDefaults: OrderPrepDefaults;
};

type StatusFilter = "all" | NormalizedOrderStatus;
type DateRangeFilter = "all" | "today" | "last7" | "custom";
type ToastState = { type: "success" | "error"; message: string } | null;

const PAGE_SIZE = 20;

const REJECTION_REASONS = [
  "Restaurant is closed",
  "Item unavailable",
  "Too busy right now",
  "Delivery area not serviceable",
  "Customer address issue",
  "Payment issue",
  "Duplicate order",
  "Other",
];

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "CHF",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const statusOptions: { label: string; value: StatusFilter }[] = [
  { label: "All", value: "all" },
  { label: "Preparing", value: "preparing" },
  { label: "Out for delivery", value: "out_for_delivery" },
  { label: "Ready for pickup", value: "ready_for_pickup" },
  { label: "Delivered", value: "delivered" },
  { label: "Picked up", value: "picked_up" },
  { label: "Rejected", value: "rejected" },
];

const dateRangeOptions: { label: string; value: DateRangeFilter }[] = [
  { label: "All dates", value: "all" },
  { label: "Today", value: "today" },
  { label: "Last 7 days", value: "last7" },
  { label: "Custom", value: "custom" },
];

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function formatInputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getDateRangeBounds(dateRange: DateRangeFilter) {
  if (dateRange === "all" || dateRange === "custom") {
    return { dateFrom: "", dateTo: "" };
  }

  const today = new Date();

  if (dateRange === "today") {
    return { dateFrom: formatInputDate(today), dateTo: formatInputDate(today) };
  }

  const start = new Date(today);
  start.setDate(start.getDate() - 6);

  return { dateFrom: formatInputDate(start), dateTo: formatInputDate(today) };
}

function customerName(order: AdminOrderRow) {
  return [order.VISITOR_FIRST_NAME, order.VISITOR_LAST_NAME]
    .filter(Boolean)
    .join(" ")
    .trim() || "Guest customer";
}

function itemsSummary(order: AdminOrderRow) {
  return `${order.item_count} ${order.item_count === 1 ? "item" : "items"}`;
}

function formatDateTime(value: string | null) {
  if (!value) return "Not available";
  return dateTimeFormatter.format(new Date(value));
}

function getEtaDate(order: AdminOrderRow, prepDefaults: OrderPrepDefaults) {
  const date = new Date(order.DELIVERY_ET || order.CREATION_DATETIME || "");
  if (Number.isNaN(date.getTime())) return null;

  if (!order.DELIVERY_ET) {
    date.setMinutes(
      date.getMinutes() +
      (order.ORDER_TYPE === "pickup"
        ? prepDefaults.defaultPickupPrepMinutes
        : prepDefaults.defaultDeliveryPrepMinutes)
    );
  }

  return date;
}

function formatDatetimeLocal(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function etaLabel(order: AdminOrderRow) {
  return order.ORDER_TYPE === "pickup"
    ? "Estimated pickup time"
    : "Estimated delivery time";
}

function orderNumberLabel(order: AdminOrderRow) {
  return order.displayOrderNumber || getDisplayOrderNumber(order);
}

export default function AdminOrdersPage({ businessId }: { businessId: number }) {
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [kpi, setKpi] = useState<OrdersKpis>({
    new: 0,
    preparing: 0,
    out_for_delivery: 0,
    ready_for_pickup: 0,
    delivered: 0,
    picked_up: 0,
    rejected: 0,
    revenue_today: 0,
  });
  const [prepDefaults, setPrepDefaults] = useState<OrderPrepDefaults>({
    defaultPickupPrepMinutes: 20,
    defaultDeliveryPrepMinutes: 45,
  });
  const [status, setStatus] = useState<StatusFilter>("all");
  const [dateRange, setDateRange] = useState<DateRangeFilter>("all");
  const [dateFrom, setDateFrom] = useState(todayInputValue);
  const [dateTo, setDateTo] = useState(todayInputValue);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSavingEta, setIsSavingEta] = useState(false);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<ToastState>(null);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrderRow | null>(null);
  const [rejectOrder, setRejectOrder] = useState<AdminOrderRow | null>(null);
  const [rejectionReason, setRejectionReason] = useState(REJECTION_REASONS[0]);
  const [rejectionNote, setRejectionNote] = useState("");

  useEffect(() => {
    const orderId = new URLSearchParams(window.location.search).get("orderId");
    if (orderId) setSearch(orderId);
  }, []);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      status,
      search,
      page: page.toString(),
      limit: PAGE_SIZE.toString(),
    });
    const presetBounds = getDateRangeBounds(dateRange);
    const rangeFrom = dateRange === "custom" ? dateFrom : presetBounds.dateFrom;
    const rangeTo = dateRange === "custom" ? dateTo : presetBounds.dateTo;

    if (rangeFrom) params.set("dateFrom", rangeFrom);
    if (rangeTo) params.set("dateTo", rangeTo);

    return params.toString();
  }, [dateFrom, dateRange, dateTo, page, search, status]);

  const loadOrders = useCallback(
    async (signal?: AbortSignal, showLoading = true) => {
      if (showLoading) setIsLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/dashboard/${businessId}/orders?${queryString}`,
          { signal }
        );

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.error || "Failed to load orders");
        }

        const data = (await response.json()) as OrdersResponse;
        setOrders(data.orders);
        setKpi(data.kpi);
        setPrepDefaults(data.prepDefaults);
        setTotalPages(data.totalPages);
        setTotalCount(data.totalCount);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setError(error instanceof Error ? error.message : "Failed to load orders");
      } finally {
        if (showLoading) setIsLoading(false);
      }
    },
    [businessId, queryString]
  );

  useEffect(() => {
    const controller = new AbortController();
    loadOrders(controller.signal);
    return () => controller.abort();
  }, [loadOrders]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadOrders(undefined, false);
    }, 30_000);

    return () => window.clearInterval(interval);
  }, [loadOrders]);

  useEffect(() => {
    setPage(1);
  }, [dateFrom, dateRange, dateTo, search, status]);

  function replaceOrder(updatedOrder: AdminOrderRow) {
    setOrders((current) =>
      current.map((order) =>
        order.BUSINESS_ORDER_ID === updatedOrder.BUSINESS_ORDER_ID
          ? updatedOrder
          : order
      )
    );
    setSelectedOrder((current) =>
      current?.BUSINESS_ORDER_ID === updatedOrder.BUSINESS_ORDER_ID
        ? updatedOrder
        : current
    );
  }

  async function updateStatus(
    order: AdminOrderRow,
    nextStatus: NormalizedOrderStatus,
    rejection?: { rejectionReason: string; rejectionNote: string }
  ) {
    setIsUpdating(true);
    setError("");

    try {
      const response = await fetch(
        `/api/dashboard/${businessId}/orders/${order.BUSINESS_ORDER_ID}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus, ...rejection }),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to update order status");
      }

      const updatedOrder = (await response.json()) as AdminOrderRow;
      replaceOrder(updatedOrder);
      await loadOrders();
      return true;
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to update order status"
      );
      return false;
    } finally {
      setIsUpdating(false);
    }
  }

  async function saveEta(order: AdminOrderRow, eta: string) {
    setIsSavingEta(true);
    setError("");

    try {
      const response = await fetch(
        `/api/dashboard/${businessId}/orders/${order.BUSINESS_ORDER_ID}/eta`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eta }),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to update ETA");
      }

      const updatedOrder = (await response.json()) as AdminOrderRow;
      replaceOrder(updatedOrder);
      setToast({ type: "success", message: "ETA updated." });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to update ETA");
    } finally {
      setIsSavingEta(false);
    }
  }

  async function markPaid(order: AdminOrderRow) {
    setIsMarkingPaid(true);
    setError("");

    try {
      const response = await fetch(
        `/api/dashboard/${businessId}/orders/${order.BUSINESS_ORDER_ID}/payment`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentDone: 1 }),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to update payment status");
      }

      const updatedOrder = (await response.json()) as AdminOrderRow;
      replaceOrder(updatedOrder);
      setToast({ type: "success", message: "Payment marked paid." });
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to update payment status"
      );
    } finally {
      setIsMarkingPaid(false);
    }
  }

  async function confirmReject() {
    if (!rejectOrder) return;

    const wasStripePaid = isStripePaidOrder(rejectOrder);
    const updated = await updateStatus(rejectOrder, "rejected", {
      rejectionReason,
      rejectionNote,
    });
    if (!updated) return;

    setToast({
      type: "success",
      message: wasStripePaid ? "Order refunded and rejected." : "Order rejected.",
    });
    setRejectOrder(null);
    setRejectionReason(REJECTION_REASONS[0]);
    setRejectionNote("");
  }

  const kpiCards = [
    {
      label: "Preparing",
      value: kpi.preparing,
      icon: Clock3,
      className: "bg-blue-50 text-blue-700",
    },
    {
      label: "Out for delivery",
      value: kpi.out_for_delivery,
      icon: PackageCheck,
      className: "bg-purple-50 text-purple-700",
    },
    {
      label: "Ready for pickup",
      value: kpi.ready_for_pickup,
      icon: CheckCircle2,
      className: "bg-purple-50 text-purple-700",
    },
    {
      label: "Delivered",
      value: kpi.delivered,
      icon: CheckCircle2,
      className: "bg-green-50 text-green-700",
    },
    {
      label: "Picked up",
      value: kpi.picked_up,
      icon: CheckCircle2,
      className: "bg-green-50 text-green-700",
    },
    {
      label: "Revenue today",
      value: currencyFormatter.format(kpi.revenue_today),
      icon: Wallet,
      className: "bg-green-50 text-green-700",
    },
  ];

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {kpiCards.map((card) => {
          const Icon = card.icon;

          return (
            <Card key={card.label} className="border-gray-200 bg-white shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      {card.label}
                    </p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-gray-950">
                      {card.value}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "flex size-10 items-center justify-center rounded-lg",
                      card.className
                    )}
                  >
                    <Icon className="size-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <Card className="border-gray-200 bg-white shadow-sm">
        <CardContent className="p-5">
          <div className="grid gap-3 lg:grid-cols-[180px_180px_1fr]">
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as StatusFilter)}
            >
              <SelectTrigger className="h-10 w-full bg-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={dateRange}
              onValueChange={(value) => setDateRange(value as DateRangeFilter)}
            >
              <SelectTrigger className="h-10 w-full bg-white">
                <CalendarDays className="size-4 text-gray-500" />
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent>
                {dateRangeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by order number, customer, email, or phone"
                className="h-10 bg-white pl-9"
              />
            </div>
          </div>

          {dateRange === "custom" && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:max-w-md">
              <Input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
              />
            </div>
          )}

          {error && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          {toast && (
            <p
              className={cn(
                "mt-3 rounded-lg border px-3 py-2 text-sm",
                toast.type === "success"
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-red-200 bg-red-50 text-red-700"
              )}
            >
              {toast.message}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-gray-200 bg-white shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <OrdersSkeleton />
          ) : orders.length ? (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 hover:bg-gray-50">
                      <TableHead>Order #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Order type</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Payment status</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>ETA</TableHead>
                      <TableHead>Ordered at</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow
                        key={order.BUSINESS_ORDER_ID}
                        className="hover:bg-gray-50"
                      >
                        <TableCell className="font-medium text-gray-950">
                          {orderNumberLabel(order)}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-gray-950">
                            {customerName(order)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {order.VISITOR_PHONE || "No phone"}
                          </div>
                        </TableCell>
                        <TableCell className="capitalize">
                          {order.ORDER_TYPE}
                        </TableCell>
                        <TableCell>{itemsSummary(order)}</TableCell>
                        <TableCell>
                          {currencyFormatter.format(order.FINAL_AMOUNT)}
                        </TableCell>
                        <TableCell>
                          <PaymentStatusBadge order={order} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge order={order} />
                        </TableCell>
                        <TableCell>
                          <EtaTime order={order} prepDefaults={prepDefaults} />
                        </TableCell>
                        <TableCell className="text-gray-500">
                          {formatDateTime(order.CREATION_DATETIME)}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="icon">
                                <MoreHorizontal className="size-4" />
                                <span className="sr-only">Order actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">

                              <DropdownMenuItem
                                onClick={() => setSelectedOrder(order)}
                              >
                                <Eye className="size-4" />
                                View Details
                              </DropdownMenuItem>
                              {getAllowedOrderActions(order).length > 0 && (
                                <div className="my-1 h-px bg-gray-100" />
                              )}
                              {getAllowedOrderActions(order).map((action) => (
                                <DropdownMenuItem
                                  key={action.status}
                                  disabled={isUpdating}
                                  className={cn(
                                    action.variant === "destructive" &&
                                    "text-red-600 focus:text-red-700"
                                  )}
                                  onClick={() => {
                                    if (action.status === "rejected") {
                                      setRejectOrder(order);
                                      return;
                                    }

                                    void updateStatus(order, action.status);
                                  }}
                                >
                                  {action.label}
                                </DropdownMenuItem>
                              ))}

                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-gray-500">
                  Showing page {page} of {totalPages} ({totalCount} orders)
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((current) => current - 1)}
                  >
                    <ChevronLeft className="size-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    Next
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="mb-4 flex size-14 items-center justify-center rounded-xl bg-gray-100 text-gray-500">
                <XCircle className="size-7" />
              </div>
              <h2 className="text-lg font-semibold text-gray-950">
                No orders found
              </h2>
              <p className="mt-2 max-w-md text-sm text-gray-500">
                Try changing the status, date range, or search filter.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <OrderDetailsModal
        order={selectedOrder}
        prepDefaults={prepDefaults}
        isUpdating={isUpdating}
        isSavingEta={isSavingEta}
        isMarkingPaid={isMarkingPaid}
        onClose={() => setSelectedOrder(null)}
        onUpdateStatus={updateStatus}
        onSaveEta={(order, eta) => saveEta(order, eta)}
        onMarkPaid={(order) => markPaid(order)}
        onReject={(order) => setRejectOrder(order)}
      />
      <RejectOrderModal
        order={rejectOrder}
        isUpdating={isUpdating}
        reason={rejectionReason}
        note={rejectionNote}
        onReasonChange={setRejectionReason}
        onNoteChange={setRejectionNote}
        onClose={() => setRejectOrder(null)}
        onConfirm={() => void confirmReject()}
      />
    </div>
  );
}

function StatusBadge({ order }: { order: AdminOrderRow }) {
  return (
    <Badge variant="outline" className={getOrderStatusBadgeColor(order)}>
      {getOrderStatusLabel(order)}
    </Badge>
  );
}

function PaymentStatusBadge({ order }: { order: AdminOrderRow }) {
  if (order.STRIPE_REFUND_STATUS && order.PAYMENT_DONE !== 2) {
    return (
      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
        Refund pending
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className={getPaymentStatusBadgeColor(order.PAYMENT_DONE)}>
      {getPaymentStatusLabel(order.PAYMENT_DONE, order.ORDER_TYPE)}
    </Badge>
  );
}

function EtaTime({
  order,
  prepDefaults,
}: {
  order: AdminOrderRow;
  prepDefaults: OrderPrepDefaults;
}) {
  const eta = getDisplayEta(order, prepDefaults);

  return (
    <div className="flex items-center gap-2">
      <span>{eta.time}</span>
      {eta.isDefault && (
        <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-600">
          Default
        </Badge>
      )}
    </div>
  );
}

function OrdersSkeleton() {
  return (
    <div>
      <div className="grid grid-cols-10 gap-4 border-b border-gray-100 bg-gray-50 p-4">
        {Array.from({ length: 10 }).map((_, index) => (
          <Skeleton key={index} className="h-4 w-full" />
        ))}
      </div>
      <div className="divide-y divide-gray-100">
        {Array.from({ length: 8 }).map((_, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-10 gap-4 p-4">
            {Array.from({ length: 10 }).map((_, cellIndex) => (
              <Skeleton key={cellIndex} className="h-5 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailLine({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-right font-medium text-gray-900">{value}</span>
    </div>
  );
}

function MoneyLine({
  label,
  value,
  danger,
  total,
}: {
  label: string;
  value: number;
  danger?: boolean;
  total?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 text-sm",
        total && "border-t border-gray-100 pt-3 text-base font-semibold"
      )}
    >
      <span className={cn(total ? "text-gray-950" : "text-gray-500")}>
        {label}
      </span>
      <span
        className={cn(
          total ? "text-lg text-gray-950" : "font-medium text-gray-900",
          danger && value > 0 && "text-red-600"
        )}
      >
        {currencyFormatter.format(value)}
      </span>
    </div>
  );
}

function RejectOrderModal({
  order,
  isUpdating,
  reason,
  note,
  onReasonChange,
  onNoteChange,
  onClose,
  onConfirm,
}: {
  order: AdminOrderRow | null;
  isUpdating: boolean;
  reason: string;
  note: string;
  onReasonChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!order) return null;

  return (
    <Dialog open={Boolean(order)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reject order {orderNumberLabel(order)}</DialogTitle>
          <DialogDescription>
            Choose a reason. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {isStripePaidOrder(order) && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            This order was paid online. Rejecting it will refund the customer first.
          </p>
        )}

        <RadioGroup value={reason} onValueChange={onReasonChange}>
          {REJECTION_REASONS.map((item) => (
            <div key={item} className="flex items-center gap-2">
              <RadioGroupItem id={`reject-${item}`} value={item} />
              <Label htmlFor={`reject-${item}`} className="text-sm">
                {item}
              </Label>
            </div>
          ))}
        </RadioGroup>

        <div className="space-y-2">
          <Label htmlFor="rejectionNote">Optional note</Label>
          <Textarea
            id="rejectionNote"
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            rows={3}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isUpdating}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isUpdating || !reason}
          >
            {isUpdating
              ? isStripePaidOrder(order)
                ? "Processing refund..."
                : "Rejecting..."
              : isStripePaidOrder(order)
                ? "Refund and reject order"
                : "Reject order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OrderDetailsModal({
  order,
  prepDefaults,
  isUpdating,
  isSavingEta,
  isMarkingPaid,
  onClose,
  onUpdateStatus,
  onSaveEta,
  onMarkPaid,
  onReject,
}: {
  order: AdminOrderRow | null;
  prepDefaults: OrderPrepDefaults;
  isUpdating: boolean;
  isSavingEta: boolean;
  isMarkingPaid: boolean;
  onClose: () => void;
  onUpdateStatus: (
    order: AdminOrderRow,
    status: NormalizedOrderStatus
  ) => Promise<unknown>;
  onSaveEta: (order: AdminOrderRow, eta: string) => Promise<void>;
  onMarkPaid: (order: AdminOrderRow) => Promise<void>;
  onReject: (order: AdminOrderRow) => void;
}) {
  const [etaInput, setEtaInput] = useState("");

  useEffect(() => {
    if (!order) return;
    const etaDate = getEtaDate(order, prepDefaults);
    setEtaInput(etaDate ? formatDatetimeLocal(etaDate) : "");
  }, [order, prepDefaults]);

  if (!order) return null;

  const actions = getAllowedOrderActions(order);
  const isRejected = order.status === "rejected";
  const showMarkPaid = order.PAYMENT_DONE === 0;
  const canEditEta =
    order.PAYMENT_DONE !== PAYMENT_DONE.REFUNDED &&
    !order.STRIPE_REFUND_STATUS &&
    !["rejected", "delivered", "picked_up"].includes(order.status);

  return (
    <Dialog open={Boolean(order)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>Order {orderNumberLabel(order)}</DialogTitle>
          <DialogDescription>
            Full order, customer, payment, and item details.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-gray-200 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-gray-950">
                Order {orderNumberLabel(order)}
              </h3>
              <StatusBadge order={order} />
            </div>
            <div className="space-y-2">
              <DetailLine
                label="Order type"
                value={normalizeOrderType(order.ORDER_TYPE) === "pickup" ? "Pickup" : "Delivery"}
              />
              <DetailLine
                label="Placed at"
                value={formatDateTime(order.CREATION_DATETIME)}
              />
              <DetailLine
                label={etaLabel(order)}
                value={
                  <span className="inline-flex items-center justify-end gap-2">
                    {getDisplayEta(order, prepDefaults).time}
                    {!order.DELIVERY_ET && (
                      <Badge
                        variant="outline"
                        className="border-gray-200 bg-gray-50 text-gray-600"
                      >
                        Default
                      </Badge>
                    )}
                  </span>
                }
              />
              <DetailLine
                label="Payment status"
                value={<PaymentStatusBadge order={order} />}
              />
              {isRejected && order.ORDER_REJECTION_REASON && (
                <DetailLine
                  label="Rejection reason"
                  value={order.ORDER_REJECTION_REASON}
                />
              )}
              {isRejected && order.ORDER_REJECTION_NOTE && (
                <DetailLine
                  label="Rejection note"
                  value={order.ORDER_REJECTION_NOTE}
                />
              )}
              {order.STAFF_MEMBER && (
                <DetailLine label="Staff" value={order.STAFF_MEMBER} />
              )}
              {order.TERMINAL && (
                <DetailLine label="Terminal" value={order.TERMINAL} />
              )}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-950">Customer</h3>
            <div className="mt-3 space-y-2">
              <DetailLine label="Full name" value={customerName(order)} />
              <DetailLine
                label="Phone"
                value={order.VISITOR_PHONE || "No phone"}
              />
              <DetailLine
                label="Email"
                value={order.VISITOR_EMAIL || "No email"}
              />
              <DetailLine
                label="Delivery address"
                value={order.DELIVERY_ADDRESS || "No delivery address"}
              />
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-950">
              Payment details
            </h3>
            <div className="mt-3 space-y-2">
              <DetailLine
                label="Payment mode"
                value={order.PAYMENT_MODE || "Not set"}
              />
              <DetailLine
                label="Payment status"
                value={<PaymentStatusBadge order={order} />}
              />
              {order.STRIPE_PAYMENT_INTENT_ID && (
                <DetailLine
                  label="Stripe payment intent"
                  value={
                    <code className="max-w-48 truncate rounded bg-gray-50 px-1.5 py-0.5 text-xs text-gray-600">
                      {order.STRIPE_PAYMENT_INTENT_ID}
                    </code>
                  }
                />
              )}
              {order.STRIPE_REFUND_STATUS && (
                <DetailLine
                  label="Refund status"
                  value={order.STRIPE_REFUND_STATUS}
                />
              )}
              {order.STRIPE_REFUNDED_DATETIME && (
                <DetailLine
                  label="Refunded at"
                  value={formatDateTime(order.STRIPE_REFUNDED_DATETIME)}
                />
              )}
              <MoneyLine label="Gross amount" value={order.GROSS_AMOUNT} />
              <MoneyLine
                label="Discount"
                value={order.DISCOUNT_AMOUNT}
                danger
              />
              <MoneyLine
                label="Shipping charges"
                value={order.SHIPPING_AMOUNT}
              />
              <MoneyLine label="Tax" value={order.TAX_AMOUNT} />
              <MoneyLine
                label="Refund amount"
                value={order.REFUND_AMOUNT}
                danger
              />
              <MoneyLine label="Final amount" value={order.FINAL_AMOUNT} total />
              {showMarkPaid && (
                <Button
                  type="button"
                  className="mt-2 bg-foodeez-primary text-white hover:bg-foodeez-secondary"
                  disabled={isMarkingPaid}
                  onClick={() => void onMarkPaid(order)}
                >
                  {isMarkingPaid ? "Marking..." : "Mark paid"}
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                <TableHead>Product Name</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Unit Price</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.length ? (
                order.items.map((item) => (
                  <TableRow key={item.BUSINESS_ORDER_DETAIL_ID}>
                    <TableCell className="font-medium">
                      {item.product_title}
                    </TableCell>
                    <TableCell>{item.ORDER_QUANTITY}</TableCell>
                    <TableCell>
                      {currencyFormatter.format(item.PRODUCT_SELL_PRICE)}
                    </TableCell>
                    <TableCell>
                      {currencyFormatter.format(item.PRODUCT_DISCOUNT)}
                    </TableCell>
                    <TableCell>
                      {currencyFormatter.format(item.subtotal)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-gray-500">
                    No order items found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <DialogFooter>
          <div className="w-full flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div className="mt-4 flex flex-wrap gap-2">
              {actions.map((action) => (
                <Button
                  key={action.status}
                  disabled={isUpdating}
                  variant={action.variant === "destructive" ? "destructive" : "default"}
                  onClick={() =>
                    action.status === "rejected"
                      ? onReject(order)
                      : onUpdateStatus(order, action.status)
                  }
                  className={cn(
                    action.variant !== "destructive" &&
                    "bg-foodeez-primary text-white hover:bg-foodeez-secondary"
                  )}
                >
                  {action.label}
                </Button>
              ))}
             
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {canEditEta && (
                <>
                  <Label htmlFor="detailEta">{etaLabel(order)}</Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="detailEta"
                      type="datetime-local"
                      value={etaInput}
                      onChange={(event) => setEtaInput(event.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isSavingEta || !etaInput}
                      onClick={() => void onSaveEta(order, etaInput)}
                    >
                      {isSavingEta ? "Saving..." : "Save ETA"}
                    </Button>
                  </div>
                </>
              )}
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog >
  );
}
