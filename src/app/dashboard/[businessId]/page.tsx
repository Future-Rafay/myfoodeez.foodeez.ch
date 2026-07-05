import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Clock,
  Package,
  ReceiptText,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getBusinessDashboardData } from "@/services/admin-data";
import { cn } from "@/lib/utils";

type DashboardPageProps = {
  params: Promise<{ businessId: string }>;
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "CHF",
});

const numberFormatter = new Intl.NumberFormat("en-US");

function formatDateTime(value: string | null) {
  if (!value) return "Not available";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusClasses(status: string) {
  if (status === "preparing") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "out_for_delivery") return "border-purple-200 bg-purple-50 text-purple-700";
  if (status === "ready_for_pickup") return "border-purple-200 bg-purple-50 text-purple-700";
  if (status === "delivered") return "border-green-200 bg-green-50 text-green-700";
  if (status === "picked_up") return "border-green-200 bg-green-50 text-green-700";
  if (status === "rejected") return "border-red-200 bg-red-50 text-red-700";
  return "border-gray-200 bg-gray-50 text-gray-600";
}

function statusLabel(status: string) {
  if (status === "preparing") return "Preparing";
  if (status === "out_for_delivery") return "Out for delivery";
  if (status === "ready_for_pickup") return "Ready for pickup";
  if (status === "delivered") return "Delivered";
  if (status === "picked_up") return "Picked up";
  if (status === "rejected") return "Rejected";
  return "Unknown";
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { businessId: businessIdParam } = await params;
  const businessId = Number(businessIdParam);

  if (!Number.isFinite(businessId)) {
    notFound();
  }

  let data;

  try {
    data = await getBusinessDashboardData(businessId);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      redirect("/auth/signin");
    }

    if (error instanceof Error && error.message === "Forbidden") {
      notFound();
    }

    throw error;
  }

  const kpiCards = [
    {
      label: "Total Orders",
      value: numberFormatter.format(data.kpis.totalOrders),
      icon: ReceiptText,
      help: "All time order volume",
    },
    {
      label: "Total Revenue",
      value: currencyFormatter.format(data.kpis.totalRevenue),
      icon: Wallet,
      help: "Sum of final order totals",
    },
    {
      label: "Pending Orders",
      value: numberFormatter.format(data.kpis.pendingOrders),
      icon: AlertCircle,
      help: "Orders not delivered or rejected",
    },
    {
      label: "Active Products",
      value: numberFormatter.format(data.kpis.activeProducts),
      icon: Package,
      help: "Products visible in catalog",
    },
  ];

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;

          return (
            <Card key={card.label} className="border-gray-200 bg-white shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      {card.label}
                    </p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-gray-950">
                      {card.value}
                    </p>
                  </div>
                  <div className="flex size-10 items-center justify-center rounded-lg bg-foodeez-primary/10 text-foodeez-primary">
                    <Icon className="size-5" />
                  </div>
                </div>
                <p className="mt-4 text-xs text-gray-500">{card.help}</p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <Card className="border-gray-200 bg-white shadow-sm">
        <CardHeader className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-gray-950">
              Recent Orders
            </CardTitle>
            <p className="mt-1 text-sm text-gray-500">
              Last 10 orders placed for this restaurant.
            </p>
          </div>
          <Link
            href={`/dashboard/${businessId}/orders`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-foodeez-primary hover:text-foodeez-secondary"
          >
            View all orders
            <ArrowRight className="size-4" />
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {data.recentOrders.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 hover:bg-gray-50">
                    <TableHead>Order #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentOrders.map((order) => (
                    <TableRow key={order.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium text-gray-950">
                        {order.orderNumber}
                      </TableCell>
                      <TableCell>{order.customer}</TableCell>
                      <TableCell>{order.items}</TableCell>
                      <TableCell>
                        {currencyFormatter.format(order.total)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(statusClasses(order.status))}
                        >
                          {statusLabel(order.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-500">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="size-4" />
                          {formatDateTime(order.createdAt)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <div className="mb-4 flex size-12 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                <ReceiptText className="size-6" />
              </div>
              <h2 className="text-lg font-semibold text-gray-950">
                No orders yet
              </h2>
              <p className="mt-1 max-w-md text-sm text-gray-500">
                Recent customer orders will appear here once they start coming
                in.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
