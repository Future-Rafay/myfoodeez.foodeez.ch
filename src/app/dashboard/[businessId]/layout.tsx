import AdminShell from "@/components/admin/AdminShell";
import { authOptions } from "@/lib/auth";
import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
    title: "Dashboard | Foodeez",
    description: "Foodeez restaurant admin dashboard",
};

export default async function RootLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ businessId: string }>;
}) {
    if (!(await getServerSession(authOptions))) {
        redirect("/auth/signin");
    }

    const { businessId } = await params;

    return (
        <AdminShell businessId={businessId}>
            {children}
        </AdminShell>
    );
}
