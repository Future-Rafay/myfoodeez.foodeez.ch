import PosWorkspace from "@/components/pos/PosWorkspace";
import { getPosCatalog } from "@/services/pos-management";

export default async function PosPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const businessId = Number((await params).businessId);
  const catalog = await getPosCatalog(businessId);
  return <PosWorkspace businessId={businessId} initialCatalog={catalog} />;
}
