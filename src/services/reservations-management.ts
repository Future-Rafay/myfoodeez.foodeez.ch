import { prisma } from "@/lib/prisma";
import { sendSimpleEmail } from "@/lib/email";
import { requireBusinessAccess } from "@/services/admin-data";

// Table reservations made on foodeez.ch (reserve_table). STATUS: 1 waiting for the restaurant, 2 confirmed, 3 declined.
export const RESERVATION_STATUS = { pending: 1, confirmed: 2, declined: 3 } as const;

export type ReservationView = "upcoming" | "past";

/** Today in Zurich as a plain date, so "upcoming" switches at Swiss midnight, not UTC midnight. */
export function zurichToday(now = new Date()) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich" }).format(now);
  return new Date(`${day}T00:00:00.000Z`);
}

export async function listReservations(businessId: number, view: ReservationView) {
  await requireBusinessAccess(businessId);
  const today = zurichToday();
  const rows = await prisma.reserve_table.findMany({
    where: { BUSINESS_ID: businessId, RESERVATION_DATE: view === "upcoming" ? { gte: today } : { lt: today } },
    orderBy: view === "upcoming" ? [{ RESERVATION_DATE: "asc" }, { EXPECTED_TIME: "asc" }] : [{ RESERVATION_DATE: "desc" }, { EXPECTED_TIME: "desc" }],
    take: 200,
  });
  return rows.map((row) => ({
    id: row.RESERVE_TABLE_ID,
    name: row.RESERVATION_AS_NAME || "Guest",
    email: row.EMAIL_ADDRESS,
    phone: row.PHONE_NUMBER,
    date: row.RESERVATION_DATE,
    time: row.EXPECTED_TIME,
    guests: row.RESERVATION_NUMBER,
    occasion: row.RESERVATION_FOR,
    requests: row.REMARKS,
    status: row.STATUS === RESERVATION_STATUS.confirmed ? "confirmed" : row.STATUS === RESERVATION_STATUS.declined ? "declined" : "pending",
    createdAt: row.CREATION_DATETIME,
  }));
}

export class ReservationError extends Error {}

/** Confirms or declines a waiting reservation and emails the customer. A failed email does not undo the decision. */
export async function decideReservation(businessId: number, reservationId: number, decision: "confirmed" | "declined") {
  await requireBusinessAccess(businessId);
  // updateMany scoped to this restaurant and still waiting, so an id from another restaurant or a second click changes nothing.
  const updated = await prisma.reserve_table.updateMany({
    where: { RESERVE_TABLE_ID: reservationId, BUSINESS_ID: businessId, STATUS: RESERVATION_STATUS.pending },
    data: { STATUS: RESERVATION_STATUS[decision] },
  });
  if (!updated.count) throw new ReservationError("This reservation was already answered.");

  const [reservation, business] = await Promise.all([
    prisma.reserve_table.findUnique({ where: { RESERVE_TABLE_ID: reservationId } }),
    prisma.business.findUnique({ where: { BUSINESS_ID: businessId }, select: { BUSINESS_NAME: true, PHONE_NUMBER: true } }),
  ]);
  if (!reservation?.EMAIL_ADDRESS) return { emailed: false };
  const name = business?.BUSINESS_NAME || "the restaurant";
  const when = `${reservation.RESERVATION_DATE ? new Intl.DateTimeFormat("de-CH", { dateStyle: "long", timeZone: "UTC" }).format(reservation.RESERVATION_DATE) : ""} at ${reservation.EXPECTED_TIME ?? ""}`.trim();
  try {
    await sendSimpleEmail({
      to: reservation.EMAIL_ADDRESS,
      subject: decision === "confirmed" ? `Your table at ${name} is confirmed` : `Your reservation request at ${name}`,
      paragraphs:
        decision === "confirmed"
          ? [`Good news: ${name} confirmed your table for ${reservation.RESERVATION_NUMBER ?? ""} on ${when}.`, "See you there!"]
          : [
              `Unfortunately ${name} cannot take your reservation for ${reservation.RESERVATION_NUMBER ?? ""} on ${when}.`,
              business?.PHONE_NUMBER ? `You can call the restaurant on ${business.PHONE_NUMBER} to find another time.` : "Please try another date or time on Foodeez.",
            ],
    });
    return { emailed: true };
  } catch (error) {
    console.error("Reservation answer email failed:", error);
    return { emailed: false };
  }
}
