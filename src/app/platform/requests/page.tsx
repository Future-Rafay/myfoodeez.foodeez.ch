import Link from "next/link";
import ConfirmActionButton from "@/components/platform/ConfirmActionButton";
import { EmptyState, PageHeader, StatusPill, formatDate } from "@/components/platform/PlatformUi";
import { restaurantClaimUrl, toExternalUrl } from "@/lib/customer-site";
import { cn } from "@/lib/utils";
import { listOnboardingRequests, type RequestView } from "@/services/platform-onboarding";
import { approveRequest, rejectRequest } from "../actions";

const VIEWS: { value: RequestView; label: string }[] = [
  { value: "pending", label: "Waiting for review" },
  { value: "email_pending", label: "Code sent, not confirmed" },
  { value: "done", label: "Decided" },
];

const NOTICES: Record<string, string> = {
  approved: "Approved. The owner has been emailed and can sign in to the restaurant dashboard.",
  "approved-no-email": "Approved, but the email to the owner could not be sent. Let them know by hand.",
  rejected: "Rejected. The person has been emailed.",
  "rejected-no-email": "Rejected, but the email could not be sent.",
};

export default async function PlatformRequestsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const view = VIEWS.find((item) => item.value === params.view)?.value ?? "pending";
  const requests = await listOnboardingRequests(view);
  const notice = typeof params.done === "string" ? NOTICES[params.done] : undefined;
  const error = typeof params.error === "string" ? params.error.slice(0, 200) : undefined;

  return (
    <>
      <PageHeader
        title="Requests"
        description="Restaurants registered on foodeez.ch, and owners claiming an existing restaurant. Approving gives the account access to the restaurant dashboard; a registration also goes live."
      />
      {notice ? <p role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</p> : null}
      {error ? <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <div className="mb-4 flex flex-wrap gap-2">
        {VIEWS.map((item) => (
          <Link
            key={item.value}
            href={`/platform/requests?view=${item.value}`}
            className={cn(
              "rounded-full border px-3 py-1 text-sm font-medium",
              view === item.value ? "border-foodeez-primary bg-foodeez-primary text-white" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>
      {requests.length === 0 ? (
        <EmptyState>No requests here.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {requests.map((request) => (
            <li key={request.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill tone={request.type === "register" ? "amber" : "green"}>{request.type === "register" ? "New restaurant" : "Claim"}</StatusPill>
                    {request.type === "claim" ? (
                      request.emailVerified ? <StatusPill tone="green">Restaurant email confirmed</StatusPill> : <StatusPill tone="red">Email not confirmed: check by hand</StatusPill>
                    ) : null}
                    {request.status === "approved" ? <StatusPill tone="green">Approved</StatusPill> : null}
                    {request.status === "rejected" ? <StatusPill tone="gray">Rejected</StatusPill> : null}
                    {request.business.hasOwner && request.status === "pending" ? <StatusPill tone="red">Already has an owner</StatusPill> : null}
                  </div>
                  <p className="text-lg font-semibold text-gray-950">
                    {/* Only live restaurants have a public page; a new registration is hidden until approved. */}
                    {request.business.live ? (
                      <a href={restaurantClaimUrl(request.business.name, request.business.id)} target="_blank" rel="noreferrer" className="hover:text-foodeez-primary hover:underline">
                        {request.business.name}
                      </a>
                    ) : (
                      request.business.name
                    )}
                    <span className="ml-2 text-sm font-normal text-gray-500">#{request.business.id}</span>
                  </p>
                  <dl className="grid gap-x-6 gap-y-1 text-sm text-gray-700 sm:grid-cols-2">
                    <div><dt className="inline text-gray-500">Requested by: </dt><dd className="inline">{request.account.name || "—"} ({request.account.email || `account #${request.account.id}`})</dd></div>
                    <div><dt className="inline text-gray-500">Restaurant email: </dt><dd className="inline">{request.business.email || "none on file"}</dd></div>
                    <div><dt className="inline text-gray-500">Address: </dt><dd className="inline">{request.business.address || "—"}</dd></div>
                    <div><dt className="inline text-gray-500">Phone: </dt><dd className="inline">{request.business.phone || request.phone || "—"}</dd></div>
                    {request.business.website ? (
                      <div><dt className="inline text-gray-500">Website: </dt><dd className="inline"><a className="text-foodeez-primary hover:underline" href={toExternalUrl(request.business.website)} target="_blank" rel="noreferrer">{request.business.website}</a></dd></div>
                    ) : null}
                    <div><dt className="inline text-gray-500">Received: </dt><dd className="inline">{formatDate(request.createdAt)}</dd></div>
                    {request.reviewedAt ? <div><dt className="inline text-gray-500">Decided: </dt><dd className="inline">{formatDate(request.reviewedAt)}</dd></div> : null}
                  </dl>
                  {request.type === "register" && request.business.description ? <p className="text-sm text-gray-600">{request.business.description}</p> : null}
                  {request.note ? <p className="text-sm text-gray-600">Note: {request.note}</p> : null}
                </div>
                {request.status === "pending" || request.status === "email_pending" ? (
                  /* Approve is the routine action; Reject sits apart and asks for a reason first. */
                  <div className="flex shrink-0 items-center gap-10">
                    {request.status === "pending" ? (
                      <ConfirmActionButton
                        action={approveRequest}
                        fields={{ requestId: request.id }}
                        label="Approve"
                        tone="primary"
                        confirm={{
                          title: `Approve ${request.business.name}?`,
                          description: `${request.account.email || "This account"} becomes an owner of this restaurant and can change its menu, settings and orders.${request.type === "register" ? " The restaurant also goes live on foodeez.ch." : ""}`,
                          confirmLabel: "Approve",
                        }}
                      />
                    ) : null}
                    <ConfirmActionButton
                      action={rejectRequest}
                      fields={{ requestId: request.id }}
                      label="Reject"
                      tone="danger"
                      confirm={{ title: "Reject this request?", description: "The person is emailed. A rejected registration stays hidden and is not deleted.", confirmLabel: "Reject", noteLabel: "Reason (sent to them, optional)" }}
                    />
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
