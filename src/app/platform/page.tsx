import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { FilterTabs, PageHeader } from "@/components/platform/PlatformUi";
import { KPI_RANGES, getPlatformKpis, getPlatformOverview, parseKpiRange } from "@/services/platform-data";
import { cn } from "@/lib/utils";
import { requirePlatformAdmin } from "@/lib/platform-admin";

const chf = new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" });

/** "+12% vs previous 30 days", or a plain note when the previous period was empty. */
function change(current: number, previous: number, days: number) {
  if (previous === 0) return { text: current === 0 ? `Same as previous ${days} days` : `New vs previous ${days} days`, tone: "gray" as const };
  const percent = Math.round(((current - previous) / previous) * 100);
  return {
    text: `${percent > 0 ? "+" : ""}${percent}% vs previous ${days} days`,
    tone: percent > 0 ? ("green" as const) : percent < 0 ? ("red" as const) : ("gray" as const),
  };
}

export default async function PlatformOverviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePlatformAdmin();
  const params = await searchParams;
  const days = parseKpiRange(params.range);
  const [o, kpi] = await Promise.all([getPlatformOverview(), getPlatformKpis(days)]);
  const activity = [
    { label: "New sign-ups", value: kpi.current.signups.toLocaleString("de-CH"), delta: change(kpi.current.signups, kpi.previous.signups, days) },
    { label: "Orders", value: kpi.current.orders.toLocaleString("de-CH"), delta: change(kpi.current.orders, kpi.previous.orders, days) },
    { label: "Revenue", value: chf.format(kpi.current.revenue), delta: change(kpi.current.revenue, kpi.previous.revenue, days) },
    { label: "New restaurants", value: kpi.current.restaurants.toLocaleString("de-CH"), delta: change(kpi.current.restaurants, kpi.previous.restaurants, days) },
  ];
  const cards = [
    { label: "Restaurants", value: o.restaurants, href: "/platform/restaurants" },
    { label: "Live (approved and on)", value: o.live, href: "/platform/restaurants?filter=live" },
    { label: "Waiting for approval", value: o.pending, href: "/platform/restaurants?filter=pending" },
    { label: "Approved but switched off", value: o.off, href: "/platform/restaurants?filter=off" },
    { label: "Onboarding requests", value: o.requests, href: "/platform/requests" },
    { label: "Customer accounts", value: o.customers, href: "/platform/customers" },
    { label: "Restaurant owners", value: o.owners, href: "/platform/customers?role=owners" },
    { label: "Reviews and stories to moderate", value: o.reviews + o.platformReviews + o.stories, href: "/platform/moderation" },
  ];
  const tones = { green: "text-green-700", red: "text-red-700", gray: "text-gray-500" };

  return (
    <>
      <PageHeader title="Overview" description="The whole Foodeez platform at a glance." />

      <section aria-labelledby="activity-heading" className="mb-8">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="activity-heading" className="text-lg font-semibold text-gray-950">
            Activity, last {days} days
          </h2>
          <FilterTabs
            label="Time range"
            active={String(days)}
            items={KPI_RANGES.map((range) => ({ value: String(range), label: `${range} days`, href: `/platform?range=${range}` }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {activity.map((item) => (
            <Card key={item.label} className="border-gray-200 bg-white shadow-sm">
              <CardContent className="p-4 sm:p-5">
                <p className="text-sm text-gray-600">{item.label}</p>
                <p className="mt-2 text-xl font-semibold text-gray-950 sm:text-3xl">{item.value}</p>
                <p className={cn("mt-1 text-xs font-medium", tones[item.delta.tone])}>{item.delta.text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-500">Revenue leaves out rejected, refunded and failed orders, the same rule as the restaurant dashboards.</p>
      </section>

      <h2 className="mb-3 text-lg font-semibold text-gray-950">Platform today</h2>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {cards.map((card) => (
          <Link key={card.label} href={card.href} className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foodeez-primary/30">
            <Card className="h-full border-gray-200 bg-white shadow-sm transition-colors hover:border-foodeez-primary/30">
              <CardContent className="p-4 sm:p-5">
                <p className="text-sm text-gray-600">{card.label}</p>
                <p className="mt-2 text-xl font-semibold text-gray-950 sm:text-3xl">{card.value.toLocaleString("de-CH")}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
