import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader, StatusPill, formatDate } from "@/components/platform/PlatformUi";
import { STARTER_TEMPLATES } from "@/lib/marketing";
import { prisma } from "@/lib/prisma";

export default async function PlatformMarketingPage() {
  const [campaigns, counts, suppressed] = await Promise.all([
    prisma.marketing_campaign.findMany({ orderBy: { CAMPAIGN_ID: "desc" }, take: 100 }),
    prisma.marketing_campaign_recipient.groupBy({ by: ["CAMPAIGN_ID", "STATUS"], _count: { _all: true } }),
    prisma.email_suppression.count(),
  ]);
  const stats = (id: number, status: string) => counts.find((row) => row.CAMPAIGN_ID === id && row.STATUS === status)?._count._all ?? 0;

  return (
    <>
      <PageHeader title="Marketing" description={`Invite restaurants to claim their profile and email newsletter subscribers. ${suppressed.toLocaleString("de-CH")} address${suppressed === 1 ? " is" : "es are"} on the do-not-email list.`}>
        <div className="flex flex-wrap gap-2">
          {Object.entries(STARTER_TEMPLATES).map(([key, template]) => (
            <Link key={key} href={`/platform/marketing/new?template=${key}`} className="inline-flex h-9 items-center rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 shadow-xs hover:bg-gray-50">
              New: {template.label}
            </Link>
          ))}
        </div>
      </PageHeader>
      {campaigns.length === 0 ? (
        <EmptyState>No campaigns yet. Start with the restaurant invitation template.</EmptyState>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Sent</TableHead>
                <TableHead className="text-right">Failed</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign) => (
                <TableRow key={campaign.CAMPAIGN_ID}>
                  <TableCell>
                    <Link href={`/platform/marketing/${campaign.CAMPAIGN_ID}`} className="font-medium text-gray-950 hover:text-foodeez-primary hover:underline">
                      {campaign.NAME}
                    </Link>
                    <p className="max-w-md truncate text-xs text-gray-500">{campaign.SUBJECT}</p>
                  </TableCell>
                  <TableCell className="text-gray-600">{campaign.AUDIENCE === "subscriber" ? "Subscribers" : "Restaurants"}</TableCell>
                  <TableCell>
                    {campaign.STATUS === "draft" ? <StatusPill tone="gray">Draft</StatusPill> : campaign.STATUS === "sending" ? <StatusPill tone="amber">Sending</StatusPill> : <StatusPill tone="green">Sent</StatusPill>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{stats(campaign.CAMPAIGN_ID, "sent")}</TableCell>
                  <TableCell className="text-right tabular-nums">{stats(campaign.CAMPAIGN_ID, "failed")}</TableCell>
                  <TableCell className="text-gray-600">{formatDate(campaign.UPDATED_DATETIME)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
