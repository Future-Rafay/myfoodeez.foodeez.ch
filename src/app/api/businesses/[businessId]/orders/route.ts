import { NextResponse } from "next/server";

// Customer checkout is owned by foodeez.ch. This retired admin endpoint used
// caller-supplied payment state and could create unverified paid orders.
export async function POST() {
  return NextResponse.json(
    { error: "This order endpoint is retired. Use the Foodeez customer checkout." },
    { status: 410 }
  );
}
