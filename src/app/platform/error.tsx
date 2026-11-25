"use client";

import { RouteError } from "@/components/core/RouteStates";

export default function PlatformError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError reset={reset} backHref="/platform" backLabel="Back to overview" />;
}
