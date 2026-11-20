/* eslint-disable @next/next/no-img-element -- review media are arbitrary S3 URLs shown as small previews */
import Link from "next/link";
import ConfirmActionButton from "@/components/platform/ConfirmActionButton";
import { EmptyState, PageHeader, Pagination, formatDate } from "@/components/platform/PlatformUi";
import { resolveMediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";
import { listPendingContent, parsePage, type ModerationKind } from "@/services/platform-data";
import { moderateContent } from "../actions";

const TABS: { value: ModerationKind; label: string }[] = [
  { value: "reviews", label: "Restaurant reviews" },
  { value: "platform", label: "Foodeez reviews" },
  { value: "stories", label: "Food stories" },
];

export default async function PlatformModerationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const kind = TABS.find((tab) => tab.value === params.kind)?.value ?? "reviews";
  const page = parsePage(params.page);
  const { rows, total } = await listPendingContent(kind, page);

  return (
    <>
      <PageHeader title="Moderation" description="New and edited reviews and stories stay hidden on foodeez.ch until they are approved here. The oldest are shown first." />
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/platform/moderation?kind=${tab.value}`}
            className={cn(
              "rounded-full border px-3 py-1 text-sm font-medium",
              kind === tab.value ? "border-foodeez-primary bg-foodeez-primary text-white" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <EmptyState>Nothing waiting. Everything has been moderated.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-950">{row.heading}</p>
                  <p className="text-xs text-gray-500">
                    {row.author} · {formatDate(row.createdAt)}
                  </p>
                  <p className="mt-3 whitespace-pre-line break-words text-sm text-gray-700">{row.text}</p>
                  {row.media.length || row.video ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {row.media.map((src) => (
                        <a key={src} href={resolveMediaUrl(src) ?? src} target="_blank" rel="noreferrer">
                          <img src={resolveMediaUrl(src) ?? src} alt="" className="size-20 rounded-md border border-gray-200 object-cover" />
                        </a>
                      ))}
                      {row.video ? (
                        <a href={resolveMediaUrl(row.video) ?? row.video} target="_blank" rel="noreferrer" className="flex size-20 items-center justify-center rounded-md border border-gray-200 text-xs text-gray-600">
                          Video
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {/* Approve is the routine action; Reject sits apart and asks first. */}
                <div className="flex shrink-0 items-center gap-10">
                  <ConfirmActionButton action={moderateContent} fields={{ kind, id: row.id, decision: "approve" }} label="Approve" tone="primary" />
                  <ConfirmActionButton
                    action={moderateContent}
                    fields={{ kind, id: row.id, decision: "reject" }}
                    label="Reject"
                    tone="danger"
                    confirm={{ title: "Reject this?", description: "It stays hidden from foodeez.ch. It is not deleted, and the author can still edit it.", confirmLabel: "Reject" }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Pagination basePath="/platform/moderation" page={page} total={total} query={{ kind }} />
    </>
  );
}
