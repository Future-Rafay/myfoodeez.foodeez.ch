import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ConfirmActionButton from "@/components/platform/ConfirmActionButton";
import { EmptyState, PageHeader, Pagination, SearchForm, StatusPill, formatDate } from "@/components/platform/PlatformUi";
import { listRestaurants, parsePage, parseSearch, type RestaurantFilter } from "@/services/platform-data";
import { restaurantProfileUrl } from "@/lib/customer-site";
import { cn } from "@/lib/utils";
import { setRestaurantApproval, setRestaurantStatus } from "../actions";

const FILTERS: { value: RestaurantFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "live", label: "Live" },
  { value: "pending", label: "Waiting for approval" },
  { value: "off", label: "Switched off" },
];

export default async function PlatformRestaurantsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const search = parseSearch(params.q);
  const page = parsePage(params.page);
  const filter = FILTERS.find((item) => item.value === params.filter)?.value ?? "all";
  const { rows, total } = await listRestaurants({ search, filter, page });

  return (
    <>
      <PageHeader title="Restaurants" description="Approve restaurants and switch them on or off. Only approved, switched-on restaurants appear on foodeez.ch.">
        <SearchForm action="/platform/restaurants" search={search} placeholder="Name, email, town or ID" hidden={{ filter }} />
      </PageHeader>
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <Link
            key={item.value}
            href={`/platform/restaurants?${new URLSearchParams({ filter: item.value, ...(search ? { q: search } : {}) })}`}
            className={cn(
              "rounded-full border px-3 py-1 text-sm font-medium",
              filter === item.value ? "border-foodeez-primary bg-foodeez-primary text-white" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <EmptyState>No restaurants match.</EmptyState>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Restaurant</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <a href={restaurantProfileUrl(row.name, row.id)} target="_blank" rel="noreferrer" className="font-medium text-gray-950 hover:text-foodeez-primary hover:underline">
                      {row.name}
                    </a>
                    <p className="text-xs text-gray-500">
                      #{row.id}
                      {row.town ? ` · ${row.town}` : ""}
                    </p>
                  </TableCell>
                  <TableCell className="max-w-56 truncate text-gray-600">{row.email || "—"}</TableCell>
                  <TableCell>
                    {!row.approved ? <StatusPill tone="amber">Waiting</StatusPill> : row.active ? <StatusPill tone="green">Live</StatusPill> : <StatusPill tone="gray">Off</StatusPill>}
                  </TableCell>
                  <TableCell>{row.hasOwner ? <StatusPill tone="green">Claimed</StatusPill> : <StatusPill tone="gray">Unclaimed</StatusPill>}</TableCell>
                  <TableCell className="text-gray-600">{formatDate(row.createdAt)}</TableCell>
                  <TableCell>
                    {/* The routine action sits on the left; the one that takes a restaurant offline is set apart and asks first. */}
                    <div className="flex items-center justify-end gap-10">
                      {!row.approved ? (
                        <ConfirmActionButton action={setRestaurantApproval} fields={{ businessId: row.id, approved: 1 }} label="Approve" tone="primary" />
                      ) : !row.active ? (
                        <ConfirmActionButton action={setRestaurantStatus} fields={{ businessId: row.id, status: 1 }} label="Switch on" tone="primary" />
                      ) : null}
                      {row.approved && row.active ? (
                        <ConfirmActionButton
                          action={setRestaurantStatus}
                          fields={{ businessId: row.id, status: 0 }}
                          label="Switch off"
                          tone="danger"
                          confirm={{ title: `Switch off ${row.name}?`, description: "It disappears from foodeez.ch and stops taking online orders until it is switched on again.", confirmLabel: "Switch off" }}
                        />
                      ) : row.approved ? (
                        <ConfirmActionButton
                          action={setRestaurantApproval}
                          fields={{ businessId: row.id, approved: 0 }}
                          label="Withdraw approval"
                          tone="danger"
                          confirm={{ title: `Withdraw approval for ${row.name}?`, description: "It goes back to the approval queue and stays hidden from foodeez.ch.", confirmLabel: "Withdraw approval" }}
                        />
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Pagination basePath="/platform/restaurants" page={page} total={total} query={{ filter, ...(search ? { q: search } : {}) }} />
    </>
  );
}
