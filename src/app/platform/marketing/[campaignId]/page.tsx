import Link from "next/link";
import { notFound } from "next/navigation";
import CampaignForm from "@/components/platform/CampaignForm";
import ConfirmActionButton from "@/components/platform/ConfirmActionButton";
import { PageHeader, StatusPill, formatDate } from "@/components/platform/PlatformUi";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { restaurantClaimUrl } from "@/lib/customer-site";
import { MAX_SEND_BATCH, countAudience, readFilters, recipientCounts, renderCampaignEmail, type Audience } from "@/services/marketing-campaigns";
import { deleteCampaign, duplicateCampaignAction, excludeRecipientAction, retryFailed, sendBatch, sendTest } from "../actions";

const field = "mt-1 block h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm shadow-xs outline-none focus-visible:border-foodeez-primary focus-visible:ring-2 focus-visible:ring-foodeez-primary/20";

export default async function CampaignPage({ params, searchParams }: { params: Promise<{ campaignId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const id = Number((await params).campaignId);
  if (!Number.isInteger(id) || id <= 0 || id > 2_147_483_647) notFound();
  const campaign = await prisma.marketing_campaign.findUnique({ where: { CAMPAIGN_ID: id } });
  if (!campaign) notFound();

  const query = await searchParams;
  const single = (name: string) => (typeof query[name] === "string" ? (query[name] as string) : null);
  const filters = readFilters({ get: single });
  const size = Math.min(MAX_SEND_BATCH, Math.max(1, Number(single("size")) || 100));
  const audience = campaign.AUDIENCE as Audience;

  const [counts, remaining, recipients, sample] = await Promise.all([
    recipientCounts(id),
    countAudience(id, audience, filters),
    prisma.marketing_campaign_recipient.findMany({ where: { CAMPAIGN_ID: id }, orderBy: [{ STATUS: "asc" }, { RECIPIENT_ID: "desc" }], take: 100 }),
    prisma.business.findFirst({ where: { APPROVED: 1, STATUS: 1, NOT: { EMAIL_ADDRESS: null } }, orderBy: { BUSINESS_ID: "asc" }, select: { BUSINESS_ID: true, BUSINESS_NAME: true, ADDRESS_TOWN: true } }),
  ]);
  const preview = renderCampaignEmail(campaign, {
    recipientId: 0,
    email: "owner@restaurant.ch",
    name: sample?.BUSINESS_NAME ?? null,
    town: sample?.ADDRESS_TOWN ?? null,
    claimUrl: sample ? restaurantClaimUrl(sample.BUSINESS_NAME, sample.BUSINESS_ID) : null,
  });
  const done = single("done")?.slice(0, 200);
  const error = single("error")?.slice(0, 200);
  const isDraft = campaign.STATUS === "draft";
  const filterFields = {
    id,
    size,
    town: filters.town,
    unclaimed: filters.unclaimedOnly ? "1" : "0",
    live: filters.liveOnly ? "1" : "0",
    skipDays: filters.skipEmailedDays,
  };
  const batchSize = Math.min(size, remaining);

  return (
    <>
      <PageHeader title={campaign.NAME} description={`${audience === "subscriber" ? "Newsletter subscribers" : "Restaurants"} · ${isDraft ? "Draft" : `First sent ${formatDate(campaign.SENT_DATETIME)}`}`}>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/platform/marketing" className="inline-flex h-9 items-center rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 shadow-xs hover:bg-gray-50">
            All campaigns
          </Link>
          <ConfirmActionButton action={duplicateCampaignAction} fields={{ id }} label="Duplicate" />
        </div>
      </PageHeader>
      {done ? <p role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{done}</p> : null}
      {error ? <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          {isDraft ? (
            <CampaignForm campaign={{ id, name: campaign.NAME, subject: campaign.SUBJECT, audience: campaign.AUDIENCE, html: campaign.HTML }} />
          ) : (
            <p className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-600 shadow-sm">The content is locked after the first batch. Duplicate the campaign to send a changed version.</p>
          )}

          <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-950">2. Send a test</h2>
            <p className="text-sm text-gray-600">Sends this email to your own address, filled in with a real restaurant&apos;s name. The unsubscribe link in a test does nothing.</p>
            <ConfirmActionButton action={sendTest} fields={{ id }} label="Send me a test" />
          </section>

          <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-950">3. Send a batch</h2>
            <p className="text-sm text-gray-600">
              Each batch goes to addresses this campaign has not reached yet. Addresses on the do-not-email list are always skipped. Start with small batches and watch the failures.
            </p>
            {audience === "business" ? (
              <form className="grid gap-3 sm:grid-cols-2" action={`/platform/marketing/${id}`}>
                <label className="text-sm font-medium text-gray-900">
                  Town contains
                  <input name="town" defaultValue={filters.town} maxLength={100} className={field} placeholder="e.g. Zürich" />
                </label>
                <label className="text-sm font-medium text-gray-900">
                  Batch size (max {MAX_SEND_BATCH})
                  <input name="size" type="number" min={1} max={MAX_SEND_BATCH} defaultValue={size} className={field} />
                </label>
                <label className="text-sm font-medium text-gray-900">
                  Restaurants
                  <select name="unclaimed" defaultValue={filters.unclaimedOnly ? "1" : "0"} className={field}>
                    <option value="1">Only unclaimed (no owner yet)</option>
                    <option value="0">All, including claimed</option>
                  </select>
                </label>
                <label className="text-sm font-medium text-gray-900">
                  Visibility
                  <select name="live" defaultValue={filters.liveOnly ? "1" : "0"} className={field}>
                    <option value="1">Only live on foodeez.ch</option>
                    <option value="0">All, including hidden</option>
                  </select>
                </label>
                <label className="text-sm font-medium text-gray-900">
                  Skip addresses emailed in the last (days)
                  <input name="skipDays" type="number" min={0} max={365} defaultValue={filters.skipEmailedDays} className={field} />
                </label>
                <div className="flex items-end">
                  <button type="submit" className="h-9 rounded-md border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 shadow-xs hover:bg-gray-50">
                    Update count
                  </button>
                </div>
              </form>
            ) : (
              <form className="flex items-end gap-3" action={`/platform/marketing/${id}`}>
                <label className="text-sm font-medium text-gray-900">
                  Batch size (max {MAX_SEND_BATCH})
                  <input name="size" type="number" min={1} max={MAX_SEND_BATCH} defaultValue={size} className={field} />
                </label>
                <button type="submit" className="h-9 rounded-md border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 shadow-xs hover:bg-gray-50">
                  Update count
                </button>
              </form>
            )}
            <p className="text-sm text-gray-900">
              <strong>{remaining.toLocaleString("de-CH")}</strong> address{remaining === 1 ? "" : "es"} match and have not received this campaign.
            </p>
            {batchSize > 0 ? (
              <ConfirmActionButton
                action={sendBatch}
                fields={filterFields}
                label={`Send to the next ${batchSize}`}
                tone="primary"
                confirm={{
                  title: `Send "${campaign.SUBJECT}" to ${batchSize} address${batchSize === 1 ? "" : "es"}?`,
                  description: `${isDraft ? "This locks the campaign's content. " : ""}Emails cannot be recalled once they are sent.`,
                  confirmLabel: "Send now",
                }}
              />
            ) : null}
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-950">Preview</h2>
            <p className="mt-1 text-sm text-gray-600">Subject: {preview.subject}</p>
            <iframe title="Email preview" sandbox="" srcDoc={preview.html} className="mt-3 h-[560px] w-full rounded-lg border border-gray-200 bg-gray-100" />
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-950">Results</h2>
              {counts.failed ? <ConfirmActionButton action={retryFailed} fields={{ id }} label={`Retry ${counts.failed} failed`} /> : null}
            </div>
            <dl className="mt-3 grid grid-cols-4 gap-3 text-center text-sm">
              {(["sent", "pending", "failed", "cancelled"] as const).map((status) => (
                <div key={status} className="rounded-lg bg-gray-50 p-3">
                  <dt className="capitalize text-gray-600">{status === "cancelled" ? "Skipped" : status}</dt>
                  <dd className="text-xl font-semibold tabular-nums text-gray-950">{counts[status] ?? 0}</dd>
                </div>
              ))}
            </dl>
            {recipients.length ? (
              <div className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recipients.map((row) => (
                      <TableRow key={row.RECIPIENT_ID}>
                        <TableCell>
                          <p className="max-w-56 truncate font-medium text-gray-950">{row.NAME || row.EMAIL}</p>
                          <p className="max-w-56 truncate text-xs text-gray-500">{row.EMAIL}</p>
                        </TableCell>
                        <TableCell>
                          {row.STATUS === "sent" ? <StatusPill tone="green">Sent</StatusPill> : row.STATUS === "failed" ? <StatusPill tone="red">Failed</StatusPill> : row.STATUS === "pending" ? <StatusPill tone="amber">Pending</StatusPill> : <StatusPill tone="gray">Skipped</StatusPill>}
                          {row.ERROR ? <p className="mt-1 max-w-48 truncate text-xs text-gray-500" title={row.ERROR}>{row.ERROR}</p> : null}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.STATUS === "failed" ? (
                            <ConfirmActionButton
                              action={excludeRecipientAction}
                              fields={{ id, recipientId: row.RECIPIENT_ID }}
                              label="Never email"
                              tone="danger"
                              confirm={{ title: `Never email ${row.EMAIL} again?`, description: "The address goes on the do-not-email list and is skipped by every future campaign.", confirmLabel: "Add to list" }}
                            />
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="mt-2 text-xs text-gray-500">Skipped and failed first, then the newest; at most 100 shown.</p>
              </div>
            ) : null}
          </section>

          {isDraft ? (
            <div className="flex justify-end border-t border-gray-200 pt-6">
              <ConfirmActionButton
                action={deleteCampaign}
                fields={{ id }}
                label="Delete draft"
                tone="danger"
                confirm={{ title: "Delete this draft?", description: "The draft is removed permanently. Sent campaigns cannot be deleted.", confirmLabel: "Delete draft" }}
              />
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
