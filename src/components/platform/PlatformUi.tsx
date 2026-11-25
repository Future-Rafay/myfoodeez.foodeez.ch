import Link from "next/link";
import { cn } from "@/lib/utils";
import { PLATFORM_PAGE_SIZE } from "@/services/platform-data";

/** `level="h2"` inside the restaurant dashboard, whose header already renders the page h1. */
export function PageHeader({ title, description, children, level = "h1" }: { title: string; description?: string; children?: React.ReactNode; level?: "h1" | "h2" }) {
  const Heading = level;
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <Heading className="text-2xl font-semibold text-gray-950">{title}</Heading>
        {description ? <p className="mt-1 text-sm text-gray-600">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

export function StatusPill({ tone, children }: { tone: "green" | "amber" | "gray" | "red"; children: React.ReactNode }) {
  const tones = {
    green: "border-green-200 bg-green-50 text-green-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    gray: "border-gray-200 bg-gray-50 text-gray-600",
    red: "border-red-200 bg-red-50 text-red-700",
  };
  return <span className={cn("inline-flex rounded-md border px-2 py-0.5 text-xs font-medium", tones[tone])}>{children}</span>;
}

/** Link-based filter tabs shared by the list pages; tall enough to tap on a phone. */
export function FilterTabs({ items, active, label }: { items: { value: string; label: string; href: string }[]; active: string; label: string }) {
  return (
    <nav aria-label={label} className="mb-4 flex flex-wrap gap-2">
      {items.map((item) => (
        <Link
          key={item.value}
          href={item.href}
          aria-current={active === item.value ? "page" : undefined}
          className={cn(
            "inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-medium transition-colors sm:min-h-9",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foodeez-primary/40 focus-visible:ring-offset-1",
            active === item.value ? "border-foodeez-primary bg-foodeez-primary text-white" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

/** GET search form: keeps the other query values as hidden fields. */
export function SearchForm({ action, search, placeholder, hidden = {} }: { action: string; search: string; placeholder: string; hidden?: Record<string, string> }) {
  return (
    <form action={action} className="flex w-full gap-2 sm:w-auto" role="search">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <label className="sr-only" htmlFor="platform-search">Search</label>
      <input
        id="platform-search"
        name="q"
        defaultValue={search}
        placeholder={placeholder}
        maxLength={100}
        className="h-9 w-full min-w-0 rounded-md border border-gray-200 bg-white px-3 text-sm shadow-xs outline-none focus-visible:border-foodeez-primary focus-visible:ring-2 focus-visible:ring-foodeez-primary/20 sm:w-72"
      />
      <button type="submit" className="h-9 rounded-md border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 shadow-xs hover:bg-gray-50">
        Search
      </button>
    </form>
  );
}

export function Pagination({ basePath, page, total, query }: { basePath: string; page: number; total: number; query: Record<string, string> }) {
  const pages = Math.max(1, Math.ceil(total / PLATFORM_PAGE_SIZE));
  const href = (target: number) => `${basePath}?${new URLSearchParams({ ...query, page: String(target) })}`;
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
      <p>{total.toLocaleString("de-CH")} total · page {Math.min(page, pages)} of {pages}</p>
      <div className="flex gap-2">
        {page > 1 ? <Link className="rounded-md border border-gray-200 bg-white px-3 py-1.5 hover:bg-gray-50" href={href(page - 1)}>Previous</Link> : null}
        {page < pages ? <Link className="rounded-md border border-gray-200 bg-white px-3 py-1.5 hover:bg-gray-50" href={href(page + 1)}>Next</Link> : null}
      </div>
    </div>
  );
}

export const formatDate = (value: Date | null | undefined) =>
  value ? new Intl.DateTimeFormat("de-CH", { dateStyle: "medium", timeZone: "Europe/Zurich" }).format(value) : "—";

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-600">{children}</div>;
}
