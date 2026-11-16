import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import PlatformNav from "@/components/platform/PlatformNav";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { getPlatformOverview } from "@/services/platform-data";

export const metadata: Metadata = {
  title: "Super Admin | Foodeez",
  robots: { index: false, follow: false },
};

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const admin = await requirePlatformAdmin();
  const overview = await getPlatformOverview();
  const counts = {
    Requests: overview.requests,
    Moderation: overview.reviews + overview.platformReviews + overview.stories,
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <aside className="border-b border-gray-200 bg-white md:fixed md:inset-y-0 md:left-0 md:z-40 md:w-60 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 p-4">
          <Link href="/platform" className="flex items-center gap-2">
            <Image src="/images/Logo/LogoFoodeezMain.svg" alt="Foodeez" width={110} height={35} priority />
          </Link>
          <span className="rounded-md border border-foodeez-primary/20 bg-foodeez-primary/5 px-2 py-0.5 text-xs font-medium text-foodeez-primary">
            Super Admin
          </span>
        </div>
        <PlatformNav counts={counts} />
        <div className="hidden border-t border-gray-100 p-4 text-xs text-gray-500 md:block">
          <p className="truncate font-medium text-gray-700">{admin.name}</p>
          <p className="truncate">{admin.email}</p>
          <Link href="/dashboard" className="mt-3 inline-block font-medium text-foodeez-primary hover:underline">
            Restaurant dashboard
          </Link>
        </div>
      </aside>
      <main className="px-4 py-6 sm:px-6 md:ml-60 lg:px-8">
        <div className="mx-auto w-full max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
