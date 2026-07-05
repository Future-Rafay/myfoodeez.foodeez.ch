"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ChevronRight, Plus } from "lucide-react";
import {
  ReactNode,
  RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatOrderNumberFromId } from "@/lib/orderNumber";

interface AdminHeaderProps {
  businessId: string;
  mobileNavigation?: ReactNode;
}

function humanizeSegment(segment: string) {
  if (/^\d+$/.test(segment)) {
    return `#${segment}`;
  }

  return segment
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

type BusinessNotification = {
  BUSINESS_NOTIFICATION_ID: number;
  NOTIFICATION_TYPE: "order" | "refund" | "system" | "menu" | "payment";
  TITLE: string;
  MESSAGE: string | null;
  IS_READ: number | null;
  LINK_URL: string | null;
  METADATA_JSON: string | null;
  CREATION_DATETIME: string | null;
};

function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  onClickOutside: () => void
) {
  useEffect(() => {
    function handlePointerDown(event: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClickOutside();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [onClickOutside, ref]);
}

function relativeTime(value: string | null) {
  if (!value) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function metadataOrderLabel(notification: BusinessNotification) {
  try {
    const metadata = JSON.parse(notification.METADATA_JSON || "{}") as {
      orderId?: unknown;
      orderNumber?: unknown;
    };
    if (metadata.orderNumber) return String(metadata.orderNumber).trim();

    const orderId = Number(metadata.orderId);
    return Number.isInteger(orderId) ? formatOrderNumberFromId(orderId) : null;
  } catch {
    return null;
  }
}

function notificationMessage(notification: BusinessNotification) {
  const orderLabel = metadataOrderLabel(notification);

  if (orderLabel && notification.NOTIFICATION_TYPE === "order") {
    return `Order ${orderLabel} is now preparing`;
  }

  return notification.MESSAGE;
}

export default function AdminHeader({
  businessId,
  mobileNavigation,
}: AdminHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);
  const [notifications, setNotifications] = useState<BusinessNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const knownNotificationIds = useRef<Set<number>>(new Set());
  const didLoadNotifications = useRef(false);
  const quickActionsRef = useRef<HTMLDivElement | null>(null);
  const basePath = `/dashboard/${businessId}`;
  useClickOutside(quickActionsRef, () => setIsQuickActionsOpen(false));

  const askNotificationPermission = useCallback(() => {
    if ("Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    const response = await fetch(
      `/api/dashboard/${businessId}/notifications?limit=20`
    );
    if (!response.ok) return;

    const data = (await response.json()) as {
      notifications: BusinessNotification[];
      unreadCount: number;
    };
    const freshOrderNotifications = data.notifications.filter((notification) => {
      const isKnown = knownNotificationIds.current.has(
        notification.BUSINESS_NOTIFICATION_ID
      );
      return (
        didLoadNotifications.current &&
        !isKnown &&
        notification.NOTIFICATION_TYPE === "order" &&
        notification.TITLE === "New order received"
      );
    });

    data.notifications.forEach((notification) => {
      knownNotificationIds.current.add(notification.BUSINESS_NOTIFICATION_ID);
    });
    didLoadNotifications.current = true;
    setNotifications(data.notifications);
    setUnreadCount(data.unreadCount);

    if ("Notification" in window && Notification.permission === "granted") {
      freshOrderNotifications.forEach((notification) => {
        new Notification("New order received", {
          body: notificationMessage(notification) || undefined,
        });
      });
    }
  }, [businessId]);

  useEffect(() => {
    askNotificationPermission();
    void loadNotifications();
    const interval = window.setInterval(loadNotifications, 30_000);
    return () => window.clearInterval(interval);
  }, [askNotificationPermission, loadNotifications]);

  async function markRead(notification: BusinessNotification) {
    await fetch(
      `/api/dashboard/${businessId}/notifications/${notification.BUSINESS_NOTIFICATION_ID}/read`,
      { method: "PATCH" }
    );
    await loadNotifications();
    if (notification.LINK_URL) router.push(notification.LINK_URL);
  }

  async function markAllRead() {
    await fetch(`/api/dashboard/${businessId}/notifications/read-all`, {
      method: "PATCH",
    });
    await loadNotifications();
  }

  const childSegments = pathname
    .replace(basePath, "")
    .split("/")
    .filter(Boolean);
  const crumbs = [
    { label: "Dashboard", href: basePath },
    ...childSegments.map((segment, index) => ({
      label: humanizeSegment(segment),
      href: `${basePath}/${childSegments.slice(0, index + 1).join("/")}`,
    })),
  ];
  const pageTitle = crumbs[crumbs.length - 1]?.label ?? "Dashboard";

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="flex min-h-16 items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          {mobileNavigation}
          <div className="min-w-0">
            <nav className="flex items-center text-xs font-medium text-gray-500">
              {crumbs.map((crumb, index) => {
                const isLast = index === crumbs.length - 1;

                return (
                  <span key={crumb.href} className="flex min-w-0 items-center">
                    {index > 0 && (
                      <ChevronRight className="mx-1.5 size-3.5 shrink-0 text-gray-400" />
                    )}
                    {isLast ? (
                      <span className="truncate text-gray-700">
                        {crumb.label}
                      </span>
                    ) : (
                      <Link
                        href={crumb.href}
                        className="truncate transition-colors hover:text-foodeez-primary"
                      >
                        {crumb.label}
                      </Link>
                    )}
                  </span>
                );
              })}
            </nav>
            <h1 className="mt-1 truncate text-xl font-semibold tracking-tight text-gray-950 sm:text-2xl">
              {pageTitle}
            </h1>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <DropdownMenu onOpenChange={(open) => open && askNotificationPermission()}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="relative inline-flex size-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-950"
                aria-label="Notifications"
              >
                <Bell className="size-5" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1.5 text-xs font-semibold leading-5 text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0">
              <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
                <DropdownMenuLabel className="px-0 py-0">
                  Notifications
                </DropdownMenuLabel>
                <button
                  type="button"
                  className="text-xs font-medium text-foodeez-primary hover:text-foodeez-secondary"
                  onClick={(event) => {
                    event.preventDefault();
                    void markAllRead();
                  }}
                >
                  Mark all as read
                </button>
              </div>
              {notifications.length ? (
                <div className="max-h-96 overflow-y-auto p-1">
                  {notifications.map((notification) => (
                    <DropdownMenuItem
                      key={notification.BUSINESS_NOTIFICATION_ID}
                      className="block cursor-pointer rounded-md p-3"
                      onClick={() => void markRead(notification)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-xs font-semibold uppercase text-gray-500">
                          {notification.NOTIFICATION_TYPE}
                        </p>
                        <span className="text-xs text-gray-400">
                          {relativeTime(notification.CREATION_DATETIME)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-gray-950">
                        {notification.TITLE}
                      </p>
                      {notificationMessage(notification) && (
                        <p className="mt-1 line-clamp-2 text-sm text-gray-500">
                          {notificationMessage(notification)}
                        </p>
                      )}
                      {!notification.IS_READ && (
                        <span className="mt-2 inline-block size-2 rounded-full bg-foodeez-primary" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </div>
              ) : (
                <p className="px-4 py-8 text-center text-sm text-gray-500">
                  No notifications yet
                </p>
              )}
              <DropdownMenuSeparator />
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="relative" ref={quickActionsRef}>
            <button
              type="button"
              onClick={() => setIsQuickActionsOpen((open) => !open)}
              className="inline-flex items-center gap-2 rounded-lg bg-foodeez-primary px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-foodeez-secondary"
              aria-expanded={isQuickActionsOpen}
              aria-haspopup="menu"
            >
              <Plus className="size-4" />
              <span className="hidden sm:inline">Quick actions</span>
            </button>
            {isQuickActionsOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-lg border border-gray-200 bg-white p-1 shadow-lg">
                <Link
                  href={`${basePath}/menu/products/new`}
                  onClick={() => setIsQuickActionsOpen(false)}
                  className="block rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-950"
                >
                  New Product
                </Link>
                <Link
                  href={`${basePath}/menu/categories/new`}
                  onClick={() => setIsQuickActionsOpen(false)}
                  className="block rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-950"
                >
                  New Category
                </Link>
                <Link
                  href={`${basePath}/orders`}
                  onClick={() => setIsQuickActionsOpen(false)}
                  className="block rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-950"
                >
                  View Orders
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
