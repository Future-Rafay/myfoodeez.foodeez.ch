"use client";

import { ReactNode, useEffect, useState } from "react";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminMobileDrawer from "@/components/admin/AdminMobileDrawer";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { useSetBusinessId } from "@/components/providers/BusinessProvider";

interface AdminShellProps {
  businessId: string;
  business: AdminBusinessIdentity;
  children: ReactNode;
}

export interface AdminBusinessIdentity {
  name: string;
  logoUrl?: string | null;
  status?: "active" | "inactive";
}

export default function AdminShell({
  businessId,
  business,
  children,
}: AdminShellProps) {
  const setBusinessId = useSetBusinessId();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    setBusinessId(businessId);
  }, [businessId, setBusinessId]);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="hidden md:fixed md:inset-y-0 md:left-0 md:z-40 md:flex md:w-20 lg:w-60">
        <AdminSidebar
          businessId={businessId}
          restaurantName={business.name}
          business={business}
        />
      </div>

      <div className="min-h-screen md:pl-20 lg:pl-60">
        <AdminHeader
          businessId={businessId}
          mobileNavigation={
            <AdminMobileDrawer
              businessId={businessId}
              restaurantName={business.name}
              business={business}
              isOpen={isMobileNavOpen}
              onOpenChange={setIsMobileNavOpen}
            />
          }
        />
        <main className="min-h-[calc(100vh-4rem)] overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
