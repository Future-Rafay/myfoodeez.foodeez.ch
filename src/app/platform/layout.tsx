import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeftRight } from "lucide-react";
import { AccountCard, LogoutButton } from "@/components/admin/AccountCard";
import PlatformNav from "@/components/platform/PlatformNav";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { getPlatformOverview } from "@/services/platform-data";

export const metadata: Metadata = {
  title: "Admin | Foodeez",
  robots: { index: false, follow: false },
};

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformAdmin();
  const overview = await getPlatformOverview();
  const counts = {
    Requests: overview.requests,
    Moderation: overview.reviews + overview.platformReviews + overview.stories,
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <aside className="border-b border-gray-200 bg-white md:fixed md:inset-y-0 md:left-0 md:z-40 md:flex md:w-60 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 p-4">
          <Link href="/platform" className="flex items-center gap-2">
            <Image src="/images/Logo/LogoFoodeezMain.svg" alt="Foodeez" width={110} height={35} priority />
          </Link>
          <div className="flex items-center gap-1">
            <span className="rounded-md border border-foodeez-primary/20 bg-foodeez-primary/5 px-2 py-0.5 text-xs font-medium text-foodeez-primary">
              Super Admin
            </span>
            <LogoutButton className="px-2 md:hidden" labelClassName="sr-only" />
          </div>
        </div>
        <PlatformNav counts={counts} />
        <div className="hidden border-t border-gray-100 p-3 md:mt-auto md:block">
          <AccountCard role="Super Admin" className="mb-2" />
          <Link
            href="/dashboard"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-950"
          >
            <ArrowLeftRight className="size-5 shrink-0" />
            Restaurant dashboard
          </Link>
          <LogoutButton className="w-full" />
        </div>
      </aside>
      <main className="px-4 py-6 sm:px-6 md:ml-60 lg:px-8">
        <div className="mx-auto w-full max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
