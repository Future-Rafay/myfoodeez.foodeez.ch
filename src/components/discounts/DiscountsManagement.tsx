"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Discount } from "@/lib/discounts";

type Code = { CODE_ID: number; DISCOUNT_ID: number; CODE: string; ACTIVE: number };
const empty: Discount = {
  id: 0, name: "", type: "percentage", value: 10, minimumOrder: null,
  active: false, posEnabled: true, onlineEnabled: false, onlineAutomatic: false,
  validFrom: null, validUntil: null,
};
const money = new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" });

export default function DiscountsManagement({ businessId, initialDiscounts, initialCodes }: {
  businessId: number; initialDiscounts: Discount[]; initialCodes: Code[];
}) {
  const [discounts, setDiscounts] = useState(initialDiscounts);
  const [codes, setCodes] = useState(initialCodes);
  const [editing, setEditing] = useState<Discount | null>(null);
  const [confirm, setConfirm] = useState<() => void>(() => () => {});
  const [confirmText, setConfirmText] = useState("");
  const [code, setCode] = useState("");
  const [codeDiscountId, setCodeDiscountId] = useState(initialDiscounts[0]?.id ?? 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const base = `/api/dashboard/${businessId}/discounts`;

  async function refresh() {
    const response = await fetch(base, { cache: "no-store" });
    if (!response.ok) throw new Error("Could not refresh discounts.");
    const result = await response.json();
    setDiscounts(result.discounts);
    setCodes(result.codes);
    setCodeDiscountId((current) => current || result.discounts[0]?.id || 0);
  }

  async function save() {
    if (!editing || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(editing.id ? `${base}/${editing.id}` : base, {
        method: editing.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save discount.");
      await refresh(); setEditing(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save discount."); }
    finally { setBusy(false); }
  }

  async function addCode() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`${base}/codes`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discountId: codeDiscountId, code }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not create code.");
      setCode(""); await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not create code."); }
    finally { setBusy(false); }
  }

  async function changeCode(codeId: number, active: boolean) {
    setBusy(true); setError("");
    try {
      const response = await fetch(`${base}/codes/${codeId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update code.");
      await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not update code."); }
    finally { setBusy(false); setConfirmText(""); }
  }

  const field = <K extends keyof Discount>(key: K, value: Discount[K]) =>
    setEditing((current) => current ? { ...current, [key]: value } : current);
  const checkbox = (key: "active" | "posEnabled" | "onlineEnabled" | "onlineAutomatic", label: string) => (
    <label className="flex items-center gap-2 text-sm text-gray-800">
      <input type="checkbox" checked={Boolean(editing?.[key])} onChange={(event) => field(key, event.target.checked)} className="size-4 accent-foodeez-primary" />
      {label}
    </label>
  );

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-semibold text-gray-950">Discounts</h1><p className="text-sm text-gray-600">Create preset offers for POS and online checkout.</p></div>
      <Button onClick={() => { setError(""); setEditing({ ...empty }); }}>Create discount</Button>
    </div>
    {error && !editing && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-gray-600"><tr><th className="p-3">Name</th><th className="p-3">Value</th><th className="p-3">Minimum</th><th className="p-3">Channels</th><th className="p-3">Status</th><th className="p-3 text-right">Action</th></tr></thead>
        <tbody className="divide-y divide-gray-100">
          {discounts.map((item) => <tr key={item.id}>
            <td className="p-3 font-medium text-gray-950">{item.name}</td>
            <td className="p-3">{item.type === "percentage" ? `${item.value}%` : money.format(item.value)}</td>
            <td className="p-3">{item.minimumOrder == null ? "None" : money.format(item.minimumOrder)}</td>
            <td className="p-3">{[item.posEnabled && "POS", item.onlineEnabled && "Online"].filter(Boolean).join(", ") || "None"}</td>
            <td className="p-3">{item.active ? "Active" : "Inactive"}</td>
            <td className="p-3 text-right"><Button variant="outline" size="sm" onClick={() => { setError(""); setEditing({ ...item }); }}>Edit</Button></td>
          </tr>)}
          {!discounts.length && <tr><td colSpan={6} className="p-8 text-center text-gray-500">No discounts configured yet.</td></tr>}
        </tbody>
      </table>
    </div>
    <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div><h2 className="text-lg font-semibold">Coupon codes</h2><p className="text-sm text-gray-600">Codes activate an online-available discount. One offer applies per order.</p></div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1"><Label htmlFor="codeDiscount">Discount</Label><select id="codeDiscount" value={codeDiscountId} onChange={(event) => setCodeDiscountId(Number(event.target.value))} className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm">{discounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
        <div className="space-y-1"><Label htmlFor="code">Code</Label><Input id="code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} maxLength={64} placeholder="WELCOME10" /></div>
        <Button onClick={addCode} disabled={busy || !codeDiscountId || !code.trim()}>Add code</Button>
      </div>
      <div className="space-y-2">{codes.map((item) => <div key={item.CODE_ID} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 p-3 text-sm">
        <span><strong>{item.CODE}</strong> · {discounts.find((discount) => discount.id === item.DISCOUNT_ID)?.name || "Discount"} · {item.ACTIVE ? "Active" : "Inactive"}</span>
        <Button variant="outline" size="sm" disabled={busy} onClick={() => item.ACTIVE ? (setConfirmText(`Deactivate code ${item.CODE}?`), setConfirm(() => () => changeCode(item.CODE_ID, false))) : void changeCode(item.CODE_ID, true)}>{item.ACTIVE ? "Deactivate" : "Activate"}</Button>
      </div>)}{!codes.length && <p className="text-sm text-gray-500">No coupon codes yet.</p>}</div>
    </section>
    <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader><DialogTitle>{editing?.id ? "Edit discount" : "Create discount"}</DialogTitle></DialogHeader>
      {editing && <div className="space-y-4">
        <div className="space-y-1"><Label htmlFor="discountName">Name</Label><Input id="discountName" value={editing.name} onChange={(event) => field("name", event.target.value)} maxLength={100} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label htmlFor="discountType">Type</Label><select id="discountType" value={editing.type} onChange={(event) => field("type", event.target.value as Discount["type"])} className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"><option value="percentage">Percentage</option><option value="fixed">Fixed CHF</option></select></div>
          <div className="space-y-1"><Label htmlFor="discountValue">Value</Label><Input id="discountValue" type="number" min="0.01" max={editing.type === "percentage" ? "99.99" : "999999.99"} step="0.01" value={editing.value} onChange={(event) => field("value", Number(event.target.value))} /></div>
        </div>
        <div className="space-y-1"><Label htmlFor="discountMinimum">Minimum items subtotal, CHF (optional)</Label><Input id="discountMinimum" type="number" min="0" step="0.01" value={editing.minimumOrder ?? ""} onChange={(event) => field("minimumOrder", event.target.value === "" ? null : Number(event.target.value))} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label htmlFor="validFrom">Valid from</Label><Input id="validFrom" type="date" value={editing.validFrom ?? ""} onChange={(event) => field("validFrom", event.target.value || null)} /></div>
          <div className="space-y-1"><Label htmlFor="validUntil">Valid until</Label><Input id="validUntil" type="date" value={editing.validUntil ?? ""} onChange={(event) => field("validUntil", event.target.value || null)} /></div>
        </div>
        <div className="space-y-2">{checkbox("active", "Active")}{checkbox("posEnabled", "Available on POS")}{checkbox("onlineEnabled", "Available online")}{checkbox("onlineAutomatic", "Apply automatically online")}</div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      </div>}
      <DialogFooter><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save discount"}</Button></DialogFooter>
    </DialogContent></Dialog>
    <Dialog open={Boolean(confirmText)} onOpenChange={(open) => !open && setConfirmText("")}><DialogContent>
      <DialogHeader><DialogTitle>Deactivate coupon code</DialogTitle></DialogHeader><p className="text-sm text-gray-700">{confirmText}</p>
      <DialogFooter><Button variant="outline" onClick={() => setConfirmText("")}>Keep code</Button><Button variant="destructive" onClick={confirm} disabled={busy}>Deactivate</Button></DialogFooter>
    </DialogContent></Dialog>
  </div>;
}
