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
  confirm?: { title: string; description: string; confirmLabel: string };
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

function ActionForm({ action, fields, children, tone, onDone }: Pick<Props, "action" | "fields" | "tone"> & { children: React.ReactNode; onDone?: () => void }) {
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
          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} autoFocus>
              Cancel
            </Button>
            <ActionForm action={action} fields={fields} tone={tone} onDone={() => setOpen(false)}>
              {confirm.confirmLabel}
            </ActionForm>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
