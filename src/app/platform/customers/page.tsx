import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, FilterTabs, PageHeader, Pagination, SearchForm, StatusPill, formatDate } from "@/components/platform/PlatformUi";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { type CustomerRole, listCustomers, parseCustomerRole, parsePage, parseSearch } from "@/services/platform-data";

const chf = new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" });

const ROLES: { value: CustomerRole; label: string }[] = [
  { value: "all", label: "All accounts" },
  { value: "customers", label: "Customers" },
  { value: "owners", label: "Restaurant owners" },
  { value: "admins", label: "Super Admins" },
];

export default async function PlatformCustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePlatformAdmin();
  const params = await searchParams;
  const search = parseSearch(params.q);
  const role = parseCustomerRole(params.role);
  const page = parsePage(params.page);
  const { rows, total } = await listCustomers({ search, page, role });
  const query = { ...(search ? { q: search } : {}), ...(role !== "all" ? { role } : {}) };

  return (
    <>
      <PageHeader title="Customers" description="Every Foodeez account. Guest orders have no account and are not listed.">
        <SearchForm action="/platform/customers" search={search} placeholder="Email, name or account #" hidden={role !== "all" ? { role } : {}} />
      </PageHeader>
      <FilterTabs
        label="Account type"
        active={role}
        items={ROLES.map((item) => ({
          value: item.value,
          label: item.label,
          href: `/platform/customers?${new URLSearchParams({ ...(item.value !== "all" ? { role: item.value } : {}), ...(search ? { q: search } : {}) })}`,
        }))}
      />
      <p className="mb-3 text-sm text-gray-600" aria-live="polite">
        {total.toLocaleString("de-CH")} {total === 1 ? "account" : "accounts"}
        {search ? ` matching “${search}”` : ""}
      </p>
      {rows.length === 0 ? (
        <EmptyState>No accounts match. Try part of the email, the full name, or the account number.</EmptyState>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="hidden md:table-cell">Sign-in</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Paid orders</TableHead>
                <TableHead className="text-right">Spent</TableHead>
                <TableHead className="hidden lg:table-cell">Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="max-w-[12rem] sm:max-w-none">
                    <p className="truncate font-medium text-gray-950">{row.name || "—"}</p>
                    <p className="truncate text-xs text-gray-500">
                      {row.email || "—"} · #{row.id}
                    </p>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {row.isSuperAdmin ? <StatusPill tone="red">Super Admin</StatusPill> : null}
                      {row.isOwner ? <StatusPill tone="green">Owner</StatusPill> : null}
                      {!row.isSuperAdmin && !row.isOwner ? <StatusPill tone="gray">Customer</StatusPill> : null}
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-gray-600 md:table-cell">{row.signIn}</TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">{row.paidOrders}</TableCell>
                  <TableCell className="text-right tabular-nums">{chf.format(row.spent)}</TableCell>
                  <TableCell className="hidden text-gray-600 lg:table-cell">{formatDate(row.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Pagination basePath="/platform/customers" page={page} total={total} query={query} />
    </>
  );
}
