import { RouteNotFound } from "@/components/core/RouteStates";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <RouteNotFound backHref="/dashboard" backLabel="Back to your restaurants" />
    </main>
  );
}
