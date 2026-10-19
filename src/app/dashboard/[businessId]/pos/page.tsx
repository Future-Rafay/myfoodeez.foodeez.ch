import PosWorkspace from "@/components/pos/PosWorkspace";
import { getPosCatalog } from "@/services/pos-management";
import { availablePosDiscounts } from "@/services/discount-management";

export default async function PosPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const businessId = Number((await params).businessId);
  const [catalog, discounts] = await Promise.all([getPosCatalog(businessId), availablePosDiscounts(businessId)]);
  return <PosWorkspace businessId={businessId} initialCatalog={catalog} initialDiscounts={discounts} />;
}
