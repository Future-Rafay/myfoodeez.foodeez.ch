"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ReservationError, decideReservation } from "@/services/reservations-management";

// Callable from any browser: decideReservation checks that the signed-in owner owns this restaurant.
export async function answerReservation(formData: FormData) {
  const businessId = Number(formData.get("businessId"));
  const reservationId = Number(formData.get("reservationId"));
  const decision = formData.get("decision");
  if (!Number.isInteger(businessId) || businessId <= 0 || !Number.isInteger(reservationId) || reservationId <= 0 || (decision !== "confirmed" && decision !== "declined")) {
    throw new Error("Invalid reservation answer");
  }
  const base = `/dashboard/${businessId}/reservations`;
  let target: string;
  try {
    const { emailed } = await decideReservation(businessId, reservationId, decision);
    const done = decision === "confirmed" ? "Reservation confirmed." : "Reservation declined.";
    target = `${base}?${new URLSearchParams({ done: emailed ? `${done} The guest has been emailed.` : `${done} The email to the guest could not be sent, so please let them know.` })}`;
  } catch (error) {
    if (!(error instanceof ReservationError)) throw error;
    target = `${base}?${new URLSearchParams({ error: error.message })}`;
  }
  revalidatePath(base);
  redirect(target);
}
