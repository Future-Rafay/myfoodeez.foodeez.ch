import { RouteNotFound } from "@/components/core/RouteStates";

// Pages inside Super Admin only; non-admins get the root 404 from requirePlatformAdmin in the layout.
export default function PlatformNotFound() {
  return <RouteNotFound backHref="/platform/restaurants" backLabel="Back to restaurants" />;
}
