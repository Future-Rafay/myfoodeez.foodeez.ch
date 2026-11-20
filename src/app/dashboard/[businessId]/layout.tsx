import AdminShell from "@/components/admin/AdminShell";
import { authOptions } from "@/lib/auth";
import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { getBusinessShellIdentity } from "@/services/admin-data";

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
    const numericBusinessId = Number(businessId);
    // Checked on the server so a restaurant you do not own shows "not found" instead of an empty shell.
    const business = Number.isInteger(numericBusinessId) && numericBusinessId > 0
        ? await getBusinessShellIdentity(numericBusinessId)
        : null;
    if (!business) notFound();

    return (
        <AdminShell businessId={businessId} business={business}>
            {children}
        </AdminShell>
    );
}
