"use client";

import Image from "next/image";
import { signOut, useSession } from "next-auth/react";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveMediaUrl } from "@/lib/media";

/** The signed-in person's avatar, name and role, shared by the restaurant sidebar, Super Admin and the business selector. */
export function AccountCard({
  role,
  className,
  detailsClassName,
}: {
  role: string;
  className?: string;
  detailsClassName?: string;
}) {
  const { data: session } = useSession();
  const name = session?.user?.name || session?.user?.email || "Owner";
  const image = resolveMediaUrl(session?.user?.image);

  return (
    <div className={cn("flex min-w-0 items-center gap-3 rounded-lg bg-gray-50 p-2", className)}>
      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-600 text-sm font-semibold text-white">
        {image ? (
          <Image src={image} alt={name} fill className="object-cover" unoptimized={image.startsWith("http")} />
        ) : (
          getInitials(name)
        )}
      </div>
      <div className={cn("min-w-0", detailsClassName)}>
        <p className="truncate text-sm font-semibold text-gray-950">{name}</p>
        <p className="text-xs text-gray-500">{role}</p>
      </div>
    </div>
  );
}

export function LogoutButton({ className, labelClassName }: { className?: string; labelClassName?: string }) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/" })}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50",
        className
      )}
      title="Logout"
    >
      <LogOut className="size-5 shrink-0" />
      <span className={labelClassName}>Logout</span>
    </button>
  );
}

export function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "F";
  const first = parts[0]?.[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] || "" : "";
  return `${first}${last}`.toUpperCase();
}
