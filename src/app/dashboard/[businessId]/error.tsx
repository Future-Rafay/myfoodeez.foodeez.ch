"use client";

import { RouteError } from "@/components/core/RouteStates";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError reset={reset} backHref="/dashboard" backLabel="Back to your restaurants" />;
}
