import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/platform/PlatformUi";
import { getPlatformOverview } from "@/services/platform-data";

export default async function PlatformOverviewPage() {
  const o = await getPlatformOverview();
  const cards = [
    { label: "Restaurants", value: o.restaurants, href: "/platform/restaurants" },
    { label: "Live (approved and on)", value: o.live, href: "/platform/restaurants?filter=live" },
    { label: "Waiting for approval", value: o.pending, href: "/platform/restaurants?filter=pending" },
    { label: "Approved but switched off", value: o.off, href: "/platform/restaurants?filter=off" },
    { label: "Onboarding requests", value: o.requests, href: "/platform/requests" },
    { label: "Customer accounts", value: o.customers, href: "/platform/customers" },
    { label: "Restaurant owners", value: o.owners, href: "/platform/customers" },
    { label: "Reviews and stories to moderate", value: o.reviews + o.platformReviews + o.stories, href: "/platform/moderation" },
  ];
  return (
    <>
      <PageHeader title="Overview" description="The whole Foodeez platform at a glance." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Link key={card.label} href={card.href} className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foodeez-primary/30">
            <Card className="h-full border-gray-200 bg-white shadow-sm transition-colors hover:border-foodeez-primary/30">
              <CardContent className="p-5">
                <p className="text-sm text-gray-600">{card.label}</p>
                <p className="mt-2 text-3xl font-semibold text-gray-950">{card.value.toLocaleString("de-CH")}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
