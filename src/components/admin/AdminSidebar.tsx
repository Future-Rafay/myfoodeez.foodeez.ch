"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  ChevronDown,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  MonitorSmartphone,
  ReceiptText,
  Settings,
  Store,
  Tags,
  Utensils,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveMediaUrl } from "@/lib/media";
import type { AdminBusinessIdentity } from "@/components/admin/AdminShell";

export const adminNavItems = [
  {
    label: "Dashboard",
    href: "",
    icon: LayoutDashboard,
  },
  {
    label: "Orders",
    href: "/orders",
    icon: ReceiptText,
  },
  {
    label: "POS",
    href: "/pos",
    icon: MonitorSmartphone,
  },
];

interface AdminSidebarProps {
  businessId: string;
  restaurantName?: string;
  business?: AdminBusinessIdentity | null;
  onNavigate?: () => void;
  className?: string;
  collapseOnMedium?: boolean;
}

export default function AdminSidebar({
  businessId,
  restaurantName = "Selected restaurant",
  business,
  onNavigate,
  className,
  collapseOnMedium = true,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const basePath = `/dashboard/${businessId}`;
  const isMenuRoute =
    pathname === `${basePath}/menu` || pathname.startsWith(`${basePath}/menu/`);
  const businessName = business?.name || restaurantName;
  const businessLogo = resolveMediaUrl(business?.logoUrl);
  const ownerName = session?.user?.name || "Owner";
  const ownerImage = resolveMediaUrl(session?.user?.image);
  const ownerInitials = getInitials(ownerName);
  const menuItems = [
    {
      label: "Menu Cards",
      href: `${basePath}/menu`,
      icon: Utensils,
    },
    {
      label: "Products",
      href: `${basePath}/menu/products`,
      icon: Store,
    },
    {
      label: "Categories",
      href: `${basePath}/menu/categories`,
      icon: FolderKanban,
    },
    {
      label: "Tags",
      href: `${basePath}/menu/tags`,
      icon: Tags,
    },
  ];
  const settingsItem = {
    label: "Settings",
    href: `${basePath}/settings`,
    icon: Settings,
  };

  React.useEffect(() => {
    if (isMenuRoute) {
      setIsMenuOpen(true);
    }
  }, [isMenuRoute]);

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-gray-200 bg-white text-gray-900",
        className
      )}
    >
      <div className="border-b border-gray-100 p-3 lg:p-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-foodeez-primary/10 text-sm font-semibold text-foodeez-primary">
            {businessLogo ? (
              <Image
                src={businessLogo}
                alt={businessName}
                fill
                className="object-cover"
                unoptimized={businessLogo.startsWith("http")}
              />
            ) : (
              getInitials(businessName)
            )}
          </div>
          <div
            className={cn(
              "min-w-0",
              collapseOnMedium ? "hidden lg:block" : "block"
            )}
          >
            <p className="truncate text-sm font-semibold text-gray-950">
              {businessName}
            </p>
            {business?.status && (
              <p className="mt-0.5 text-xs capitalize text-gray-500">
                {business.status}
              </p>
            )}
          </div>
        </div>
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className={cn(
            "mt-3 flex w-full items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-950",
            collapseOnMedium && "md:px-2 lg:px-3"
          )}
          title="Switch Business"
        >
          <span className={cn(collapseOnMedium ? "hidden lg:inline" : "inline")}>
            Switch Business
          </span>
          <span className={cn(collapseOnMedium ? "md:inline lg:hidden" : "hidden")}>
            Switch
          </span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {adminNavItems.map((item) => {
          const href = `${basePath}${item.href}`;
          const isActive =
            item.href === ""
              ? pathname === basePath
              : pathname === href || pathname.startsWith(`${href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={href}
              onClick={onNavigate}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                "text-gray-600 hover:bg-gray-100 hover:text-gray-950",
                collapseOnMedium && "md:justify-center lg:justify-start",
                isActive &&
                  "bg-foodeez-primary/10 text-foodeez-primary shadow-[inset_3px_0_0_var(--foodeez-primary)] hover:bg-foodeez-primary/10 hover:text-foodeez-primary"
              )}
              aria-current={isActive ? "page" : undefined}
              title={item.label}
            >
              <Icon className="size-5 shrink-0" />
              <span
                className={cn(
                  "truncate",
                  collapseOnMedium ? "hidden lg:inline" : "inline"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
        <div>
          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            className={cn(
              "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              "text-gray-600 hover:bg-gray-100 hover:text-gray-950",
              collapseOnMedium && "md:justify-center lg:justify-start",
              isMenuRoute &&
                "bg-foodeez-primary/10 text-foodeez-primary shadow-[inset_3px_0_0_var(--foodeez-primary)] hover:bg-foodeez-primary/10 hover:text-foodeez-primary"
            )}
            aria-expanded={isMenuOpen}
            title="Menu"
          >
            <Utensils className="size-5 shrink-0" />
            <span
              className={cn(
                "flex-1 truncate text-left",
                collapseOnMedium ? "hidden lg:inline" : "inline"
              )}
            >
              Menu
            </span>
            <ChevronDown
              className={cn(
                "size-4 transition-transform",
                collapseOnMedium ? "hidden lg:block" : "block",
                isMenuOpen && "rotate-180"
              )}
            />
          </button>
          {isMenuOpen && (
            <div
              className={cn(
                "mt-1 space-y-1 border-l border-gray-200",
                collapseOnMedium ? "md:ml-4 lg:ml-6" : "ml-6"
              )}
            >
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href !== `${basePath}/menu` &&
                    pathname.startsWith(`${item.href}/`));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-2 rounded-lg py-2 pl-3 pr-2 text-sm font-medium transition-colors",
                      "text-gray-500 hover:bg-gray-100 hover:text-gray-950",
                      collapseOnMedium && "md:justify-center lg:justify-start",
                      isActive &&
                        "bg-foodeez-primary/10 text-foodeez-primary"
                    )}
                    aria-current={isActive ? "page" : undefined}
                    title={item.label}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span
                      className={cn(
                        "truncate",
                        collapseOnMedium ? "hidden lg:inline" : "inline"
                      )}
                    >
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
        {(() => {
          const Icon = settingsItem.icon;
          const isActive =
            pathname === settingsItem.href ||
            pathname.startsWith(`${settingsItem.href}/`);

          return (
            <Link
              href={settingsItem.href}
              onClick={onNavigate}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                "text-gray-600 hover:bg-gray-100 hover:text-gray-950",
                collapseOnMedium && "md:justify-center lg:justify-start",
                isActive &&
                  "bg-foodeez-primary/10 text-foodeez-primary shadow-[inset_3px_0_0_var(--foodeez-primary)] hover:bg-foodeez-primary/10 hover:text-foodeez-primary"
              )}
              aria-current={isActive ? "page" : undefined}
              title={settingsItem.label}
            >
              <Icon className="size-5 shrink-0" />
              <span
                className={cn(
                  "truncate",
                  collapseOnMedium ? "hidden lg:inline" : "inline"
                )}
              >
                {settingsItem.label}
              </span>
            </Link>
          );
        })()}
      </nav>

      <div className="border-t border-gray-100 p-3">
        <div className="mb-3 flex min-w-0 items-center gap-3 rounded-lg bg-gray-50 p-2">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-600 text-sm font-semibold text-white">
            {ownerImage ? (
              <Image
                src={ownerImage}
                alt={ownerName}
                fill
                className="object-cover"
                unoptimized={ownerImage.startsWith("http")}
              />
            ) : (
              ownerInitials
            )}
          </div>
          <div
            className={cn(
              "min-w-0",
              collapseOnMedium ? "hidden lg:block" : "block"
            )}
          >
            <p className="truncate text-sm font-semibold text-gray-950">
              {truncateOwnerName(ownerName)}
            </p>
            <p className="text-xs text-gray-500">Owner</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50",
            collapseOnMedium && "md:justify-center lg:justify-start"
          )}
          title="Logout"
        >
          <LogOut className="size-5 shrink-0" />
          <span className={cn(collapseOnMedium ? "hidden lg:inline" : "inline")}>
            Logout
          </span>
        </button>
      </div>
    </aside>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "F";
  const first = parts[0]?.[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] || "" : "";
  return `${first}${last}`.toUpperCase();
}

function truncateOwnerName(name: string) {
  return name.length > 12 ? `${name.slice(0, 12)}...` : name;
}
