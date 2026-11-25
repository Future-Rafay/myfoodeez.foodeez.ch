import Link from "next/link";
import { EmptyState, PageHeader, Pagination } from "@/components/platform/PlatformUi";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { listAuditLog, parsePage, parseSearch } from "@/services/platform-data";

const dateTime = new Intl.DateTimeFormat("de-CH", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Zurich" });

function prettyJson(value: string) {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

const humanize = (action: string) => action.charAt(0) + action.slice(1).toLowerCase().replace(/_/g, " ");

/** Restaurants link to their detail page; other entities are shown as type and ID. */
function EntityLink({ type, id }: { type: string; id: string }) {
  if (type === "business") {
    return (
      <Link href={`/platform/restaurants/${id}`} className="font-medium text-foodeez-primary hover:underline">
        Restaurant #{id}
      </Link>
    );
  }
  if (type === "marketing_campaign") {
    return (
      <Link href={`/platform/marketing/${id}`} className="font-medium text-foodeez-primary hover:underline">
        Campaign #{id}
      </Link>
    );
  }
  return (
    <span className="text-gray-700">
      {type.replace(/_/g, " ")} #{id}
    </span>
  );
}

export default async function PlatformAuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePlatformAdmin();
  const params = await searchParams;
  const page = parsePage(params.page);
  const action = parseSearch(params.action);
  const entityType = parseSearch(params.type);
  const entityId = parseSearch(params.id);
  const { rows, total, actions } = await listAuditLog({ page, action, entityType, entityId });
  const query = { ...(action ? { action } : {}), ...(entityType ? { type: entityType } : {}), ...(entityId ? { id: entityId } : {}) };

  return (
    <>
      <PageHeader title="Audit log" description="Every change made in Super Admin, newest first. Entries cannot be edited or removed here." />
      <form action="/platform/audit" className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end" role="search">
        {entityType ? <input type="hidden" name="type" value={entityType} /> : null}
        {entityId ? <input type="hidden" name="id" value={entityId} /> : null}
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Action
          <select
            name="action"
            defaultValue={action}
            className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 shadow-xs focus-visible:border-foodeez-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foodeez-primary/20 sm:h-9 sm:w-72"
          >
            <option value="">All actions</option>
            {actions.map((item) => (
              <option key={item} value={item}>
                {humanize(item)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="h-10 rounded-md border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 shadow-xs hover:bg-gray-50 sm:h-9">
          Filter
        </button>
        {entityType || entityId || action ? (
          <Link href="/platform/audit" className="inline-flex h-10 items-center px-2 text-sm font-medium text-foodeez-primary hover:underline sm:h-9">
            Clear filters
          </Link>
        ) : null}
      </form>
      {entityType && entityId ? (
        <p className="mb-4 text-sm text-gray-600">
          Showing changes to <EntityLink type={entityType} id={entityId} /> only.
        </p>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState>No changes recorded{action || entityId ? " for this filter" : " yet"}.</EmptyState>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white shadow-sm">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:gap-6 sm:px-5">
              <time dateTime={row.createdAt.toISOString()} className="shrink-0 text-xs text-gray-500 sm:w-40 sm:pt-0.5 sm:text-sm">
                {dateTime.format(row.createdAt)}
              </time>
              <div className="min-w-0 flex-1 text-sm">
                <p className="text-gray-950">
                  <span className="font-medium">{humanize(row.action)}</span>
                  {" · "}
                  <EntityLink type={row.entityType} id={row.entityId} />
                </p>
                <p className="text-xs text-gray-500">by {row.actor}</p>
                {row.details ? (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs font-medium text-gray-600 hover:text-gray-950">Details</summary>
                    <pre className="mt-1 overflow-x-auto rounded-md bg-gray-50 p-2 text-xs text-gray-700">{prettyJson(row.details)}</pre>
                  </details>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Pagination basePath="/platform/audit" page={page} total={total} query={query} />
    </>
  );
}
