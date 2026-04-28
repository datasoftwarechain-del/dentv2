"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCSRF } from "@/hooks/useCSRF";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { WORK_TYPE_LABELS, formatWorkType } from "@/lib/work-types";
import { toast } from "sonner";
import {
  Loader2, Trash2, Plus, User, Calendar, FileText,
  AlertCircle, Package, Lock, Link2Off, Copy,
} from "lucide-react";
import { computeItemTotal } from "@/lib/invoice-totals";
import { formatNumber } from "@/lib/date-utils";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────
interface Patient {
  id: string;
  first_name: string;
  last_name: string;
}

interface Extra {
  name: string;
  price: number;
  qty: number;
}

interface CatalogItem {
  id: string;
  name: string;
  base_price: number;
  category: string;
  /** [BLOQUE 4] Effective price after applying client override (if any). */
  effective_price?: number;
  /** [BLOQUE 4] true when the lab has a custom price for this client. */
  has_override?: boolean;
}

interface OrderItem {
  id: string;
  work_type: string | null;
  tooth_positions: string | null;
  shade: string | null;
  quantity: number;
  unit_price: number | null;
  selected_extras: Extra[];
  catalog_item_name?: string | null;
  catalog_item_id?: string | null;
}

interface OrderData {
  id: string;
  patient_id: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  notes: string | null;
  items: OrderItem[];
}

interface EditOrderFormProps {
  order: OrderData;
  patients: Patient[];
  organizationId: string;
  isDentist: boolean;
  showPrices?: boolean;
  /**
   * [BLOQUE 2] true → form fully editable. false → all inputs disabled +
   * submit hidden. The API enforces edit_orders independently as defense
   * in depth, but the UI must reflect the same gating.
   */
  canEdit?: boolean;
  catalogItems?: CatalogItem[];
}

const STATUS_OPTIONS = [
  { value: "received",      label: "Recibido" },
  { value: "in_production", label: "En Producción" },
  { value: "ready",         label: "Listo" },
  { value: "delivered",     label: "Entregado" },
  { value: "cancelled",     label: "Cancelado" },
];

const PRIORITY_OPTIONS = [
  { value: "low",    label: "Baja" },
  { value: "normal", label: "Normal" },
  { value: "high",   label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

const WORK_TYPE_OPTIONS = Object.entries(WORK_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

// ─────────────────────────────────────────────────────────
// New item blank template
// ─────────────────────────────────────────────────────────
function blankItem(): Omit<OrderItem, "id"> & { _tempId: string } {
  return {
    _tempId: crypto.randomUUID(),
    work_type: "",
    tooth_positions: "",
    shade: "",
    quantity: 1,
    unit_price: null,
    selected_extras: [],
    catalog_item_name: null,
    catalog_item_id: null,
  };
}

function guessWorkType(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("zirconia")) return "corona_zirconia";
  if (n.includes("emax") || n.includes("disilicato")) return "corona_emax";
  if (n.includes("carilla")) return "carilla";
  if (n.includes("puente")) return "puente_fijo";
  if (n.includes("implante")) return "implante_corona";
  if (n.includes("completa")) return "protesis_total";
  if (n.includes("corona") || n.includes("perno")) return "corona_metal_ceramica";
  if (n.includes("protesis") || n.includes("prótesis") || n.includes("terminacion") || n.includes("removible") || n.includes("ppr")) return "protesis_removible";
  if (n.includes("ferula") || n.includes("férula")) return "ferula";
  if (n.includes("retenedor")) return "retenedor";
  if (n.includes("reparacion") || n.includes("reparación")) return "reparacion";
  return "otro";
}

export function EditOrderForm({
  order,
  patients,
  organizationId: _organizationId,
  isDentist: _isDentist,
  showPrices = true,
  canEdit = true,
  catalogItems = [],
}: EditOrderFormProps) {
  const router = useRouter();
  const { csrfToken } = useCSRF();
  const [loading, setLoading] = useState(false);

  // ── Order-level fields ──
  const [patientId, setPatientId] = useState(order.patient_id || "");
  const [status, setStatus] = useState(order.status);
  const [priority, setPriority] = useState(order.priority || "normal");
  const [notes, setNotes] = useState(order.notes || "");

  // Parse due_date into date + time parts
  const initDate = order.due_date
    ? new Date(order.due_date).toISOString().split("T")[0]
    : "";
  const initTime = order.due_date
    ? (() => {
        const d = new Date(order.due_date);
        return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      })()
    : "";
  const [dueDate, setDueDate] = useState(initDate);
  const [dueTime, setDueTime] = useState(initTime);

  // ── Items state ──
  const [existingItems, setExistingItems] = useState<OrderItem[]>(order.items);
  const [deletedItemIds, setDeletedItemIds] = useState<string[]>([]);
  const [newItems, setNewItems] = useState<(Omit<OrderItem, "id"> & { _tempId: string })[]>([]);

  // ─────────────────────────────────────────────────────────
  // Item helpers
  // ─────────────────────────────────────────────────────────
  function updateExistingItem(id: string, field: keyof OrderItem, value: string | number) {
    setExistingItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  }

  function removeExistingItem(id: string) {
    setExistingItems((prev) => prev.filter((i) => i.id !== id));
    setDeletedItemIds((prev) => [...prev, id]);
  }

  function updateNewItem(tempId: string, field: string, value: string | number) {
    setNewItems((prev) =>
      prev.map((item) => (item._tempId === tempId ? { ...item, [field]: value } : item))
    );
  }

  function removeNewItem(tempId: string) {
    setNewItems((prev) => prev.filter((i) => i._tempId !== tempId));
  }

  // [BLOQUE 5] Duplicate any item — adds a fresh new item with the same
  // shape. _tempId regenerated so the duplicate is an INSERT on save.
  // [BLOQUE 5 ajuste] When the source has a catalog_item_id, the
  // duplicate's unit_price re-resolves to the CURRENT effective price
  // (override if exists, base otherwise) instead of snapshotting the
  // original's stored unit_price. Items detached from the catalog
  // (catalog_item_id=null) keep the original's unit_price as before.
  // selected_extras stay deep-copied — extras don't have per-client
  // overrides, so the original prices are correct.
  function resolveDuplicateUnitPrice(
    catalogItemId: string | null | undefined,
    originalUnitPrice: number | null,
  ): number | null {
    if (!catalogItemId) return originalUnitPrice;
    const matched = catalogItems.find((c) => c.id === catalogItemId);
    if (!matched) return originalUnitPrice;
    return matched.effective_price ?? matched.base_price ?? originalUnitPrice;
  }

  function duplicateExistingItem(id: string) {
    const src = existingItems.find((i) => i.id === id);
    if (!src) return;
    setNewItems((prev) => [
      ...prev,
      {
        _tempId: crypto.randomUUID(),
        work_type: src.work_type,
        tooth_positions: src.tooth_positions,
        shade: src.shade,
        quantity: src.quantity,
        unit_price: resolveDuplicateUnitPrice(src.catalog_item_id, src.unit_price),
        selected_extras: (src.selected_extras ?? []).map((e) => ({ ...e })),
        catalog_item_name: src.catalog_item_name ?? null,
        catalog_item_id: src.catalog_item_id ?? null,
      },
    ]);
  }

  function duplicateNewItem(tempId: string) {
    const src = newItems.find((i) => i._tempId === tempId);
    if (!src) return;
    setNewItems((prev) => [
      ...prev,
      {
        ...src,
        _tempId: crypto.randomUUID(),
        unit_price: resolveDuplicateUnitPrice(src.catalog_item_id, src.unit_price),
        selected_extras: (src.selected_extras ?? []).map((e) => ({ ...e })),
      },
    ]);
  }

  // [BLOQUE 5] Live totals header. Aggregates over both existing and new
  // items using the same computeItemTotal that powers the strict invoice
  // calculation, so the form preview matches the saved value.
  const allItemsForTotal = [
    ...existingItems.map((i) => ({
      unit_price: i.unit_price,
      quantity: i.quantity,
      selected_extras: i.selected_extras,
      catalog_item: null,
    })),
    ...newItems.map((i) => ({
      unit_price: i.unit_price,
      quantity: i.quantity,
      selected_extras: i.selected_extras,
      catalog_item: null,
    })),
  ];
  const itemsCount = existingItems.length + newItems.length;
  const liveTotal = allItemsForTotal.reduce((sum, it) => sum + computeItemTotal(it as never), 0);

  // ─────────────────────────────────────────────────────────
  // Submit — [BLOQUE 2] goes through PATCH /api/orders/[id]
  // The API enforces edit_orders, ownership, validates schema, and
  // applies all writes server-side. UI checks `canEdit` to short-circuit
  // before the network call (defense layer 1; the API is layer 2).
  // ─────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) {
      toast.error("No tenés permiso para editar esta orden.");
      return;
    }
    setLoading(true);

    try {
      // Compute due_date ISO string
      let scheduledDue: string | null = null;
      if (dueDate) {
        const timeStr = dueTime || "09:00";
        scheduledDue = new Date(`${dueDate}T${timeStr}:00`).toISOString();
      }

      function toToothArray(s: string | null): string[] | null {
        if (!s || !s.trim()) return null;
        return s.split(",").map((v) => v.trim()).filter(Boolean);
      }

      const updatedItems = existingItems.map((item) => ({
        id: item.id,
        work_type: item.work_type || null,
        tooth_positions: toToothArray(item.tooth_positions),
        shade: item.shade || null,
        quantity: item.quantity || 1,
        selected_extras: item.selected_extras,
        catalog_item_id: item.catalog_item_id ?? null,
      }));

      const newItemsPayload = newItems
        .filter((i) => i.work_type || i.catalog_item_id)
        .map(({ _tempId: _, catalog_item_name: _n, ...item }) => ({
          catalog_item_id: item.catalog_item_id || null,
          work_type: item.work_type || null,
          tooth_positions: toToothArray(item.tooth_positions),
          shade: item.shade || null,
          quantity: item.quantity || 1,
          unit_price: item.unit_price ?? null,
          selected_extras: item.selected_extras,
        }));

      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({
          patient_id: patientId || null,
          status,
          priority,
          due_date: scheduledDue,
          notes: notes.trim() || null,
          items: {
            deleted: deletedItemIds,
            updated: updatedItems,
            new: newItemsPayload,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error al actualizar la orden");
      }

      toast.success("Orden actualizada correctamente");
      router.push(`/dashboard/orders/${order.id}`);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar la orden");
    } finally {
      setLoading(false);
    }
  }

  // ─────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────
  const patientOptions = patients.map((p) => ({
    value: p.id,
    label: `${p.first_name} ${p.last_name}`,
  }));

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {!canEdit && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <Lock className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Modo lectura</p>
            <p className="text-amber-800">
              No tenés permiso para editar esta orden. Pedile a un admin que te asigne el flag <code className="font-mono">edit_orders</code>.
            </p>
          </div>
        </div>
      )}
      {/* ── Order fields card ── */}
      <Card className="border-2 border-[#b0dde0] shadow-premium">
        <CardHeader className="bg-gradient-to-br from-[#f0fafb] to-white border-b border-[#d2f2f3]">
          <CardTitle className="text-xl font-bold text-[#044c64]">Datos de la Orden</CardTitle>
          <CardDescription>Actualizá los datos generales de esta orden de laboratorio</CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-5">
          {/* Patient */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-semibold">
              <User className="h-4 w-4 text-[#09919b]" />
              Paciente
            </Label>
            <Combobox
              options={patientOptions}
              value={patientId}
              onValueChange={setPatientId}
              placeholder="Seleccionar paciente"
              searchPlaceholder="Buscar paciente..."
              emptyText="No se encontró el paciente."
              disabled={!canEdit}
            />
          </div>

          {/* Status + Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Estado</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger disabled={!canEdit}>
                  <span className="flex-1 text-left truncate text-sm">
                    {STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status}
                  </span>
                  <SelectValue className="hidden" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Prioridad</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger disabled={!canEdit}>
                  <span className="flex-1 text-left truncate text-sm">
                    {PRIORITY_OPTIONS.find((o) => o.value === priority)?.label ?? priority}
                  </span>
                  <SelectValue className="hidden" />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Due date + time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <Calendar className="h-4 w-4 text-[#09919b]" />
                Fecha de Entrega
              </Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Hora de Entrega</Label>
              <Input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                disabled={!canEdit}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-semibold">
              <FileText className="h-4 w-4 text-[#09919b]" />
              Notas
            </Label>
            <Textarea
              placeholder="Observaciones, instrucciones especiales..."
              className="min-h-[90px] resize-none"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={!canEdit}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Items card ── */}
      <Card className="border-2 border-[#b0dde0] shadow-premium">
        <CardHeader className="bg-gradient-to-br from-[#f0fafb] to-white border-b border-[#d2f2f3]">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-xl font-bold text-[#044c64] flex items-center gap-2">
                <Package className="h-5 w-5" />
                Ítems de la Orden
              </CardTitle>
              <CardDescription>Editá, duplicá, eliminá o agregá ítems de trabajo</CardDescription>
              {/* [BLOQUE 5] Live counter + estimated total. Total hidden when
                  the user lacks view_prices. */}
              <div className="mt-2 flex items-center gap-3 flex-wrap">
                <Badge variant="outline" className="font-bold text-xs border-[#09919b]/40 text-[#09919b]">
                  Items: {itemsCount}
                </Badge>
                {showPrices && itemsCount > 0 && (
                  <span className="text-sm font-semibold text-[#044c64]">
                    Total estimado:{" "}
                    <span className="tabular-nums text-[#09919b]">
                      ${formatNumber(liveTotal)}
                    </span>
                  </span>
                )}
              </div>
            </div>
            <Button
              type="button"
              size="default"
              className="bg-[#09919b] hover:bg-[#07667a] text-white shadow-md shadow-[#09919b]/20 font-semibold"
              onClick={() => setNewItems((prev) => [...prev, blankItem()])}
              disabled={!canEdit}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Agregar ítem
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {existingItems.length === 0 && newItems.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground p-4 rounded-xl border border-dashed border-border/60 bg-muted/10">
              <AlertCircle className="h-4 w-4 shrink-0" />
              No hay ítems en esta orden. Hacé clic en "Agregar ítem" para añadir uno.
            </div>
          )}

          {/* Existing items */}
          {existingItems.map((item, idx) => (
            <ItemRow
              key={item.id}
              index={idx}
              workType={item.work_type || ""}
              catalogName={item.catalog_item_name || null}
              catalogItemId={item.catalog_item_id ?? null}
              toothPositions={item.tooth_positions || ""}
              shade={item.shade || ""}
              quantity={item.quantity}
              unitPrice={item.unit_price}
              extras={item.selected_extras}
              showPrices={showPrices}
              canEdit={canEdit}
              catalogItems={catalogItems}
              onWorkTypeChange={(v) => updateExistingItem(item.id, "work_type", v)}
              onToothChange={(v) => updateExistingItem(item.id, "tooth_positions", v)}
              onShadeChange={(v) => updateExistingItem(item.id, "shade", v)}
              onQuantityChange={(v) => updateExistingItem(item.id, "quantity", v)}
              onExtrasChange={(extras) => setExistingItems((prev) =>
                prev.map((i) => i.id === item.id ? { ...i, selected_extras: extras } : i)
              )}
              onUnlinkCatalog={() => setExistingItems((prev) =>
                prev.map((i) => i.id === item.id ? { ...i, catalog_item_id: null, catalog_item_name: null } : i)
              )}
              onDuplicate={() => duplicateExistingItem(item.id)}
              onRemove={() => removeExistingItem(item.id)}
            />
          ))}

          {/* New items */}
          {newItems.map((item, idx) => (
            <ItemRow
              key={item._tempId}
              index={existingItems.length + idx}
              isNew
              workType={item.work_type || ""}
              catalogName={item.catalog_item_name || null}
              catalogItemId={item.catalog_item_id ?? null}
              selectedCatalogId={item.catalog_item_id || null}
              toothPositions={item.tooth_positions || ""}
              shade={item.shade || ""}
              quantity={item.quantity}
              unitPrice={item.unit_price}
              extras={item.selected_extras}
              showPrices={showPrices}
              canEdit={canEdit}
              catalogItems={catalogItems}
              onWorkTypeChange={(v) => updateNewItem(item._tempId, "work_type", v)}
              onToothChange={(v) => updateNewItem(item._tempId, "tooth_positions", v)}
              onShadeChange={(v) => updateNewItem(item._tempId, "shade", v)}
              onQuantityChange={(v) => updateNewItem(item._tempId, "quantity", v)}
              onExtrasChange={(extras) => setNewItems((prev) =>
                prev.map((i) => i._tempId === item._tempId ? { ...i, selected_extras: extras } : i)
              )}
              onCatalogSelect={(catalogId, name, basePrice, wt) => setNewItems((prev) =>
                prev.map((i) => i._tempId === item._tempId
                  ? { ...i, catalog_item_id: catalogId, catalog_item_name: name, unit_price: basePrice, work_type: wt }
                  : i
                )
              )}
              onUnlinkCatalog={() => setNewItems((prev) =>
                prev.map((i) => i._tempId === item._tempId
                  ? { ...i, catalog_item_id: null, catalog_item_name: null, unit_price: null }
                  : i
                )
              )}
              onDuplicate={() => duplicateNewItem(item._tempId)}
              onRemove={() => removeNewItem(item._tempId)}
            />
          ))}

          {/* [BLOQUE 5] Secondary "Agregar ítem" at the bottom — comfortable
              when the list is long, the user doesn't need to scroll back up. */}
          {canEdit && itemsCount > 0 && (
            <div className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setNewItems((prev) => [...prev, blankItem()])}
                className="w-full border-dashed border-[#09919b]/40 text-[#09919b] hover:bg-[#09919b]/10 font-semibold"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Agregar otro ítem
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Actions ── */}
      <div className="flex justify-end gap-3 pb-6">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={loading}
        >
          {canEdit ? "Cancelar" : "Volver"}
        </Button>
        {canEdit && (
          <Button
            type="submit"
            disabled={loading}
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar cambios
          </Button>
        )}
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────
// ItemRow — editable row for one order item
// ─────────────────────────────────────────────────────────
interface ItemRowProps {
  index: number;
  isNew?: boolean;
  workType: string;
  catalogName: string | null;
  catalogItemId: string | null;
  selectedCatalogId?: string | null;
  toothPositions: string;
  shade: string;
  quantity: number;
  /** [BLOQUE 5] Used to compute the line subtotal preview. */
  unitPrice: number | null;
  extras: Extra[];
  showPrices?: boolean;
  /** [BLOQUE 2] When false, all controls are read-only and Remove/Unlink hidden. */
  canEdit?: boolean;
  catalogItems?: CatalogItem[];
  onWorkTypeChange: (v: string) => void;
  onToothChange: (v: string) => void;
  onShadeChange: (v: string) => void;
  onQuantityChange: (v: number) => void;
  onExtrasChange: (extras: Extra[]) => void;
  onCatalogSelect?: (catalogId: string, name: string, basePrice: number, workType: string) => void;
  onUnlinkCatalog?: () => void;
  /** [BLOQUE 5] Add a fresh new item with the same data; bottom-of-list. */
  onDuplicate?: () => void;
  onRemove: () => void;
}

function ItemRow({
  index,
  isNew,
  workType,
  catalogName,
  catalogItemId,
  selectedCatalogId,
  toothPositions,
  shade,
  quantity,
  unitPrice,
  extras,
  showPrices = true,
  canEdit = true,
  catalogItems = [],
  onWorkTypeChange,
  onToothChange,
  onShadeChange,
  onQuantityChange,
  onExtrasChange,
  onCatalogSelect,
  onUnlinkCatalog,
  onDuplicate,
  onRemove,
}: ItemRowProps) {
  const [newExtraName, setNewExtraName] = useState("");
  const [newExtraPrice, setNewExtraPrice] = useState("");

  function addExtra() {
    const name = newExtraName.trim();
    if (!name) return;
    const parsed = parseFloat(newExtraPrice);
    const price = isNaN(parsed) || parsed < 0 ? 0 : parsed;
    onExtrasChange([...extras, { name, price, qty: 1 }]);
    setNewExtraName("");
    setNewExtraPrice("");
  }

  function removeExtra(i: number) {
    onExtrasChange(extras.filter((_, idx) => idx !== i));
  }

  function updateExtraPrice(i: number, price: number) {
    onExtrasChange(extras.map((e, idx) => idx === i ? { ...e, price } : e));
  }

  // [BLOQUE 5] Live subtotal of this row using the same formula as the
  // strict invoice calculation. Hidden when the user can't see prices.
  const lineSubtotal = computeItemTotal({
    unit_price: unitPrice,
    quantity,
    selected_extras: extras,
    catalog_item: null,
  } as never);

  return (
    <div className="rounded-xl border border-border/60 bg-muted/10 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          Ítem {index + 1}
          {isNew && (
            <Badge variant="outline" className="ml-2 text-[10px] border-[#09919b]/40 text-[#09919b]">
              Nuevo
            </Badge>
          )}
        </span>
        <div className="flex items-center gap-1">
          {canEdit && onDuplicate && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[10px] text-muted-foreground hover:text-[#09919b] hover:bg-[#09919b]/10"
              onClick={onDuplicate}
              title="Duplicar este ítem"
            >
              <Copy className="h-3.5 w-3.5 mr-1" />
              Duplicar
            </Button>
          )}
          {canEdit && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={onRemove}
              title="Quitar ítem"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Work type — [BLOQUE 2] editable even when catalog_item is linked.
          - With catalog linked: show catalog name as informative badge + Select to
            change classification + "Desvincular" button.
          - New item without catalog: catalog combobox if catalog available, else free Select.
          - Existing or new without catalog: free Select. */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Tipo de trabajo</Label>

        {catalogItemId && catalogName ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="font-semibold text-xs bg-[#09919b]/10 text-[#09919b] border-[#09919b]/30">
                <Package className="h-3 w-3 mr-1" />
                {catalogName}
              </Badge>
              {/* [BLOQUE 4] Indicate if this catalog item has a custom price for the order's client. */}
              {(() => {
                const matched = catalogItems.find((c) => c.id === catalogItemId);
                if (!matched?.has_override) return null;
                const general = matched.base_price;
                const custom = matched.effective_price ?? general;
                return (
                  <Badge
                    variant="outline"
                    className="text-[10px] border-[#09919b]/40 text-[#09919b]"
                    title={`Precio general: $${general}. Precio personalizado: $${custom}.`}
                  >
                    Precio personalizado
                  </Badge>
                );
              })()}
              {canEdit && onUnlinkCatalog && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px] text-muted-foreground hover:text-destructive"
                  onClick={onUnlinkCatalog}
                >
                  <Link2Off className="h-3 w-3 mr-1" />
                  Desvincular catálogo
                </Button>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Clasificación</Label>
              <Select value={workType || undefined} onValueChange={onWorkTypeChange}>
                <SelectTrigger className="h-9 text-sm" disabled={!canEdit}>
                  <SelectValue placeholder="Seleccionar clasificación..." />
                </SelectTrigger>
                <SelectContent>
                  {WORK_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : isNew && catalogItems.length > 0 ? (
          <Combobox
            options={catalogItems.map((c) => ({ value: c.id, label: c.name }))}
            value={selectedCatalogId || ""}
            onValueChange={(id) => {
              const cat = catalogItems.find((c) => c.id === id);
              if (cat && onCatalogSelect) {
                // [BLOQUE 4] Prefill unit_price with the effective price for
                // this client (override if exists, base_price otherwise).
                const effective = cat.effective_price ?? cat.base_price;
                onCatalogSelect(cat.id, cat.name, effective, guessWorkType(cat.name));
              }
            }}
            placeholder="Seleccionar del arancel..."
            searchPlaceholder="Buscar trabajo..."
            emptyText="No se encontró el trabajo."
            disabled={!canEdit}
          />
        ) : (
          <Select value={workType || undefined} onValueChange={onWorkTypeChange}>
            <SelectTrigger className="h-9 text-sm" disabled={!canEdit}>
              <SelectValue placeholder="Seleccionar tipo..." />
            </SelectTrigger>
            <SelectContent>
              {WORK_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label className="text-xs text-muted-foreground">Piezas dentales</Label>
          <Input
            placeholder="Ej. P14, 1-14, Varias"
            className="h-9 text-sm"
            value={toothPositions}
            onChange={(e) => onToothChange(e.target.value)}
            disabled={!canEdit}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Color / Shade</Label>
          <Input
            placeholder="Ej. A2"
            className="h-9 text-sm"
            value={shade}
            onChange={(e) => onShadeChange(e.target.value)}
            disabled={!canEdit}
          />
        </div>
      </div>

      <div className="space-y-1.5 max-w-[120px]">
        <Label className="text-xs text-muted-foreground">Cantidad</Label>
        <Input
          type="number"
          min={1}
          className="h-9 text-sm"
          value={quantity}
          onChange={(e) => onQuantityChange(parseInt(e.target.value) || 1)}
          disabled={!canEdit}
        />
      </div>

      {/* ── Extras ── */}
      <div className="space-y-2 pt-1 border-t border-border/40">
        <Label className="text-xs text-muted-foreground">Extras / Adicionales</Label>

        {/* Existing extras */}
        {extras.length > 0 && (
          <div className="space-y-1.5">
            {extras.map((extra, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="flex-1 text-xs font-medium text-foreground truncate">{extra.name}</span>
                {showPrices !== false ? (
                  <>
                    <span className="text-[10px] text-muted-foreground">$</span>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      className="h-7 text-xs w-24 px-2"
                      value={extra.price}
                      onChange={(e) => updateExtraPrice(i, parseFloat(e.target.value) || 0)}
                      disabled={!canEdit}
                    />
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground italic w-24 text-center">—</span>
                )}
                {canEdit && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                    onClick={() => removeExtra(i)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add new extra — solo si canEdit */}
        {canEdit && (
          <div className="flex items-center gap-2">
            <Input
              placeholder="Nombre del extra"
              className="h-7 text-xs flex-1"
              value={newExtraName}
              onChange={(e) => setNewExtraName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addExtra())}
            />
            {showPrices !== false && (
              <span className="text-[10px] text-muted-foreground">$</span>
            )}
            <Input
              type="number"
              min={0}
              step="0.01"
              placeholder={showPrices !== false ? "0.00" : "—"}
              className="h-7 text-xs w-24 px-2"
              disabled={showPrices === false}
              value={showPrices !== false ? newExtraPrice : ""}
              onChange={(e) => showPrices !== false && setNewExtraPrice(e.target.value)}
              onKeyDown={(e) => showPrices !== false && e.key === "Enter" && (e.preventDefault(), addExtra())}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[11px] border-[#09919b]/40 text-[#09919b] hover:bg-[#09919b]/10 shrink-0"
              onClick={addExtra}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* [BLOQUE 5] Line subtotal — always visible when the user can see
          prices. Computed in real time from unit_price + extras × qty,
          mirrors the strict invoice formula. */}
      {showPrices && (
        <div className="flex items-baseline justify-between pt-2 border-t border-border/40">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Subtotal ítem
          </span>
          <span className="text-sm font-bold text-[#044c64] tabular-nums">
            ${formatNumber(lineSubtotal)}
          </span>
        </div>
      )}
    </div>
  );
}
