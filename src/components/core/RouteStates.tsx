"use client";

import Link from "next/link";
import { AlertTriangle, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/** Shown by error.tsx boundaries inside the dashboard and Super Admin shells. */
export function RouteError({ reset, backHref, backLabel }: { reset: () => void; backHref: string; backLabel: string }) {
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center rounded-xl border border-gray-200 bg-white px-6 py-12 text-center shadow-sm">
      <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-red-50 text-red-600">
        <AlertTriangle className="size-6" aria-hidden />
      </div>
      <h2 className="text-lg font-semibold text-gray-950">This page could not load</h2>
      <p className="mt-2 text-sm text-gray-600">
        Something went wrong on our side. Nothing was changed. Try again, and if it keeps happening, go back and open the page again.
      </p>
      <div className="mt-6 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <Button onClick={reset} className="bg-foodeez-primary text-white hover:bg-foodeez-secondary">
          Try again
        </Button>
        <Button asChild variant="outline">
          <Link href={backHref}>{backLabel}</Link>
        </Button>
      </div>
    </div>
  );
}

export function RouteNotFound({ backHref, backLabel }: { backHref: string; backLabel: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center rounded-xl border border-gray-200 bg-white px-6 py-12 text-center shadow-sm">
      <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-gray-100 text-gray-500">
        <SearchX className="size-6" aria-hidden />
      </div>
      <h1 className="text-lg font-semibold text-gray-950">Page not found</h1>
      <p className="mt-2 text-sm text-gray-600">This page does not exist, or you do not have access to it.</p>
      <Button asChild variant="outline" className="mt-6">
        <Link href={backHref}>{backLabel}</Link>
      </Button>
    </div>
  );
}

/** Generic page skeleton for loading.tsx: header card plus a list. */
export function RouteLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
      </div>
      <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white shadow-sm">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 p-4">
            <Skeleton className="size-10 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
