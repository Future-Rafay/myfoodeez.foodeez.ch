import CampaignForm from "@/components/platform/CampaignForm";
import { PageHeader } from "@/components/platform/PlatformUi";
import { STARTER_TEMPLATES, type StarterTemplate } from "@/lib/marketing";

export default async function NewCampaignPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const key = (typeof params.template === "string" && params.template in STARTER_TEMPLATES ? params.template : "outreach") as StarterTemplate;
  const template = STARTER_TEMPLATES[key];
  const error = typeof params.error === "string" ? params.error.slice(0, 200) : undefined;
  return (
    <>
      <PageHeader title="New campaign" description="Save a draft first; you can send yourself a test before anyone else receives it." />
      {error ? <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <CampaignForm campaign={{ name: template.label, subject: template.subject, audience: key === "newsletter" ? "subscriber" : "business", html: template.html }} />
    </>
  );
}
