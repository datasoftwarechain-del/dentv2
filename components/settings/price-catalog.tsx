"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  DollarSign,
  BookOpen,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
interface Extra {
  name: string;
  price: number;
  max_qty?: number; // si > 1, muestra selector de cantidad en la orden
}

interface CatalogItem {
  id: string;
  org_id: string;
  category: string;
  name: string;
  base_price: number;
  extras: Extra[];
  is_active: boolean;
  sort_order: number;
}

interface EditForm {
  name: string;
  category: string;
  base_price: string;
  extras: Extra[];
}

interface PriceCatalogSectionProps {
  orgId: string;
  orgType: string; // "lab" | "dentist"
}

// ──────────────────────────────────────────────
// Arancel base DigitalDent 2026
// ──────────────────────────────────────────────
const DIGITALDENT_DEFAULT_CATALOG = [
  {
    categoria: "Tecnologia Cad-Cam",
    items: [
      {
        nombre:
          "Coronas / Incrustaciones / Piezas intermedias / Carillas / Rehab s/implantes",
        precio: 5200,
      },
      { nombre: "Coronas a perno", precio: 6500 },
      { nombre: "Disilicato de litio o Feldespato", precio: 6050 },
    ],
  },
  {
    categoria: "Ceramometalicas",
    items: [
      {
        nombre: "Jacket Ceramometalica y/o pieza intermedia (c/u)",
        precio: 4850,
      },
      { nombre: "Ceramometalica a perno", precio: 5200 },
    ],
  },
  {
    categoria: "Ceramage",
    items: [{ nombre: "Incrustacion o corona total", precio: 3950 }],
  },
  {
    categoria: "Metales",
    items: [
      { nombre: "Perno muñon", precio: 1750 },
      {
        nombre: "Incrustacion o corona (Cr.Ni incluye costo metal)",
        precio: 3000,
      },
    ],
  },
  {
    categoria: "Protesis",
    items: [
      { nombre: "Esqueleto de cromo (+envios)", precio: 4500 },
      { nombre: "Terminacion de 1 a 5", precio: 3390 },
      { nombre: "Terminacion de 6 a 10", precio: 3790 },
      { nombre: "Cubetas individuales", precio: 850 },
      { nombre: "Completa", precio: 4400 },
      { nombre: "PPR a placa", precio: 3500 },
      { nombre: "Ganchos labrados", precio: 250 },
      { nombre: "Tablilla de dientes", precio: 350 },
      { nombre: "Rebasados", precio: 2700 },
      { nombre: "DOE Termo", precio: 3800 },
      { nombre: "Fresada", precio: 3300 },
      { nombre: "Impresa", precio: 2900 },
      { nombre: "Reparaciones desde", precio: 1750 },
      { nombre: "Protesis provisoria desde", precio: 2250 },
    ],
  },
];

const EMPTY_FORM: EditForm = { name: "", category: "", base_price: "", extras: [] };

// ──────────────────────────────────────────────
// ExtrasEditor sub-componente
// ──────────────────────────────────────────────
function ExtrasEditor({
  extras,
  onChange,
}: {
  extras: Extra[];
  onChange: (extras: Extra[]) => void;
}) {
  function addExtra() {
    onChange([...extras, { name: "", price: 0, max_qty: 1 }]);
  }

  function updateExtra(i: number, field: keyof Extra, value: string | number) {
    onChange(extras.map((e, idx) => (idx === i ? { ...e, [field]: value } : e)));
  }

  function removeExtra(i: number) {
    onChange(extras.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">Extras / Adicionales</Label>
        <button
          type="button"
          onClick={addExtra}
          className="text-xs text-[#09919b] hover:text-[#044c64] flex items-center gap-1 font-medium"
        >
          <Plus className="h-3 w-3" /> Agregar extra
        </button>
      </div>
      {extras.length > 0 && (
        <div className="space-y-1.5 border rounded-md p-2 bg-muted/20">
          <div className="grid grid-cols-[1fr_80px_72px_20px] gap-1.5 mb-1">
            <span className="text-[10px] text-muted-foreground px-1">Nombre</span>
            <span className="text-[10px] text-muted-foreground px-1">Precio c/u</span>
            <span className="text-[10px] text-muted-foreground px-1">Cant. máx.</span>
            <span />
          </div>
          {extras.map((extra, i) => (
            <div key={i} className="grid grid-cols-[1fr_80px_72px_20px] gap-1.5 items-center">
              <Input
                placeholder="Ej: Tablilla de dientes"
                value={extra.name}
                onChange={(e) => updateExtra(i, "name", e.target.value)}
                className="h-7 text-xs"
              />
              <div className="relative">
                <span className="absolute left-2 top-1.5 text-[10px] text-muted-foreground">$</span>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={extra.price || ""}
                  onChange={(e) => updateExtra(i, "price", parseFloat(e.target.value) || 0)}
                  className="h-7 text-xs pl-5"
                />
              </div>
              <Input
                type="number"
                min="1"
                max="99"
                placeholder="1"
                title="Cantidad máxima seleccionable en la orden"
                value={extra.max_qty || 1}
                onChange={(e) => updateExtra(i, "max_qty", parseInt(e.target.value) || 1)}
                className="h-7 text-xs text-center"
              />
              <button
                type="button"
                onClick={() => removeExtra(i)}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <p className="text-[10px] text-muted-foreground pt-1">
            Cant. máx. = cuántas unidades puede elegir al crear una orden (ej: tablillas = 2)
          </p>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// PriceCatalogSection principal
// ──────────────────────────────────────────────
export function PriceCatalogSection({ orgId, orgType }: PriceCatalogSectionProps) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(EMPTY_FORM);

  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<EditForm>(EMPTY_FORM);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Load ──
  const loadCatalog = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("price_catalog")
      .select("*")
      .eq("org_id", orgId)
      .eq("is_active", true)
      .order("category")
      .order("sort_order")
      .order("name");

    if (error) {
      toast.error("Error al cargar el arancel");
    } else {
      setItems(data || []);
    }
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  // ── Agrupado por categoría ──
  const grouped = items.reduce<Record<string, CatalogItem[]>>((acc, item) => {
    const cat = item.category || "General";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});
  const categories = Object.keys(grouped).sort();

  // ── Add ──
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.name.trim() || !addForm.base_price) return;
    setSaving(true);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("price_catalog")
      .insert({
        org_id: orgId,
        category: addForm.category.trim() || "General",
        name: addForm.name.trim(),
        base_price: parseFloat(addForm.base_price),
        extras: addForm.extras,
        sort_order: items.length,
      })
      .select()
      .single();

    if (error) {
      toast.error("Error al agregar: " + error.message);
    } else {
      setItems((prev) => [...prev, data]);
      setAddForm(EMPTY_FORM);
      setShowAddForm(false);
      toast.success("Ítem agregado correctamente");
    }
    setSaving(false);
  }

  // ── Save edit ──
  async function handleSaveEdit(item: CatalogItem) {
    if (!editForm.name.trim() || !editForm.base_price) return;
    setSaving(true);

    const supabase = createClient();
    const { error } = await supabase
      .from("price_catalog")
      .update({
        name: editForm.name.trim(),
        category: editForm.category.trim() || item.category,
        base_price: parseFloat(editForm.base_price),
        extras: editForm.extras,
      })
      .eq("id", item.id);

    if (error) {
      toast.error("Error al guardar: " + error.message);
    } else {
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? {
                ...i,
                name: editForm.name.trim(),
                category: editForm.category.trim() || item.category,
                base_price: parseFloat(editForm.base_price),
                extras: editForm.extras,
              }
            : i
        )
      );
      setEditingId(null);
      toast.success("Cambios guardados");
    }
    setSaving(false);
  }

  // ── Delete ──
  async function handleDelete(id: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("price_catalog")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Error al eliminar: " + error.message);
    } else {
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast.success("Ítem eliminado");
    }
  }

  // ── Import default ──
  async function handleImportDefault() {
    setImporting(true);
    const supabase = createClient();

    const toInsert = DIGITALDENT_DEFAULT_CATALOG.flatMap((cat, ci) =>
      cat.items.map((item, ii) => ({
        org_id: orgId,
        category: cat.categoria,
        name: item.nombre,
        base_price: item.precio,
        extras: [],
        sort_order: ci * 100 + ii,
      }))
    );

    const { data, error } = await supabase
      .from("price_catalog")
      .insert(toInsert)
      .select();

    if (error) {
      toast.error("Error al importar: " + error.message);
    } else {
      setItems((prev) => [...prev, ...(data || [])]);
      toast.success(`${data?.length || 0} ítems importados del Arancel DigitalDent 2026`);
    }
    setImporting(false);
  }

  // ── Edit helpers ──
  function startEdit(item: CatalogItem) {
    setEditingId(item.id);
    setEditForm({
      name: item.name,
      category: item.category,
      base_price: item.base_price.toString(),
      extras: [...item.extras],
    });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  const isLab = orgType === "lab";
  const title = isLab ? "Mi Arancel" : "Mis Servicios";
  const description = isLab
    ? "Precios de tus trabajos. Se usan para completar facturas automáticamente."
    : "Precios de tus servicios. Se usan para generar facturas a pacientes.";

  // ── Loading ──
  if (loading) {
    return (
      <Card>
        <CardContent className="py-10 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 shrink-0" />
            <div>
              <CardTitle>{title}</CardTitle>
              <CardDescription className="mt-0.5">{description}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {items.length === 0 && isLab && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleImportDefault}
                disabled={importing}
              >
                {importing && (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                )}
                Importar Arancel Base
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => {
                setShowAddForm((v) => !v);
                setAddForm(EMPTY_FORM);
              }}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Agregar
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ── Formulario agregar ── */}
        {showAddForm && (
          <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
            <p className="text-sm font-semibold">Nuevo ítem</p>
            <form onSubmit={handleAdd} className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Categoría</Label>
                  <Input
                    placeholder="Ej: Prótesis"
                    value={addForm.category}
                    onChange={(e) =>
                      setAddForm((f) => ({ ...f, category: e.target.value }))
                    }
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Nombre <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    placeholder="Nombre del trabajo"
                    value={addForm.name}
                    onChange={(e) =>
                      setAddForm((f) => ({ ...f, name: e.target.value }))
                    }
                    className="h-8 text-sm"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Precio Base <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1.5 text-xs text-muted-foreground">
                      $
                    </span>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={addForm.base_price}
                      onChange={(e) =>
                        setAddForm((f) => ({ ...f, base_price: e.target.value }))
                      }
                      className="h-8 text-sm pl-6"
                      required
                    />
                  </div>
                </div>
              </div>

              <ExtrasEditor
                extras={addForm.extras}
                onChange={(extras) => setAddForm((f) => ({ ...f, extras }))}
              />

              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddForm(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={saving}>
                  {saving ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Guardar
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* ── Empty state ── */}
        {items.length === 0 && !showAddForm && (
          <div className="text-center py-12 border rounded-lg border-dashed border-border">
            <DollarSign className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              Sin precios configurados
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
              {isLab
                ? "Importá tu arancel base o agregá ítems manualmente."
                : "Agregá los servicios que ofrecés con sus precios."}
            </p>
            {isLab && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={handleImportDefault}
                disabled={importing}
              >
                {importing && (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                )}
                Importar Arancel DigitalDent 2026
              </Button>
            )}
          </div>
        )}

        {/* ── Ítems por categoría ── */}
        {categories.map((category) => (
          <div key={category} className="space-y-1">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1 pt-2">
              {category}
            </h4>
            <div className="border rounded-lg overflow-hidden divide-y divide-border/60">
              {grouped[category].map((item) =>
                editingId === item.id ? (
                  /* ── Modo edición ── */
                  <div key={item.id} className="p-4 bg-muted/20 space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Categoría</Label>
                        <Input
                          value={editForm.category}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              category: e.target.value,
                            }))
                          }
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Nombre</Label>
                        <Input
                          value={editForm.name}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              name: e.target.value,
                            }))
                          }
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Precio Base</Label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1.5 text-xs text-muted-foreground">
                            $
                          </span>
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={editForm.base_price}
                            onChange={(e) =>
                              setEditForm((f) => ({
                                ...f,
                                base_price: e.target.value,
                              }))
                            }
                            className="h-8 text-sm pl-6"
                          />
                        </div>
                      </div>
                    </div>

                    <ExtrasEditor
                      extras={editForm.extras}
                      onChange={(extras) =>
                        setEditForm((f) => ({ ...f, extras }))
                      }
                    />

                    <div className="flex gap-2 justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={cancelEdit}
                      >
                        <X className="mr-1.5 h-3.5 w-3.5" /> Cancelar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleSaveEdit(item)}
                        disabled={saving}
                      >
                        {saving ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Guardar
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* ── Modo vista ── */
                  <div key={item.id}>
                    <div className="flex items-center justify-between px-3 py-2.5 hover:bg-muted/20 transition-colors">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground shrink-0"
                          onClick={() =>
                            setExpandedId(
                              expandedId === item.id ? null : item.id
                            )
                          }
                          aria-label={
                            expandedId === item.id
                              ? "Colapsar extras"
                              : "Ver extras"
                          }
                        >
                          {item.extras.length > 0 ? (
                            expandedId === item.id ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )
                          ) : (
                            <div className="w-3.5" />
                          )}
                        </button>
                        <span className="text-sm font-medium truncate">
                          {item.name}
                        </span>
                        {item.extras.length > 0 && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 shrink-0"
                          >
                            +{item.extras.length} extras
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-3 ml-3 shrink-0">
                        <span className="text-sm font-bold text-[#044c64]">
                          ${item.base_price.toLocaleString("es-AR")}
                        </span>
                        <div className="flex gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => startEdit(item)}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(item.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Extras desplegados */}
                    {expandedId === item.id && item.extras.length > 0 && (
                      <div className="px-9 pb-3 pt-1 space-y-1 bg-muted/10">
                        {item.extras.map((extra, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between text-xs py-0.5"
                          >
                            <span className="text-muted-foreground">
                              + {extra.name}
                              {(extra.max_qty || 1) > 1 && (
                                <span className="ml-1.5 text-[10px] bg-muted px-1 py-0.5 rounded">
                                  hasta {extra.max_qty}
                                </span>
                              )}
                            </span>
                            <span className="font-semibold text-foreground/70">
                              ${extra.price.toLocaleString("es-AR")} c/u
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          </div>
        ))}

        {/* Resumen si hay items */}
        {items.length > 0 && (
          <p className="text-xs text-muted-foreground text-right pt-1">
            {items.length} {items.length === 1 ? "ítem" : "ítems"} en el
            catálogo
          </p>
        )}
      </CardContent>
    </Card>
  );
}
