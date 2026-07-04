"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Edit,
  MapPin,
  Plus,
  Save,
  Trash2,
  Truck,
  X,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { DeliveryZone } from "@/lib/fulfillment";
import type { FulfillmentSettingsRow } from "@/services/settings-management";

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

type ZoneDraft = {
  zoneName: string;
  postalCodes: string[];
  postalInput: string;
  minimumOrderPrice: string;
  deliveryPrice: string;
  freeDeliveryAbove: string;
  deliveryInformation: string;
};

interface AdminSettingsFormProps {
  businessId: number;
  initialDeliveryAreas: string;
  initialFulfillmentSettings: FulfillmentSettingsRow;
}

const currencyFormatter = new Intl.NumberFormat("de-CH", {
  style: "currency",
  currency: "CHF",
});

function parseAreas(value: string) {
  return value
    .split(",")
    .map((area) => area.trim())
    .filter(Boolean);
}

function emptyZoneDraft(): ZoneDraft {
  return {
    zoneName: "",
    postalCodes: [],
    postalInput: "",
    minimumOrderPrice: "0",
    deliveryPrice: "0",
    freeDeliveryAbove: "",
    deliveryInformation: "",
  };
}

function zoneToDraft(zone: DeliveryZone): ZoneDraft {
  return {
    zoneName: zone.zoneName,
    postalCodes: zone.postalCodes,
    postalInput: "",
    minimumOrderPrice: String(zone.minimumOrderPrice),
    deliveryPrice: String(zone.deliveryPrice),
    freeDeliveryAbove:
      zone.freeDeliveryAbove === null ? "" : String(zone.freeDeliveryAbove),
    deliveryInformation: zone.deliveryInformation,
  };
}

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function toNumber(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeCodes(codes: string[]) {
  return Array.from(new Set(codes.map((code) => code.trim()).filter(Boolean)));
}

export default function AdminSettingsForm({
  businessId,
  initialDeliveryAreas,
  initialFulfillmentSettings,
}: AdminSettingsFormProps) {
  const [deliveryAreas, setDeliveryAreas] = useState(initialDeliveryAreas);
  const [fulfillment, setFulfillment] = useState(initialFulfillmentSettings);
  const [isSavingLegacy, setIsSavingLegacy] = useState(false);
  const [isSavingFulfillment, setIsSavingFulfillment] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [zoneDialogOpen, setZoneDialogOpen] = useState(false);
  const [editingZoneIndex, setEditingZoneIndex] = useState<number | null>(null);
  const [zoneDraft, setZoneDraft] = useState<ZoneDraft>(emptyZoneDraft);
  const areas = useMemo(() => parseAreas(deliveryAreas), [deliveryAreas]);

  function showToast(type: "success" | "error", message: string) {
    setToast({ type, message });
  }

  function removeArea(areaToRemove: string) {
    setDeliveryAreas(areas.filter((area) => area !== areaToRemove).join(", "));
  }

  async function handleLegacySave() {
    setIsSavingLegacy(true);
    setToast(null);

    try {
      const response = await fetch(`/api/dashboard/${businessId}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryAreas }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to save settings");
      }

      const saved = (await response.json()) as { deliveryAreas: string } | null;
      setDeliveryAreas(saved?.deliveryAreas || "");
      showToast("success", "Settings saved successfully.");
    } catch (error) {
      showToast(
        "error",
        error instanceof Error ? error.message : "Failed to save settings."
      );
    } finally {
      setIsSavingLegacy(false);
    }
  }

  async function handleFulfillmentSave() {
    setIsSavingFulfillment(true);
    setToast(null);

    try {
      const response = await fetch(
        `/api/dashboard/${businessId}/settings/fulfillment`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deliveryEnabled: fulfillment.deliveryEnabled,
            deliveryZones: fulfillment.deliveryZones,
            pickupEnabled: fulfillment.pickupEnabled,
            pickupInstructions: fulfillment.pickupInstructions,
            defaultPickupPrepMinutes: fulfillment.defaultPickupPrepMinutes,
            defaultDeliveryPrepMinutes:
              fulfillment.defaultDeliveryPrepMinutes,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to save fulfillment settings");
      }

      const saved = (await response.json()) as FulfillmentSettingsRow;
      setFulfillment(saved);
      showToast("success", "Fulfillment settings saved.");
    } catch (error) {
      showToast(
        "error",
        error instanceof Error
          ? error.message
          : "Failed to save fulfillment settings."
      );
    } finally {
      setIsSavingFulfillment(false);
    }
  }

  function openAddZone() {
    setEditingZoneIndex(null);
    setZoneDraft(emptyZoneDraft());
    setZoneDialogOpen(true);
  }

  function openEditZone(index: number) {
    setEditingZoneIndex(index);
    setZoneDraft(zoneToDraft(fulfillment.deliveryZones[index]));
    setZoneDialogOpen(true);
  }

  function deleteZone(index: number) {
    setFulfillment((current) => ({
      ...current,
      deliveryZones: current.deliveryZones.filter((_, itemIndex) => {
        return itemIndex !== index;
      }),
    }));
  }

  function addPostalCodes(rawValue: string) {
    const codes = normalizeCodes(rawValue.split(","));

    if (!codes.length) return;

    setZoneDraft((current) => ({
      ...current,
      postalCodes: normalizeCodes([...current.postalCodes, ...codes]),
      postalInput: "",
    }));
  }

  function handlePostalInputChange(value: string) {
    if (!value.includes(",")) {
      setZoneDraft((current) => ({ ...current, postalInput: value }));
      return;
    }

    const parts = value.split(",");
    const pending = parts.pop() || "";
    const codes = normalizeCodes(parts);

    setZoneDraft((current) => ({
      ...current,
      postalCodes: normalizeCodes([...current.postalCodes, ...codes]),
      postalInput: pending,
    }));
  }

  function removePostalCode(codeToRemove: string) {
    setZoneDraft((current) => ({
      ...current,
      postalCodes: current.postalCodes.filter((code) => code !== codeToRemove),
    }));
  }

  function saveZoneDraft() {
    const postalCodes = normalizeCodes([
      ...zoneDraft.postalCodes,
      zoneDraft.postalInput,
    ]);
    const zoneName = zoneDraft.zoneName.trim();
    const minimumOrderPrice = toNumber(zoneDraft.minimumOrderPrice);
    const deliveryPrice = toNumber(zoneDraft.deliveryPrice);
    const freeDeliveryAbove = zoneDraft.freeDeliveryAbove.trim()
      ? toNumber(zoneDraft.freeDeliveryAbove)
      : null;

    if (!zoneName) {
      showToast("error", "Zone name is required.");
      return;
    }

    if (!postalCodes.length) {
      showToast("error", "Add at least one postal code.");
      return;
    }

    if (
      minimumOrderPrice < 0 ||
      deliveryPrice < 0 ||
      (freeDeliveryAbove !== null && freeDeliveryAbove < 0)
    ) {
      showToast("error", "Prices must be greater than or equal to CHF 0.");
      return;
    }

    if (
      freeDeliveryAbove !== null &&
      freeDeliveryAbove < minimumOrderPrice
    ) {
      showToast(
        "error",
        "Free delivery above must be greater than or equal to the minimum order price."
      );
      return;
    }

    const nextZone: DeliveryZone = {
      zoneName,
      postalCodes,
      minimumOrderPrice,
      deliveryPrice,
      freeDeliveryAbove,
      deliveryInformation: zoneDraft.deliveryInformation.trim(),
    };

    setFulfillment((current) => {
      if (editingZoneIndex === null) {
        return {
          ...current,
          deliveryZones: [...current.deliveryZones, nextZone],
        };
      }

      return {
        ...current,
        deliveryZones: current.deliveryZones.map((zone, index) =>
          index === editingZoneIndex ? nextZone : zone
        ),
      };
    });

    setZoneDialogOpen(false);
  }

  return (
    <div className="space-y-5">
      {toast && (
        <div
          className={
            toast.type === "success"
              ? "fixed right-4 top-4 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700 shadow-lg"
              : "fixed right-4 top-4 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 shadow-lg"
          }
          role="status"
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="size-4 shrink-0" />
          ) : (
            <XCircle className="size-4 shrink-0" />
          )}
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-2 rounded p-0.5 hover:bg-black/5"
            aria-label="Dismiss notification"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

       <Card className="border-gray-200 bg-white shadow-sm">
        <CardHeader className="border-b border-gray-100 px-5 py-4">
          <CardTitle className="text-lg font-semibold text-gray-950">
            Legacy Delivery Areas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-5">
          <div className="space-y-2">
            <Label htmlFor="deliveryAreas">
              Delivery areas (comma separated)
            </Label>
            <Textarea
              id="deliveryAreas"
              value={deliveryAreas}
              onChange={(event) => setDeliveryAreas(event.target.value)}
              placeholder="8050, 8051, 8052"
              rows={5}
            />
            <p className="text-sm text-gray-500">
              Kept for backward compatibility with older delivery settings.
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="mb-3 text-sm font-medium text-gray-700">
              Live preview
            </p>
            {areas.length ? (
              <div className="flex flex-wrap gap-2">
                {areas.map((area) => (
                  <Badge
                    key={area}
                    variant="outline"
                    className="gap-1 border-foodeez-primary/20 bg-white text-gray-800"
                  >
                    {area}
                    <button
                      type="button"
                      onClick={() => removeArea(area)}
                      className="rounded-full text-gray-500 hover:text-red-600"
                      aria-label={`Remove ${area}`}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                Add areas above to preview them here.
              </p>
            )}
          </div>

          <Button
            onClick={handleLegacySave}
            disabled={isSavingLegacy}
            className="bg-foodeez-primary text-white hover:bg-foodeez-secondary"
          >
            {isSavingLegacy ? "Saving..." : "Save legacy areas"}
          </Button>
        </CardContent>
      </Card>


      <Card className="border-gray-200 bg-white shadow-sm">
        <CardHeader className="border-b border-gray-100 px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg font-semibold text-gray-950">
              Fulfillment
            </CardTitle>
            <Button
              onClick={handleFulfillmentSave}
              disabled={isSavingFulfillment}
              className="gap-2 bg-foodeez-primary text-white hover:bg-foodeez-secondary"
            >
              <Save className="size-4" />
              {isSavingFulfillment ? "Saving..." : "Save fulfillment"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 p-5">
          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-950">
                  Local delivery
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Configure delivery zones, postal codes, and CHF pricing.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Label
                  htmlFor="deliveryEnabled"
                  className="text-sm font-medium text-gray-700"
                >
                  Delivery enabled
                </Label>
                <Switch
                  id="deliveryEnabled"
                  checked={fulfillment.deliveryEnabled}
                  onCheckedChange={(checked) =>
                    setFulfillment((current) => ({
                      ...current,
                      deliveryEnabled: checked,
                    }))
                  }
                />
              </div>
            </div>

            <div className="rounded-lg border border-gray-200">
              <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    Delivery zones
                  </p>
                  <p className="text-sm text-gray-500">
                    Postal code matching decides local delivery availability.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={openAddZone}
                  className="gap-2"
                >
                  <Plus className="size-4" />
                  Add zone
                </Button>
              </div>

              {fulfillment.deliveryZones.length ? (
                <div className="divide-y divide-gray-100">
                  {fulfillment.deliveryZones.map((zone, index) => (
                    <div
                      key={`${zone.zoneName}-${index}`}
                      className="grid gap-3 p-4 lg:grid-cols-[1.25fr_1fr_1fr_auto]"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <MapPin className="size-4 shrink-0 text-foodeez-primary" />
                          <p className="truncate text-sm font-semibold text-gray-950">
                            {zone.zoneName}
                          </p>
                        </div>
                        <p className="mt-1 text-sm text-gray-500">
                          {zone.postalCodes.length} postal code
                          {zone.postalCodes.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="text-sm">
                        <p className="font-medium text-gray-900">
                          Minimum {formatCurrency(zone.minimumOrderPrice)}
                        </p>
                        <p className="text-gray-500">
                          Delivery {formatCurrency(zone.deliveryPrice)}
                        </p>
                      </div>
                      <div className="text-sm text-gray-600">
                        {zone.freeDeliveryAbove !== null ? (
                          <span>
                            Free from {formatCurrency(zone.freeDeliveryAbove)}
                          </span>
                        ) : (
                          <span>No free delivery threshold</span>
                        )}
                      </div>
                      <div className="flex gap-2 lg:justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openEditZone(index)}
                          className="gap-2"
                        >
                          <Edit className="size-4" />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => deleteZone(index)}
                          className="gap-2 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="size-4" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
                  <Truck className="mb-3 size-9 text-gray-300" />
                  <p className="text-sm font-semibold text-gray-900">
                    No delivery zones yet
                  </p>
                  <p className="mt-1 max-w-md text-sm text-gray-500">
                    Add your first zone to control where local delivery is
                    available and how much it costs.
                  </p>
                  <Button
                    type="button"
                    onClick={openAddZone}
                    className="mt-4 gap-2 bg-foodeez-primary text-white hover:bg-foodeez-secondary"
                  >
                    <Plus className="size-4" />
                    Add zone
                  </Button>
                </div>
              )}
            </div>
          </section>

          <section className="space-y-4 border-t border-gray-100 pt-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-950">
                  Pickup
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Customers can choose pickup during checkout when this is
                  enabled.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Label
                  htmlFor="pickupEnabled"
                  className="text-sm font-medium text-gray-700"
                >
                  Pickup enabled
                </Label>
                <Switch
                  id="pickupEnabled"
                  checked={fulfillment.pickupEnabled}
                  onCheckedChange={(checked) =>
                    setFulfillment((current) => ({
                      ...current,
                      pickupEnabled: checked,
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[260px_1fr]">
              <div className="space-y-2">
                <Label htmlFor="pickupInstructions">Pickup instructions</Label>
                <Textarea
                  id="pickupInstructions"
                  value={fulfillment.pickupInstructions}
                  onChange={(event) =>
                    setFulfillment((current) => ({
                      ...current,
                      pickupInstructions: event.target.value,
                    }))
                  }
                  rows={4}
                  placeholder="Example: Please come to the counter and show your order number."
                />
              </div>
            </div>
          </section>

          <section className="space-y-4 border-t border-gray-100 pt-6">
            <div>
              <h3 className="text-base font-semibold text-gray-950">
                Defaults
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                These defaults are used when an order does not have a saved ETA.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="deliveryPrepMinutes">
                  Default delivery preparation time
                </Label>
                <div className="relative">
                  <Input
                    id="deliveryPrepMinutes"
                    type="number"
                    min="0"
                    value={fulfillment.defaultDeliveryPrepMinutes}
                    onChange={(event) =>
                      setFulfillment((current) => ({
                        ...current,
                        defaultDeliveryPrepMinutes: Math.max(
                          0,
                          Number(event.target.value || 0)
                        ),
                      }))
                    }
                    className="pr-16"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                    min
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="defaultPickupPrepMinutes">
                  Default pickup preparation time
                </Label>
                <div className="relative">
                  <Input
                    id="defaultPickupPrepMinutes"
                    type="number"
                    min="0"
                    value={fulfillment.defaultPickupPrepMinutes}
                    onChange={(event) =>
                      setFulfillment((current) => ({
                        ...current,
                        defaultPickupPrepMinutes: Math.max(
                          0,
                          Number(event.target.value || 0)
                        ),
                      }))
                    }
                    className="pr-16"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                    min
                  </span>
                </div>
              </div>
            </div>
          </section>
        </CardContent>
      </Card>

     
      <Dialog open={zoneDialogOpen} onOpenChange={setZoneDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingZoneIndex === null ? "Add delivery zone" : "Edit delivery zone"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="zoneName">Zone name</Label>
              <Input
                id="zoneName"
                value={zoneDraft.zoneName}
                onChange={(event) =>
                  setZoneDraft((current) => ({
                    ...current,
                    zoneName: event.target.value,
                  }))
                }
                placeholder="Zone 1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="postalCodes">Postal codes</Label>
              <div className="rounded-md border border-input p-2 focus-within:ring-[3px] focus-within:ring-ring/50">
                <div className="mb-2 flex flex-wrap gap-2">
                  {zoneDraft.postalCodes.map((code) => (
                    <Badge
                      key={code}
                      variant="outline"
                      className="gap-1 border-foodeez-primary/20 bg-gray-50 text-gray-800"
                    >
                      {code}
                      <button
                        type="button"
                        onClick={() => removePostalCode(code)}
                        className="rounded-full text-gray-500 hover:text-red-600"
                        aria-label={`Remove ${code}`}
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <input
                  id="postalCodes"
                  value={zoneDraft.postalInput}
                  onChange={(event) =>
                    handlePostalInputChange(event.target.value)
                  }
                  onBlur={() => addPostalCodes(zoneDraft.postalInput)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === "Tab") {
                      event.preventDefault();
                      addPostalCodes(zoneDraft.postalInput);
                    }
                  }}
                  className="h-8 w-full min-w-0 border-0 bg-transparent px-1 text-sm outline-none"
                  placeholder="8050, 8051, 805*"
                />
              </div>
              <p className="text-sm text-gray-500">
                Enter postal codes separated by commas. To include a range of
                postal codes, add an asterisk (*) after the characters that
                begin the range.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="minimumOrderPrice">
                  Minimum order price, CHF
                </Label>
                <Input
                  id="minimumOrderPrice"
                  type="number"
                  min="0"
                  step="0.05"
                  value={zoneDraft.minimumOrderPrice}
                  onChange={(event) =>
                    setZoneDraft((current) => ({
                      ...current,
                      minimumOrderPrice: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deliveryPrice">Delivery price, CHF</Label>
                <Input
                  id="deliveryPrice"
                  type="number"
                  min="0"
                  step="0.05"
                  value={zoneDraft.deliveryPrice}
                  onChange={(event) =>
                    setZoneDraft((current) => ({
                      ...current,
                      deliveryPrice: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="freeDeliveryAbove">
                  Free delivery above, CHF
                </Label>
                <Input
                  id="freeDeliveryAbove"
                  type="number"
                  min="0"
                  step="0.05"
                  value={zoneDraft.freeDeliveryAbove}
                  onChange={(event) =>
                    setZoneDraft((current) => ({
                      ...current,
                      freeDeliveryAbove: event.target.value,
                    }))
                  }
                  placeholder="50"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deliveryInformation">Delivery information</Label>
              <Textarea
                id="deliveryInformation"
                value={zoneDraft.deliveryInformation}
                onChange={(event) =>
                  setZoneDraft((current) => ({
                    ...current,
                    deliveryInformation: event.target.value,
                  }))
                }
                rows={4}
              />
              <p className="text-sm text-gray-500">
                This message appears during checkout and in the order
                confirmation.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setZoneDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={saveZoneDraft}
              className="bg-foodeez-primary text-white hover:bg-foodeez-secondary"
            >
              Save zone
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
