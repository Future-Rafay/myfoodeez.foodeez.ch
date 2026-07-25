import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getOwnedBusinesses } from "@/services/admin-data";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const businesses = (await getOwnedBusinesses())
      .filter((business) => business.status === "active")
      .map((business) => ({
        id: business.id,
        name: business.name,
        shortName: business.shortName,
        logo: business.logo || business.imageUrl,
        address: {
          street: business.addressStreet,
          zip: business.addressZip,
          town: business.town,
          country: business.country,
        },
        phone: business.phone,
        email: business.email,
      }));

    return NextResponse.json({
      user: {
        id: session.user.id,
        name: session.user.name || null,
        email: session.user.email || null,
      },
      businesses,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Business owner not found") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    console.error("POS context API error:", error);
    return NextResponse.json(
      { error: "Failed to load POS context" },
      { status: 500 }
    );
  }
}
