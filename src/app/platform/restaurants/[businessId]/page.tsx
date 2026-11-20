import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ConfirmActionButton from "@/components/platform/ConfirmActionButton";
import { EmptyState, PageHeader, StatusPill, formatDate } from "@/components/platform/PlatformUi";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { restaurantProfileUrl } from "@/lib/customer-site";
import { getDisplayOrderNumber } from "@/lib/orderNumber";
import { getOrderStatusBadgeColor, getOrderStatusLabel, getPaymentStatusBadgeColor, getPaymentStatusLabel } from "@/lib/orderStatus";
import { getRestaurantDetail } from "@/services/platform-data";
import { setRestaurantApproval, setRestaurantStatus } from "../../actions";

const chf = new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" });
const dateTime = new Intl.DateTimeFormat("de-CH", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Zurich" });
const humanize = (value: string) => value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " ");

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 sm:px-5">
        <h2 className="text-base font-semibold text-gray-950">{title}</h2>
        {action}
      </div>
      <div className="px-4 py-4 sm:px-5">{children}</div>
    </section>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <dt className="shrink-0 text-gray-500">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium text-gray-900">{children}</dd>
    </div>
  );
}

export default async function PlatformRestaurantPage({ params }: { params: Promise<{ businessId: string }> }) {
  await requirePlatformAdmin();
  const businessId = Number((await params).businessId);
  if (!Number.isInteger(businessId) || businessId <= 0) notFound();
  const detail = await getRestaurantDetail(businessId);
  if (!detail) notFound();
  const { business, owners, orders, requests, history } = detail;

  return (
    <>
      <Link href="/platform/restaurants" className="mb-3 inline-flex min-h-10 items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-950 sm:min-h-0">
        <ArrowLeft className="size-4" aria-hidden /> Restaurants
      </Link>
      <PageHeader title={business.name} description={[`#${business.id}`, business.town].filter(Boolean).join(" · ")}>
        <a
          href={restaurantProfileUrl(business.name, business.id)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center gap-2 rounded-md border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 shadow-xs hover:bg-gray-50 sm:h-9"
        >
          View on foodeez.ch <ExternalLink className="size-4" aria-hidden />
        </a>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Status">
          <div className="flex flex-wrap gap-2">
            {!business.approved ? <StatusPill tone="amber">Waiting for approval</StatusPill> : business.active ? <StatusPill tone="green">Live</StatusPill> : <StatusPill tone="gray">Switched off</StatusPill>}
            {owners.length ? <StatusPill tone="green">Claimed</StatusPill> : <StatusPill tone="gray">Unclaimed</StatusPill>}
          </div>
          {/* Routine action first; the one that takes the restaurant offline is set apart and asks first. */}
          <div className="mt-4 flex flex-wrap items-center gap-6">
            {!business.approved ? (
              <ConfirmActionButton action={setRestaurantApproval} fields={{ businessId: business.id, approved: 1 }} label="Approve" tone="primary" />
            ) : !business.active ? (
              <ConfirmActionButton action={setRestaurantStatus} fields={{ businessId: business.id, status: 1 }} label="Switch on" tone="primary" />
            ) : null}
            {business.approved && business.active ? (
              <ConfirmActionButton
                action={setRestaurantStatus}
                fields={{ businessId: business.id, status: 0 }}
                label="Switch off"
                tone="danger"
                confirm={{ title: `Switch off ${business.name}?`, description: "It disappears from foodeez.ch and stops taking online orders until it is switched on again.", confirmLabel: "Switch off" }}
              />
            ) : business.approved ? (
              <ConfirmActionButton
                action={setRestaurantApproval}
                fields={{ businessId: business.id, approved: 0 }}
                label="Withdraw approval"
                tone="danger"
                confirm={{ title: `Withdraw approval for ${business.name}?`, description: "It goes back to the approval queue and stays hidden from foodeez.ch.", confirmLabel: "Withdraw approval" }}
              />
            ) : null}
          </div>
        </Section>

        <Section title="Contact">
          <dl className="space-y-2">
            <Fact label="Email">{business.email || "—"}</Fact>
            <Fact label="Phone">{business.phone || "—"}</Fact>
            <Fact label="Website">{business.website || "—"}</Fact>
            <Fact label="Added">{formatDate(business.createdAt)}</Fact>
          </dl>
        </Section>

        <Section title="Orders">
          <dl className="space-y-2">
            <Fact label="All time">{orders.total.toLocaleString("de-CH")}</Fact>
            <Fact label="Last 30 days">{orders.last30Days.toLocaleString("de-CH")}</Fact>
            <Fact label="Revenue, all time">{chf.format(orders.revenue)}</Fact>
          </dl>
        </Section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Section title={`Owners (${owners.length})`}>
          {owners.length === 0 ? (
            <p className="text-sm text-gray-500">No one manages this restaurant yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {owners.map((owner) => (
                <li key={owner.id ?? owner.email} className="py-2 first:pt-0 last:pb-0">
                  <Link href={`/platform/customers?q=${owner.id}`} className="text-sm font-medium text-gray-950 hover:text-foodeez-primary hover:underline">
                    {owner.name || owner.email || `Account #${owner.id}`}
                  </Link>
                  <p className="text-xs text-gray-500">
                    {owner.email || "No email"}
                    {owner.since ? ` · owner since ${formatDate(owner.since)}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title={`Requests (${requests.length})`} action={<Link href="/platform/requests" className="text-sm font-medium text-foodeez-primary hover:underline">All requests</Link>}>
          {requests.length === 0 ? (
            <p className="text-sm text-gray-500">No registration or claim requests.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {requests.map((request) => (
                <li key={request.id} className="flex items-start justify-between gap-3 py-2 text-sm first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="font-medium capitalize text-gray-950">{request.type}</p>
                    <p className="break-words text-xs text-gray-500">
                      {request.account.email || `Account #${request.account.id}`} · {formatDate(request.createdAt)}
                      {request.note ? ` · “${request.note}”` : ""}
                    </p>
                  </div>
                  <StatusPill tone={request.status === "approved" ? "green" : request.status === "rejected" ? "red" : "amber"}>{humanize(request.status)}</StatusPill>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <div className="mt-4">
        <Section title="Recent orders">
          {orders.recent.length === 0 ? (
            <EmptyState>No orders yet.</EmptyState>
          ) : (
            <div className="-mx-4 sm:-mx-5">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4 sm:pl-5">Order #</TableHead>
                    <TableHead className="hidden sm:table-cell">Placed</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Payment</TableHead>
                    <TableHead className="pr-4 text-right sm:pr-5">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.recent.map((order) => (
                    <TableRow key={order.BUSINESS_ORDER_ID}>
                      <TableCell className="pl-4 font-medium sm:pl-5">
                        {getDisplayOrderNumber(order)}
                        <span className="block text-xs font-normal text-gray-500 sm:hidden">{order.CREATION_DATETIME ? dateTime.format(order.CREATION_DATETIME) : "—"}</span>
                      </TableCell>
                      <TableCell className="hidden text-gray-600 sm:table-cell">{order.CREATION_DATETIME ? dateTime.format(order.CREATION_DATETIME) : "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getOrderStatusBadgeColor(order)}>
                          {getOrderStatusLabel(order)}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="outline" className={getPaymentStatusBadgeColor(order.PAYMENT_DONE)}>
                          {order.STRIPE_REFUND_STATUS && order.PAYMENT_DONE !== 2 ? "Refund pending" : getPaymentStatusLabel(order.PAYMENT_DONE, order.ORDER_TYPE)}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-4 text-right sm:pr-5">{chf.format(order.ORDER_FINAL_AMOUNT)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Section>
      </div>

      <div className="mt-4">
        <Section
          title="History"
          action={
            <Link href={`/platform/audit?type=business&id=${business.id}`} className="text-sm font-medium text-foodeez-primary hover:underline">
              Full log
            </Link>
          }
        >
          {history.length === 0 ? (
            <p className="text-sm text-gray-500">No Super Admin changes recorded for this restaurant.</p>
          ) : (
            <ol className="space-y-2">
              {history.map((entry) => (
                <li key={entry.id} className="text-sm">
                  <span className="font-medium text-gray-950">{humanize(entry.action)}</span>
                  <span className="text-gray-500">
                    {" · "}
                    {dateTime.format(entry.createdAt)} · by {entry.actor}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Section>
      </div>
    </>
  );
}
