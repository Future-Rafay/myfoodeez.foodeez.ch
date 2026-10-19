import DiscountsManagement from "@/components/discounts/DiscountsManagement";
import { listCodes, listDiscounts } from "@/services/discount-management";

export default async function DiscountsPage({ params }: { params: Promise<{ businessId: string }> }) {
  const businessId = Number((await params).businessId);
  const [discounts, codes] = await Promise.all([listDiscounts(businessId), listCodes(businessId)]);
  return <DiscountsManagement businessId={businessId} initialDiscounts={discounts} initialCodes={codes} />;
}
