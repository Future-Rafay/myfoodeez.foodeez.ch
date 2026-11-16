import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Building2, MapPin, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getOwnedBusinesses } from "@/services/admin-data";
import { resolveMediaUrl } from "@/lib/media";
import { getPlatformAdmin } from "@/lib/platform-admin";

function PlatformLink() {
  return (
    <Link
      href="/platform"
      className="inline-flex items-center rounded-md border border-foodeez-primary/30 bg-white px-3 py-1.5 text-sm font-medium text-foodeez-primary shadow-xs hover:bg-foodeez-primary/5"
    >
      Super Admin
    </Link>
  );
}

export default async function DashboardRootPage() {
  const platformAdmin = await getPlatformAdmin();
  let businesses;

  try {
    businesses = await getOwnedBusinesses();
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      redirect("/auth/signin");
    }

    return (
      <main className="min-h-screen bg-gray-100 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center">
          <Card className="w-full border-gray-200 bg-white text-center shadow-sm">
            <CardContent className="p-8">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-lg bg-foodeez-primary/10 text-foodeez-primary">
                <Building2 className="size-6" />
              </div>
              <h1 className="text-2xl font-semibold text-gray-950">
                Business owner access needed
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                Your account is signed in, but it is not connected to a
                Foodeez business owner profile yet.
              </p>
              {platformAdmin ? (
                <div className="mt-5">
                  <PlatformLink />
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/dashboard" className="flex items-center gap-3">
            <Image
              src="/images/Logo/LogoFoodeezMain.svg"
              alt="Foodeez"
              width={126}
              height={40}
              priority
            />
          </Link>
          <div className="flex items-center gap-3">
          {platformAdmin ? <PlatformLink /> : null}
          <Badge
            variant="outline"
            className="border-foodeez-primary/20 bg-foodeez-primary/5 text-foodeez-primary"
          >
            Admin
          </Badge>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-foodeez-primary">
              Business selector
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-gray-950">
              Choose a restaurant to manage
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-600">
              View and manage menus, products, orders, and settings for each
              business connected to your account.
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 shadow-sm">
            <span className="font-semibold text-gray-950">
              {businesses.length}
            </span>{" "}
            owned business{businesses.length === 1 ? "" : "es"}
          </div>
        </div>

        {businesses.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {businesses.map((business) => {
              const mediaUrl =
                resolveMediaUrl(business.logo) ||
                resolveMediaUrl(business.imageUrl);

              return (
                <Card
                  key={business.id}
                  className="overflow-hidden border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
                >
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                        {mediaUrl ? (
                          <Image
                            src={mediaUrl}
                            alt={business.name}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <Store className="size-6 text-gray-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h2 className="truncate text-base font-semibold text-gray-950">
                              {business.name}
                            </h2>
                            {business.shortName && (
                              <p className="mt-0.5 truncate text-sm text-gray-500">
                                {business.shortName}
                              </p>
                            )}
                          </div>
                          <Badge
                            variant="outline"
                            className={
                              business.status === "active"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-gray-200 bg-gray-50 text-gray-600"
                            }
                          >
                            {business.status}
                          </Badge>
                        </div>

                        {business.town && (
                          <p className="mt-3 flex items-center gap-1.5 text-sm text-gray-500">
                            <MapPin className="size-4" />
                            {business.town}
                          </p>
                        )}
                      </div>
                    </div>

                    <Button
                      asChild
                      className="mt-5 w-full bg-foodeez-primary text-white hover:bg-foodeez-secondary"
                    >
                      <Link href={`/dashboard/${business.id}`}>
                        Go to Dashboard
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="border-dashed border-gray-300 bg-white text-center">
            <CardContent className="p-10">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                <Store className="size-6" />
              </div>
              <h2 className="text-xl font-semibold text-gray-950">
                No businesses found
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
                This owner account does not have any businesses attached yet.
              </p>
            </CardContent>
          </Card>
        )}
      </section>
    </main>
  );
}
