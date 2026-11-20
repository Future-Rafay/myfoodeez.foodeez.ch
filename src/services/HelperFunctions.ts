"use server"

import prisma from "@/lib/prisma";
import { requireBusinessAccess } from "@/services/admin-data";

// Server action called from the client AdminShell, so it must check access itself.
export async function getBusinessDetail(businessId: number) {
    await requireBusinessAccess(businessId);
    return prisma.business_detail_view_all.findMany({
        where: { BUSINESS_ID: businessId },
        select: {
            BUSINESS_NAME: true,
            SHORT_NAME: true,
            LOGO: true,
            IMAGE_URL: true,
            STATUS: true,
        },
    });
}
