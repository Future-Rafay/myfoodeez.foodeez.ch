import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader, Pagination, SearchForm, StatusPill, formatDate } from "@/components/platform/PlatformUi";
import { listCustomers, parsePage, parseSearch } from "@/services/platform-data";

const chf = new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" });

export default async function PlatformCustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const search = parseSearch(params.q);
  const page = parsePage(params.page);
  const { rows, total } = await listCustomers({ search, page });

  return (
    <>
      <PageHeader title="Customers" description="Every Foodeez account. Guest orders have no account and are not listed.">
        <SearchForm action="/platform/customers" search={search} placeholder="Email or name" />
      </PageHeader>
      {rows.length === 0 ? (
        <EmptyState>No accounts match.</EmptyState>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Sign-in</TableHead>
                <TableHead className="text-right">Paid orders</TableHead>
                <TableHead className="text-right">Spent</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <p className="font-medium text-gray-950">{row.name || "—"}</p>
                    <p className="text-xs text-gray-500">
                      {row.email || "—"} · #{row.id}
                    </p>
                  </TableCell>
                  <TableCell className="space-x-1">
                    {row.isSuperAdmin ? <StatusPill tone="red">Super Admin</StatusPill> : null}
                    {row.isOwner ? <StatusPill tone="green">Owner</StatusPill> : null}
                    {!row.isSuperAdmin && !row.isOwner ? <StatusPill tone="gray">Customer</StatusPill> : null}
                  </TableCell>
                  <TableCell className="text-gray-600">{row.signIn}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.paidOrders}</TableCell>
                  <TableCell className="text-right tabular-nums">{chf.format(row.spent)}</TableCell>
                  <TableCell className="text-gray-600">{formatDate(row.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Pagination basePath="/platform/customers" page={page} total={total} query={search ? { q: search } : {}} />
    </>
  );
}
