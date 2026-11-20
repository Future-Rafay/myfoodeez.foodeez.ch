import { RouteNotFound } from "@/components/core/RouteStates";

export default function DashboardNotFound() {
  return <RouteNotFound backHref="/dashboard" backLabel="Back to your restaurants" />;
}
