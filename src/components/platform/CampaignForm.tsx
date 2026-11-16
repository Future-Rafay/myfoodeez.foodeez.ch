import RichTextEditor from "@/components/platform/RichTextEditor";
import { saveCampaign } from "@/app/platform/marketing/actions";

const field = "mt-2 block h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm shadow-xs outline-none focus-visible:border-foodeez-primary focus-visible:ring-2 focus-visible:ring-foodeez-primary/20";

export default function CampaignForm({ campaign }: { campaign: { id?: number; name: string; subject: string; audience: string; html: string } }) {
  return (
    <form action={saveCampaign} className="space-y-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-950">1. Write the email</h2>
      {campaign.id ? <input type="hidden" name="id" value={campaign.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-gray-900">
          Internal name
          <input name="name" required maxLength={160} defaultValue={campaign.name} className={field} />
        </label>
        <label className="block text-sm font-medium text-gray-900">
          Send to
          <select name="audience" defaultValue={campaign.audience} className={field}>
            <option value="business">Restaurants (outreach)</option>
            <option value="subscriber">Newsletter subscribers</option>
          </select>
        </label>
        <label className="block text-sm font-medium text-gray-900 sm:col-span-2">
          Subject line
          <input name="subject" required maxLength={200} defaultValue={campaign.subject} className={field} />
        </label>
      </div>
      <RichTextEditor
        label="Email content"
        name="html"
        defaultValue={campaign.html}
        hint="Use {{restaurant_name}}, {{town}} and {{claim_url}} to personalise restaurant emails. Images are not supported yet. Every email gets the Foodeez header and an unsubscribe link."
      />
      <div className="flex justify-end">
        <button type="submit" className="h-9 rounded-md bg-foodeez-primary px-5 text-sm font-medium text-white shadow-xs hover:bg-foodeez-primary/90">
          Save draft
        </button>
      </div>
    </form>
  );
}
