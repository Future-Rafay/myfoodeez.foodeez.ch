"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = {
  action: (formData: FormData) => Promise<void>;
  fields: Record<string, string | number>;
  label: string;
  /** Risky actions open a confirmation dialog first; routine ones submit directly. */
  confirm?: { title: string; description: string; confirmLabel: string; noteLabel?: string };
  tone?: "primary" | "neutral" | "danger";
};

function SubmitButton({ children, tone }: { children: React.ReactNode; tone: Props["tone"] }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="sm"
      disabled={pending}
      variant={tone === "danger" ? "destructive" : tone === "primary" ? "default" : "outline"}
      className={tone === "primary" ? "bg-foodeez-primary text-white hover:bg-foodeez-primary/90" : undefined}
    >
      {pending ? "Saving…" : children}
    </Button>
  );
}

function ActionForm({ action, fields, children, tone, onDone, noteLabel }: Pick<Props, "action" | "fields" | "tone"> & { children: React.ReactNode; onDone?: () => void; noteLabel?: string }) {
  return (
    <form
      action={async (formData) => {
        await action(formData);
        onDone?.();
      }}
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={String(value)} />
      ))}
      {noteLabel ? (
        <label className="mb-4 block text-sm font-medium text-gray-900">
          {noteLabel}
          <textarea name="note" maxLength={500} rows={3} className="mt-2 block w-full rounded-md border border-gray-200 px-3 py-2 text-sm font-normal outline-none focus-visible:border-foodeez-primary focus-visible:ring-2 focus-visible:ring-foodeez-primary/20" />
        </label>
      ) : null}
      <SubmitButton tone={tone}>{children}</SubmitButton>
    </form>
  );
}

export default function ConfirmActionButton({ action, fields, label, confirm, tone = "neutral" }: Props) {
  const [open, setOpen] = useState(false);
  if (!confirm) return <ActionForm action={action} fields={fields} tone={tone}>{label}</ActionForm>;
  return (
    <>
      <Button type="button" size="sm" variant="outline" className={tone === "danger" ? "border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800" : undefined} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm.title}</DialogTitle>
            <DialogDescription>{confirm.description}</DialogDescription>
          </DialogHeader>
          {confirm.noteLabel ? (
            <ActionForm action={action} fields={fields} tone={tone} onDone={() => setOpen(false)} noteLabel={confirm.noteLabel}>
              {confirm.confirmLabel}
            </ActionForm>
          ) : null}
          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} autoFocus>
              Cancel
            </Button>
            {confirm.noteLabel ? null : (
              <ActionForm action={action} fields={fields} tone={tone} onDone={() => setOpen(false)}>
                {confirm.confirmLabel}
              </ActionForm>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
