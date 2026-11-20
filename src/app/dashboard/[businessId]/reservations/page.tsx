import { notFound } from "next/navigation";
import ConfirmActionButton from "@/components/platform/ConfirmActionButton";
import { EmptyState, FilterTabs, PageHeader, StatusPill } from "@/components/platform/PlatformUi";
import { listReservations, type ReservationView } from "@/services/reservations-management";
import { answerReservation } from "./actions";

const VIEWS: { value: ReservationView; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
];

// RESERVATION_DATE is a plain date stored at UTC midnight, so it is formatted in UTC to keep the same day.
const formatDay = (value: Date | null) =>
  value ? new Intl.DateTimeFormat("de-CH", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(value) : "—";

export default async function ReservationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const businessId = Number((await params).businessId);
  if (!Number.isInteger(businessId) || businessId <= 0) notFound();
  const query = await searchParams;
  const view = VIEWS.find((item) => item.value === query.view)?.value ?? "upcoming";
  let reservations;
  try {
    reservations = await listReservations(businessId, view);
  } catch (error) {
    if (error instanceof Error && (error.message === "Forbidden" || error.message === "Unauthorized")) notFound();
    throw error;
  }
  const done = typeof query.done === "string" ? query.done.slice(0, 200) : undefined;
  const error = typeof query.error === "string" ? query.error.slice(0, 200) : undefined;

  return (
    <>
      <PageHeader level="h2" title="Reservations" description="Table requests from foodeez.ch. Confirm or decline each one; the guest gets an email with your answer." />
      {done ? <p role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{done}</p> : null}
      {error ? <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <FilterTabs
        label="Reservation views"
        active={view}
        items={VIEWS.map((item) => ({ value: item.value, label: item.label, href: `/dashboard/${businessId}/reservations?view=${item.value}` }))}
      />
      {reservations.length === 0 ? (
        <EmptyState>{view === "upcoming" ? "No upcoming reservations." : "No past reservations."}</EmptyState>
      ) : (
        <ul className="space-y-3">
          {reservations.map((row) => (
            <li key={row.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-semibold text-gray-950 tabular-nums">
                      {formatDay(row.date)} · {row.time || "—"}
                    </p>
                    {row.status === "confirmed" ? <StatusPill tone="green">Confirmed</StatusPill> : row.status === "declined" ? <StatusPill tone="gray">Declined</StatusPill> : <StatusPill tone="amber">Waiting for you</StatusPill>}
                  </div>
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">{row.name}</span> · {row.guests ?? "?"} {row.guests === 1 ? "guest" : "guests"}
                  </p>
                  <p className="text-sm text-gray-600">
                    {row.phone || "—"} · {row.email || "—"}
                  </p>
                  {row.occasion ? <p className="text-sm text-gray-600">Occasion: {row.occasion}</p> : null}
                  {row.requests ? <p className="text-sm text-gray-600">Requests: {row.requests}</p> : null}
                </div>
                {row.status === "pending" && view === "upcoming" ? (
                  /* Confirm is the routine action; Decline sits apart and asks first. */
                  <div className="flex shrink-0 items-center gap-10">
                    <ConfirmActionButton action={answerReservation} fields={{ businessId, reservationId: row.id, decision: "confirmed" }} label="Confirm" tone="primary" />
                    <ConfirmActionButton
                      action={answerReservation}
                      fields={{ businessId, reservationId: row.id, decision: "declined" }}
                      label="Decline"
                      tone="danger"
                      confirm={{ title: `Decline ${row.name}'s reservation?`, description: "The guest is emailed that you cannot take this reservation. This cannot be undone here.", confirmLabel: "Decline" }}
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
