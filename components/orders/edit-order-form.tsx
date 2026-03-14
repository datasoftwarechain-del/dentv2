"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
  AlertCircle, Package,
} from "lucide-react";

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

interface OrderItem {
  id: string;
  work_type: string | null;
  tooth_positions: string | null;
  shade: string | null;
  quantity: number;
  unit_price: number | null;
  selected_extras: Extra[];
  catalog_item_name?: string | null;
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
  };
}

export function EditOrderForm({
  order,
  patients,
  organizationId,
  isDentist,
  showPrices = true,
}: EditOrderFormProps) {
  const router = useRouter();
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

  // ─────────────────────────────────────────────────────────
  // Submit
  // ─────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const supabase = createClient();

      // Compute due_date ISO string
      let scheduledDue: string | null = null;
      if (dueDate) {
        const timeStr = dueTime || "09:00";
        scheduledDue = new Date(`${dueDate}T${timeStr}:00`).toISOString();
      }

      // 1. Update order record
      const { error: orderError } = await supabase
        .from("lab_orders")
        .update({
          patient_id: patientId || null,
          status,
          priority,
          due_date: scheduledDue,
          notes: notes.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);

      if (orderError) throw orderError;

      // 2. Delete removed items
      if (deletedItemIds.length > 0) {
        const { error: delError } = await supabase
          .from("lab_order_items")
          .delete()
          .in("id", deletedItemIds);
        if (delError) throw delError;
      }

      // helper: form stores tooth_positions as a plain string; DB column is text[]
      function toToothArray(s: string | null): string[] | null {
        if (!s || !s.trim()) return null;
        return s.split(",").map((v) => v.trim()).filter(Boolean);
      }

      // 3. Update existing items
      for (const item of existingItems) {
        const { error: updError } = await supabase
          .from("lab_order_items")
          .update({
            work_type: item.work_type || null,
            tooth_positions: toToothArray(item.tooth_positions),
            shade: item.shade || null,
            quantity: item.quantity || 1,
            selected_extras: item.selected_extras,
          })
          .eq("id", item.id);
        if (updError) throw updError;
      }

      // 4. Insert new items
      const itemsToInsert = newItems
        .filter((i) => i.work_type)
        .map(({ _tempId: _, ...item }) => ({
          order_id: order.id,
          work_type: item.work_type || null,
          tooth_positions: toToothArray(item.tooth_positions),
          shade: item.shade || null,
          quantity: item.quantity || 1,
          unit_price: item.unit_price || null,
          selected_extras: item.selected_extras,
        }));

      if (itemsToInsert.length > 0) {
        const { error: insError } = await supabase
          .from("lab_order_items")
          .insert(itemsToInsert);
        if (insError) throw insError;
      }

      toast.success("Orden actualizada correctamente");
      window.location.href = `/dashboard/orders/${order.id}`;
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
            />
          </div>

          {/* Status + Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Estado</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
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
                <SelectTrigger>
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
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Hora de Entrega</Label>
              <Input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
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
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Items card ── */}
      <Card className="border-2 border-[#b0dde0] shadow-premium">
        <CardHeader className="bg-gradient-to-br from-[#f0fafb] to-white border-b border-[#d2f2f3]">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-bold text-[#044c64] flex items-center gap-2">
                <Package className="h-5 w-5" />
                Ítems de la Orden
              </CardTitle>
              <CardDescription>Editá, eliminá o agregá ítems de trabajo</CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-[#09919b] text-[#09919b] hover:bg-[#09919b]/10"
              onClick={() => setNewItems((prev) => [...prev, blankItem()])}
            >
              <Plus className="h-4 w-4 mr-1" />
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
              toothPositions={item.tooth_positions || ""}
              shade={item.shade || ""}
              quantity={item.quantity}
              extras={item.selected_extras}
              showPrices={showPrices}
              onWorkTypeChange={(v) => updateExistingItem(item.id, "work_type", v)}
              onToothChange={(v) => updateExistingItem(item.id, "tooth_positions", v)}
              onShadeChange={(v) => updateExistingItem(item.id, "shade", v)}
              onQuantityChange={(v) => updateExistingItem(item.id, "quantity", v)}
              onExtrasChange={(extras) => setExistingItems((prev) =>
                prev.map((i) => i.id === item.id ? { ...i, selected_extras: extras } : i)
              )}
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
              catalogName={null}
              toothPositions={item.tooth_positions || ""}
              shade={item.shade || ""}
              quantity={item.quantity}
              extras={item.selected_extras}
              showPrices={showPrices}
              onWorkTypeChange={(v) => updateNewItem(item._tempId, "work_type", v)}
              onToothChange={(v) => updateNewItem(item._tempId, "tooth_positions", v)}
              onShadeChange={(v) => updateNewItem(item._tempId, "shade", v)}
              onQuantityChange={(v) => updateNewItem(item._tempId, "quantity", v)}
              onExtrasChange={(extras) => setNewItems((prev) =>
                prev.map((i) => i._tempId === item._tempId ? { ...i, selected_extras: extras } : i)
              )}
              onRemove={() => removeNewItem(item._tempId)}
            />
          ))}
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
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={loading}
          className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Guardar cambios
        </Button>
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
  toothPositions: string;
  shade: string;
  quantity: number;
  extras: Extra[];
  showPrices?: boolean;
  onWorkTypeChange: (v: string) => void;
  onToothChange: (v: string) => void;
  onShadeChange: (v: string) => void;
  onQuantityChange: (v: number) => void;
  onExtrasChange: (extras: Extra[]) => void;
  onRemove: () => void;
}

function ItemRow({
  index,
  isNew,
  workType,
  catalogName,
  toothPositions,
  shade,
  quantity,
  extras,
  showPrices = true,
  onWorkTypeChange,
  onToothChange,
  onShadeChange,
  onQuantityChange,
  onExtrasChange,
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

  return (
    <div className="rounded-xl border border-border/60 bg-muted/10 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          Ítem {index + 1}
          {isNew && (
            <Badge variant="outline" className="ml-2 text-[10px] border-[#09919b]/40 text-[#09919b]">
              Nuevo
            </Badge>
          )}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={onRemove}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Work type */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Tipo de trabajo</Label>
        {catalogName && !isNew ? (
          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-foreground">{catalogName}</p>
            <p className="text-[11px] text-muted-foreground">
              Clasificación: {formatWorkType(workType)}
            </p>
          </div>
        ) : (
          <Select value={workType || undefined} onValueChange={onWorkTypeChange}>
            <SelectTrigger className="h-9 text-sm">
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
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Color / Shade</Label>
          <Input
            placeholder="Ej. A2"
            className="h-9 text-sm"
            value={shade}
            onChange={(e) => onShadeChange(e.target.value)}
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
                    />
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground italic w-24 text-center">—</span>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                  onClick={() => removeExtra(i)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Add new extra */}
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
      </div>
    </div>
  );
}
