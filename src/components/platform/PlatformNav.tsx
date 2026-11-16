"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardCheck, LayoutDashboard, Mail, MessageSquareText, Store, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { label: "Overview", href: "/platform", icon: LayoutDashboard },
  { label: "Restaurants", href: "/platform/restaurants", icon: Store },
  { label: "Requests", href: "/platform/requests", icon: ClipboardCheck },
  { label: "Customers", href: "/platform/customers", icon: Users },
  { label: "Moderation", href: "/platform/moderation", icon: MessageSquareText },
  { label: "Marketing", href: "/platform/marketing", icon: Mail },
];

export default function PlatformNav({ counts }: { counts: Partial<Record<string, number>> }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Super Admin" className="flex gap-1 overflow-x-auto px-3 py-3 md:flex-col md:overflow-visible md:py-4">
      {items.map((item) => {
        const active = item.href === "/platform" ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        const count = counts[item.label];
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-950",
              active && "bg-foodeez-primary/10 text-foodeez-primary shadow-[inset_3px_0_0_var(--foodeez-primary)] hover:bg-foodeez-primary/10 hover:text-foodeez-primary"
            )}
          >
            <Icon className="size-5 shrink-0" />
            <span className="flex-1">{item.label}</span>
            {count ? (
              <span className="rounded-full bg-foodeez-primary px-2 py-0.5 text-xs font-semibold text-white">{count}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
