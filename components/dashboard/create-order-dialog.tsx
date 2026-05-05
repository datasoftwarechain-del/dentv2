"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactDOM from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Plus, Loader2, User, Building2, Ticket,
    Calendar, FileText, Info, Clock, ChevronDown,
    Trash2, Copy, Package,
} from "lucide-react";
import { toast } from "sonner";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/date-utils";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
interface Patient {
    id: string;
    first_name: string;
    last_name: string;
}

interface Organization {
    id: string;
    name: string;
}

interface Extra {
    name: string;
    price: number;
    max_qty?: number; // si > 1, muestra selector de cantidad en lugar de checkbox
}

interface SelectedExtra {
    name: string;
    price: number; // precio unitario
    qty: number;   // cantidad elegida
}

interface CatalogItem {
    id: string;
    category: string;
    name: string;
    base_price: number;
    extras: Extra[];
}

// [BLOQUE 7] Multi-item draft. Matches the lab_order_items shape we
// will insert at submit. _tempId stays only in client memory.
interface OrderItemDraft {
    _tempId: string;
    catalogItemId: string;
    catalogItemName: string | null;
    workType: string;
    toothNumbers: string;
    shade: string;
    quantity: number;
    unitPrice: number;
    selectedExtras: SelectedExtra[];
}

function blankOrderItem(): OrderItemDraft {
    return {
        _tempId: typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        catalogItemId: "",
        catalogItemName: null,
        workType: "",
        toothNumbers: "",
        shade: "",
        quantity: 1,
        unitPrice: 0,
        selectedExtras: [],
    };
}

interface CreateOrderDialogProps {
    organizationId: string;
    patients: Patient[];
    labs: Organization[];
    children?: React.ReactNode;
    mode?: "dentist" | "lab";
    defaultLabId?: string | null;
    showPrices?: boolean;
}

// ──────────────────────────────────────────────
// Fallback: tipos de trabajo (enum DB)
// ──────────────────────────────────────────────
const workTypes = [
    { value: "corona_metal_ceramica", label: "Corona Metal-Cerámica" },
    { value: "corona_zirconia",       label: "Corona Zirconia" },
    { value: "corona_emax",           label: "Corona Emax" },
    { value: "puente_fijo",           label: "Puente Fijo" },
    { value: "protesis_removible",    label: "Prótesis Removible" },
    { value: "protesis_total",        label: "Prótesis Total" },
    { value: "implante_corona",       label: "Corona sobre Implante" },
    { value: "carilla",               label: "Carilla" },
    { value: "incrustacion",          label: "Incrustación" },
    { value: "ferula",                label: "Férula" },
    { value: "retenedor",             label: "Retenedor" },
    { value: "reparacion",            label: "Reparación" },
    { value: "otro",                  label: "Otro" },
];

// ──────────────────────────────────────────────
// Mapeo nombre libre → work_type enum (best effort)
// ──────────────────────────────────────────────
function guessWorkType(name: string): string {
    const n = name.toLowerCase();
    if (n.includes("zirconia"))                                        return "corona_zirconia";
    if (n.includes("emax") || n.includes("disilicato") || n.includes("feldespato")) return "corona_emax";
    if (n.includes("ceramometal") || n.includes("jacket"))             return "corona_metal_ceramica";
    if (n.includes("carilla"))                                         return "carilla";
    if (n.includes("incrustacion") || n.includes("incrustación"))      return "incrustacion";
    if (n.includes("corona") || n.includes("perno"))                   return "corona_metal_ceramica";
    if (n.includes("puente"))                                          return "puente_fijo";
    if (n.includes("implante"))                                        return "implante_corona";
    if (n.includes("completa"))                                        return "protesis_total";
    if (
        n.includes("protesis") || n.includes("prótesis") ||
        n.includes("esqueleto") || n.includes("ppr") ||
        n.includes("doe") || n.includes("terminacion") ||
        n.includes("rebasado") || n.includes("fresada") ||
        n.includes("impresa") || n.includes("cubeta")
    )                                                                  return "protesis_removible";
    if (n.includes("ferula") || n.includes("férula"))                  return "ferula";
    if (n.includes("retenedor"))                                       return "retenedor";
    if (n.includes("reparacion") || n.includes("reparación"))          return "reparacion";
    return "otro";
}


// ──────────────────────────────────────────────
// CatalogPicker: dropdown inline (evita problemas de portal dentro del Dialog)
// ──────────────────────────────────────────────
interface CatalogPickerProps {
    value: string;
    onChange: (id: string) => void;
    categories: string[];
    grouped: Record<string, CatalogItem[]>;
    items: CatalogItem[];
    placeholder?: string;
    showPrices?: boolean;
    organizationId?: string;
    onItemCreated?: (item: CatalogItem) => void;
}

function CatalogPicker({
    value, onChange, categories, grouped, items,
    placeholder = "Seleccionar trabajo del arancel",
    showPrices = true,
    organizationId,
    onItemCreated,
}: CatalogPickerProps) {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
    const buttonRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const selected = items.find((i) => i.id === value);

    // Create new catalog item
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState("");
    const [newCategory, setNewCategory] = useState("");
    const [newPrice, setNewPrice] = useState("");
    const [saving, setSaving] = useState(false);

    function openCreate() {
        setNewName(search);
        setNewCategory(categories[0] || "");
        setNewPrice("");
        setCreating(true);
    }

    function cancelCreate() {
        setCreating(false);
        setNewName("");
        setNewCategory("");
        setNewPrice("");
        setTimeout(() => searchRef.current?.focus(), 10);
    }

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        if (!newName.trim() || !organizationId) return;
        setSaving(true);
        try {
            const supabase = createClient();
            const { data, error } = await supabase
                .from("price_catalog")
                .insert({
                    org_id: organizationId,
                    name: newName.trim(),
                    category: newCategory.trim() || "GENERAL",
                    base_price: parseFloat(newPrice) || 0,
                    is_active: true,
                    extras: [],
                })
                .select("id, category, name, base_price, extras")
                .single();
            if (error) throw error;
            onItemCreated?.(data as CatalogItem);
            onChange(data.id);
            setDropdownOpen(false);
            setCreating(false);
        } catch (err: any) {
            // silently fail — parent handles toast if needed
            console.error("Error creating catalog item:", err);
        } finally {
            setSaving(false);
        }
    }

    const updatePosition = useCallback(() => {
        if (!buttonRef.current) return;
        const rect = buttonRef.current.getBoundingClientRect();
        setDropdownStyle({
            position: "fixed",
            top: rect.bottom + 4,
            left: rect.left,
            width: rect.width,
            zIndex: 9999,
        });
    }, []);

    useEffect(() => {
        if (!dropdownOpen) { setSearch(""); return; }
        updatePosition();
        setTimeout(() => searchRef.current?.focus(), 10);
    }, [dropdownOpen, updatePosition]);

    useEffect(() => {
        if (!dropdownOpen) return;
        function handleClickOutside(e: MouseEvent) {
            if (
                buttonRef.current && !buttonRef.current.contains(e.target as Node) &&
                dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
            ) {
                setDropdownOpen(false);
            }
        }
        function handleScroll() { updatePosition(); }
        document.addEventListener("mousedown", handleClickOutside);
        window.addEventListener("scroll", handleScroll, true);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            window.removeEventListener("scroll", handleScroll, true);
        };
    }, [dropdownOpen, updatePosition]);

    // Filter items across all categories
    const { filteredCategories, filteredGrouped } = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return { filteredCategories: categories, filteredGrouped: grouped };
        const fg: Record<string, CatalogItem[]> = {};
        const fc: string[] = [];
        for (const cat of categories) {
            const matches = (grouped[cat] || []).filter((i) => i.name.toLowerCase().includes(q));
            if (matches.length > 0) { fg[cat] = matches; fc.push(cat); }
        }
        return { filteredCategories: fc, filteredGrouped: fg };
    }, [search, categories, grouped]);

    const dropdown = dropdownOpen ? (
        <div ref={dropdownRef} style={dropdownStyle} className="rounded-md border border-border bg-popover shadow-lg">
            {creating ? (
                /* ── Formulario crear nuevo ítem ── */
                <form onSubmit={handleCreate} className="p-3 space-y-2">
                    <p className="text-xs font-bold text-[#044c64] uppercase tracking-wide mb-1">Nuevo trabajo al arancel</p>
                    <input
                        type="text"
                        placeholder="Nombre del trabajo *"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        required
                        autoFocus
                        className="w-full px-3 h-8 text-sm border border-border/60 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 bg-background placeholder:text-muted-foreground"
                    />
                    <input
                        type="text"
                        placeholder="Categoría (ej: ZIRCONIA)"
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        list="catalog-categories"
                        className="w-full px-3 h-8 text-sm border border-border/60 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 bg-background placeholder:text-muted-foreground"
                    />
                    <datalist id="catalog-categories">
                        {categories.map((c) => <option key={c} value={c} />)}
                    </datalist>
                    {showPrices && (
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">$</span>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="Precio base"
                                value={newPrice}
                                onChange={(e) => setNewPrice(e.target.value)}
                                className="flex-1 px-3 h-8 text-sm border border-border/60 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 bg-background placeholder:text-muted-foreground"
                            />
                        </div>
                    )}
                    <div className="flex gap-2 pt-1">
                        <button
                            type="button"
                            onClick={cancelCreate}
                            className="flex-1 h-8 text-xs rounded-md border border-border/60 hover:bg-muted transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={!newName.trim() || saving}
                            className="flex-1 h-8 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
                        >
                            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                            Guardar y seleccionar
                        </button>
                    </div>
                </form>
            ) : (
                <>
                    {/* Search input */}
                    <div className="p-2 border-b border-border/40">
                        <input
                            ref={searchRef}
                            type="text"
                            placeholder="Buscar en arancel..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full px-3 h-8 text-sm border border-border/60 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 bg-background placeholder:text-muted-foreground"
                        />
                    </div>
                    <div className="max-h-[220px] overflow-y-auto">
                        {filteredCategories.length === 0 ? (
                            <div className="px-4 py-4 text-center text-xs text-muted-foreground">Sin resultados.</div>
                        ) : (
                            filteredCategories.map((cat) => (
                                <React.Fragment key={cat}>
                                    <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/50 sticky top-0">
                                        {cat}
                                    </div>
                                    {filteredGrouped[cat].map((item) => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => { onChange(item.id); setDropdownOpen(false); }}
                                            className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between gap-3 hover:bg-muted transition-colors ${value === item.id ? "bg-muted font-medium" : ""}`}
                                        >
                                            <span>{item.name}</span>
                                        </button>
                                    ))}
                                </React.Fragment>
                            ))
                        )}
                    </div>
                    {/* Agregar nuevo al arancel */}
                    {organizationId && (
                        <div className="border-t border-border/40 p-2">
                            <button
                                type="button"
                                onClick={openCreate}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-primary hover:bg-primary/5 rounded-md transition-colors font-medium"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                {search.trim() ? `Agregar "${search.trim()}" al arancel` : "Agregar nuevo al arancel"}
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    ) : null;

    return (
        <div className="relative">
            <button
                ref={buttonRef}
                type="button"
                onClick={() => setDropdownOpen((p) => !p)}
                className="w-full flex items-center justify-between pl-8 pr-3 h-9 text-sm rounded-md border border-[#b0dde0] bg-background hover:border-[#09919b] focus:outline-none focus:ring-2 focus:ring-[#09919b]/20 focus:border-[#09919b] transition-colors"
            >
                <span className={`flex items-center gap-2 min-w-0 ${selected ? "text-foreground" : "text-muted-foreground"}`}>
                    <span className="truncate">{selected ? selected.name : placeholder}</span>
                </span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
            </button>
            {typeof document !== "undefined" && ReactDOM.createPortal(dropdown, document.body)}
        </div>
    );
}

// ──────────────────────────────────────────────
// Componente principal
// ──────────────────────────────────────────────
export function CreateOrderDialog({
    organizationId, patients, labs, children, mode = "dentist", defaultLabId, showPrices = true,
}: CreateOrderDialogProps) {
    const router = useRouter();
    const [open, setOpen]       = useState(false);
    const [loading, setLoading] = useState(false);

    // Patient / clinic manual entry
    const [useManualPatient, setUseManualPatient] = useState(false);
    const [manualPatientName, setManualPatientName] = useState("");
    const [useManualClinic, setUseManualClinic]   = useState(false);
    const [manualClinicName, setManualClinicName]   = useState("");

    // Form — order-level fields only. Item-level fields live in items[] (BLOQUE 7).
    const [formData, setFormData] = useState({
        patientId:    "",
        targetOrgId:  (mode === "dentist" && defaultLabId) ? defaultLabId : "",
        notes:        "",
        dueDate:      "",
        dueTime:      "",
        priority:     "normal" as "low" | "normal" | "high" | "urgent",
    });

    // [BLOQUE 7] Multi-item state. Always at least 1 item; the form opens
    // with a single blank item and the user can add more.
    const [items, setItems] = useState<OrderItemDraft[]>(() => [blankOrderItem()]);

    // Catalog (catálogo del lab; en modo dentist se carga del lab seleccionado)
    const [catalogItems, setCatalogItems]               = useState<CatalogItem[]>([]);
    const [catalogLoading, setCatalogLoading]           = useState(false);

    // ── Cargar catálogo cuando abre el dialog en modo lab ──
    useEffect(() => {
        if (!open || mode !== "lab") return;
        let cancelled = false;

        async function loadCatalog() {
            setCatalogLoading(true);
            const supabase = createClient();
            const { data } = await supabase
                .from("price_catalog")
                .select("id, category, name, base_price, extras")
                .eq("org_id", organizationId)
                .eq("is_active", true)
                .order("category")
                .order("sort_order")
                .order("name");

            if (!cancelled) {
                setCatalogItems(data || []);
                setCatalogLoading(false);
            }
        }

        loadCatalog();
        return () => { cancelled = true; };
    }, [open, mode, organizationId]);

    // ── Dentist mode: cargar catálogo del lab seleccionado al cambiar ──
    useEffect(() => {
        if (!open || mode !== "dentist") return;
        if (!formData.targetOrgId) {
            setCatalogItems([]);
            return;
        }
        let cancelled = false;

        // Resetear items al cambiar de laboratorio (precios eran de otro arancel).
        setItems([blankOrderItem()]);

        async function loadLabCatalog() {
            setCatalogLoading(true);
            try {
                // API route usa service role → bypasea RLS que bloquea al dentista
                const res = await fetch(`/api/catalog/${formData.targetOrgId}`);
                const json = res.ok ? await res.json() : { catalog: [] };
                if (!cancelled) setCatalogItems(json.catalog ?? []);
            } catch {
                if (!cancelled) setCatalogItems([]);
            } finally {
                if (!cancelled) setCatalogLoading(false);
            }
        }

        loadLabCatalog();
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, mode, formData.targetOrgId]);

    // Catálogo agrupado por categoría
    const catalogGrouped = catalogItems.reduce<Record<string, CatalogItem[]>>((acc, item) => {
        const cat = item.category || "General";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
    }, {});
    const catalogCategories = Object.keys(catalogGrouped).sort();
    const hasCatalog   = catalogItems.length > 0;
    // Mostrar catálogo si el lab tiene items; en dentista sólo cuando ya eligió uno
    const showCatalog  = hasCatalog && (mode === "lab" || (mode === "dentist" && !!formData.targetOrgId));
    const showFallback = !showCatalog && !catalogLoading;

    // [BLOQUE 7] Item helpers (per-item versions of the old single-item logic).
    function patchItem(tempId: string, patch: Partial<OrderItemDraft>) {
        setItems((prev) => prev.map((it) => (it._tempId === tempId ? { ...it, ...patch } : it)));
    }

    function addItem() {
        setItems((prev) => [...prev, blankOrderItem()]);
    }

    function removeItem(tempId: string) {
        setItems((prev) => (prev.length > 1 ? prev.filter((it) => it._tempId !== tempId) : prev));
    }

    function duplicateItem(tempId: string) {
        setItems((prev) => {
            const src = prev.find((it) => it._tempId === tempId);
            if (!src) return prev;
            return [
                ...prev,
                {
                    ...src,
                    _tempId: typeof crypto !== "undefined" && crypto.randomUUID
                        ? crypto.randomUUID()
                        : `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                    selectedExtras: src.selectedExtras.map((e) => ({ ...e })),
                },
            ];
        });
    }

    // ── Seleccionar ítem del catálogo (para un item específico) ──
    function handleCatalogSelect(tempId: string, catalogId: string) {
        const cat = catalogItems.find((i) => i.id === catalogId);
        if (!cat) return;
        patchItem(tempId, {
            catalogItemId:   cat.id,
            catalogItemName: cat.name,
            workType:        guessWorkType(cat.name),
            unitPrice:       cat.base_price,
            selectedExtras:  [],
        });
    }

    // ── Actualizar cantidad de un extra (0 = deseleccionado) para un item ──
    function updateExtraQty(tempId: string, extra: Extra, qty: number) {
        const item = items.find((it) => it._tempId === tempId);
        if (!item) return;
        const cat = catalogItems.find((c) => c.id === item.catalogItemId);
        const basePrice = cat?.base_price ?? item.unitPrice;
        const clampedQty = Math.max(0, Math.min(qty, extra.max_qty || 1));

        const existing = item.selectedExtras.find((e) => e.name === extra.name);
        const newExtras = clampedQty === 0
            ? item.selectedExtras.filter((e) => e.name !== extra.name)
            : existing
                ? item.selectedExtras.map((e) => (e.name === extra.name ? { ...e, qty: clampedQty } : e))
                : [...item.selectedExtras, { name: extra.name, price: extra.price, qty: clampedQty }];

        const extrasTotal = newExtras.reduce((s, e) => s + e.price * e.qty, 0);

        patchItem(tempId, {
            selectedExtras: newExtras,
            unitPrice: basePrice + extrasTotal,
        });
    }

    // ── Total estimado en vivo (sum across items) ──
    const liveTotal = items.reduce((sum, it) => sum + (it.unitPrice * (it.quantity || 1)), 0);

    // ── Reset form ──
    function resetForm() {
        setFormData({
            patientId:    "",
            targetOrgId:  (mode === "dentist" && defaultLabId) ? defaultLabId : "",
            notes:        "",
            dueDate:      "",
            dueTime:      "",
            priority:     "normal",
        });
        setUseManualPatient(false);
        setManualPatientName("");
        setUseManualClinic(false);
        setManualClinicName("");
        setItems([blankOrderItem()]);
    }

    // ── Crear orden ──
    async function handleCreateOrder(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);

        try {
            // [BLOQUE 7] Validar que haya al menos un item con tipo de trabajo o catálogo.
            const validItems = items.filter((it) => it.workType || it.catalogItemId);
            if (validItems.length === 0) {
                toast.error("Agregá al menos un ítem con tipo de trabajo");
                setLoading(false);
                return;
            }
            if (mode === "lab" && useManualClinic && !manualClinicName.trim()) {
                toast.error("Por favor ingresa el nombre de la clínica");
                setLoading(false);
                return;
            }
            if (!useManualClinic && !formData.targetOrgId) {
                toast.error(
                    mode === "dentist"
                        ? "Por favor selecciona un laboratorio"
                        : "Por favor selecciona una clínica"
                );
                setLoading(false);
                return;
            }
            if (useManualPatient && !manualPatientName.trim()) {
                toast.error("Por favor ingresa el nombre del paciente");
                setLoading(false);
                return;
            }
            // En modo lab el paciente es opcional
            if (mode !== "lab" && !useManualPatient && !formData.patientId) {
                toast.error("Por favor selecciona un paciente");
                setLoading(false);
                return;
            }

            const supabase = createClient();
            let finalTargetOrgId = formData.targetOrgId;

            // Crear clínica manual (lab mode)
            if (mode === "lab" && useManualClinic && manualClinicName && !finalTargetOrgId) {
                const { data: newOrg, error: orgError } = await supabase
                    .from("organizations")
                    .insert({
                        name: manualClinicName.trim(),
                        type: "dentist",
                        is_system_account: false,
                    })
                    .select("id")
                    .single();

                if (orgError) throw new Error(`Error al crear clínica: ${orgError.message}`);
                if (!newOrg) throw new Error("No se pudo crear la clínica");
                finalTargetOrgId = newOrg.id;

                await supabase.from("lab_dentist_relations").insert({
                    lab_org_id: organizationId,
                    dentist_org_id: finalTargetOrgId,
                    status: "active",
                });
            }

            const dentistOrgId = mode === "dentist" ? organizationId : finalTargetOrgId;
            const labOrgId     = mode === "dentist" ? finalTargetOrgId : organizationId;

            // Crear paciente manual
            let finalPatientId = formData.patientId;
            if (useManualPatient && manualPatientName.trim() && !finalPatientId) {
                const nameParts = manualPatientName.trim().split(" ");
                const firstName = nameParts[0] || manualPatientName;
                const lastName  = nameParts.slice(1).join(" ") || "";

                const { data: newPatient, error: patientError } = await supabase
                    .from("patients")
                    .insert({ dentist_org_id: dentistOrgId, first_name: firstName, last_name: lastName })
                    .select("id")
                    .single();

                if (patientError) {
                    if (mode === "lab") {
                        // En modo lab el paciente es opcional; si falla por permisos continuamos sin él
                        console.warn("No se pudo crear paciente desde modo lab:", patientError.message);
                    } else {
                        throw new Error(`Error al crear paciente: ${patientError.message}`);
                    }
                } else if (newPatient) {
                    finalPatientId = newPatient.id;
                }
            }

            // Auto-relación lab-dentist
            if (mode === "dentist" && labOrgId) {
                await supabase.from("lab_dentist_relations").upsert({
                    lab_org_id:     labOrgId,
                    dentist_org_id: dentistOrgId,
                    status:         "active",
                }, { onConflict: "lab_org_id,dentist_org_id", ignoreDuplicates: true });
            }

            // Número de orden
            const { data: latestOrders } = await supabase
                .from("lab_orders")
                .select("order_number")
                .order("created_at", { ascending: false })
                .limit(100);

            let nextOrderNumber = 1;
            if (latestOrders && latestOrders.length > 0) {
                const nums = latestOrders
                    .map((o) => { const m = o.order_number.match(/ORDEN (\d+)/); return m ? parseInt(m[1], 10) : 0; })
                    .filter((n) => !isNaN(n));
                if (nums.length > 0) nextOrderNumber = Math.max(...nums) + 1;
            }
            const orderNumber = `ORDEN ${nextOrderNumber}`;

            // Timestamp fecha entrega
            let dueDateTimestamp = null;
            if (formData.dueDate) {
                const timeStr = formData.dueTime || "18:00";
                dueDateTimestamp = `${formData.dueDate}T${timeStr}:00`;
            }

            // Crear orden
            const { data: orderData, error: orderError } = await supabase
                .from("lab_orders")
                .insert({
                    order_number:   orderNumber,
                    dentist_org_id: dentistOrgId,
                    lab_org_id:     labOrgId,
                    patient_id:     finalPatientId || null,
                    due_date:       dueDateTimestamp,
                    notes:          formData.notes || null,
                    status:         "received",
                    priority:       formData.priority,
                })
                .select()
                .single();

            if (orderError) throw new Error(`Error al crear orden: ${orderError.message}`);
            if (!orderData) throw new Error("No se pudo crear la orden");

            // [BLOQUE 7] Crear N items de orden — bulk insert
            const itemRows = validItems.map((it) => {
                const toothArray = it.toothNumbers
                    ? it.toothNumbers.split(",").map((s) => s.trim()).filter(Boolean)
                    : [];
                return {
                    order_id:         orderData.id,
                    work_type:        it.workType || "otro",
                    tooth_positions:  toothArray.length > 0 ? toothArray : null,
                    shade:            it.shade || null,
                    quantity:         it.quantity || 1,
                    unit_price:       it.unitPrice > 0 ? it.unitPrice : null,
                    catalog_item_id:  it.catalogItemId || null,
                    selected_extras:  it.selectedExtras.length > 0
                        ? it.selectedExtras.map((e) => ({ name: e.name, price: e.price, qty: e.qty }))
                        : [],
                };
            });

            const { error: itemError } = await supabase.from("lab_order_items").insert(itemRows);
            if (itemError) throw new Error(`Error al crear items: ${itemError.message}`);

            // Mensaje de éxito
            const created: string[] = [];
            if (mode === "lab" && useManualClinic) created.push("Clínica");
            if (useManualPatient) created.push("Paciente");

            toast.success("Orden creada exitosamente", {
                description: created.length > 0
                    ? `${created.join(" y ")} creado${created.length > 1 ? "s" : ""} automáticamente`
                    : undefined,
            });

            setOpen(false);
            resetForm();
            router.refresh();

        } catch (error: any) {
            console.error("Error creating order:", error);
            toast.error("Error al crear el pedido", {
                description: error?.message || "Error desconocido",
            });
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
                {children || (
                    <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-all duration-200">
                        <Plus className="mr-2 h-4 w-4" />
                        Crear Orden
                    </Button>
                )}
            </DialogTrigger>

            <DialogContent className="sm:max-w-[660px] p-0 border-border bg-background shadow-2xl max-h-[92vh] overflow-hidden flex flex-col">

                {/* ── Header ── */}
                <div className="relative overflow-hidden bg-gradient-to-br from-[#044c64] via-[#0d687d] to-[#09919b] px-6 py-5 shrink-0">
                    <div className="absolute -top-12 -right-12 h-48 w-48 rounded-full bg-white/5 blur-2xl" />
                    <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-[#43eada]/10 blur-xl" />
                    <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                    <div className="relative z-10 flex items-start justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-2.5">
                                <img src="/logo.png" alt="DigitalDent" className="h-5 w-5 rounded" />
                                <span className="text-[10px] font-bold text-white/45 uppercase tracking-[0.2em]">
                                    DigitalDent · Lab
                                </span>
                            </div>
                            <h2 className="text-[19px] font-bold text-white leading-tight">
                                {mode === "lab" ? "Registrar Orden Manual" : "Nueva Orden de Laboratorio"}
                            </h2>
                        </div>
                        <div className="text-right shrink-0 ml-4 mt-0.5">
                            <p className="text-[9px] text-white/35 uppercase tracking-widest mb-1">N° Orden</p>
                            <div className="h-7 w-16 rounded-md border border-white/15 bg-white/8 flex items-center justify-center">
                                <span className="text-[11px] font-mono font-bold text-white/35">AUTO</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Form ── */}
                <form onSubmit={handleCreateOrder} className="flex-1 overflow-y-auto">
                    <div className="px-6 py-5 space-y-5">

                        {/* 01 · Partes */}
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <span className="text-[9px] font-black text-[#09919b] uppercase tracking-[0.15em]">01</span>
                                <div className="h-px flex-1 bg-[#d2f2f3]" />
                                <span className="text-[9px] font-bold text-[#09919b]/60 uppercase tracking-widest">Partes</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                {/* Paciente */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-[11px] font-bold uppercase tracking-wide text-[#044c64]">
                                            Paciente{" "}
                                            {mode === "lab" && (
                                                <span className="text-[10px] font-normal text-muted-foreground normal-case tracking-normal">
                                                    (opcional)
                                                </span>
                                            )}
                                        </Label>
                                        <label htmlFor="manualPatient" className="flex items-center gap-1.5 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                id="manualPatient"
                                                checked={useManualPatient}
                                                onChange={(e) => {
                                                    setUseManualPatient(e.target.checked);
                                                    if (e.target.checked) setFormData({ ...formData, patientId: "" });
                                                }}
                                                className="h-3 w-3 rounded border-[#b0dde0] accent-[#09919b]"
                                            />
                                            <span className="text-[10px] text-[#09919b]">Nuevo</span>
                                        </label>
                                    </div>
                                    {useManualPatient ? (
                                        <div className="relative">
                                            <User className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#09919b]" />
                                            <Input
                                                placeholder="Nombre completo"
                                                value={manualPatientName}
                                                onChange={(e) => setManualPatientName(e.target.value)}
                                                className="pl-8 h-9 text-sm border-[#b0dde0] focus-visible:ring-[#09919b]/20 focus-visible:border-[#09919b]"
                                                required={useManualPatient}
                                            />
                                        </div>
                                    ) : (
                                        <Combobox
                                            options={patients.map((p) => ({ value: p.id, label: `${p.first_name} ${p.last_name}` }))}
                                            value={formData.patientId}
                                            onValueChange={(v) => setFormData({ ...formData, patientId: v })}
                                            placeholder="Seleccionar paciente"
                                            searchPlaceholder="Buscar paciente..."
                                            emptyText="Sin pacientes"
                                            className="border-[#b0dde0]"
                                        />
                                    )}
                                </div>

                                {/* Clínica / Lab */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-[11px] font-bold uppercase tracking-wide text-[#044c64]">
                                            {mode === "dentist" ? "Laboratorio" : "Dr / Clínica"}
                                        </Label>
                                        {mode === "lab" && (
                                            <label htmlFor="manualClinic" className="flex items-center gap-1.5 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    id="manualClinic"
                                                    checked={useManualClinic}
                                                    onChange={(e) => {
                                                        setUseManualClinic(e.target.checked);
                                                        if (e.target.checked) setFormData({ ...formData, targetOrgId: "" });
                                                    }}
                                                    className="h-3 w-3 rounded border-[#b0dde0] accent-[#09919b]"
                                                />
                                                <span className="text-[10px] text-[#09919b]">Nuevo</span>
                                            </label>
                                        )}
                                        {mode === "dentist" && <div className="h-4" />}
                                    </div>
                                    {useManualClinic ? (
                                        <div className="relative">
                                            <Building2 className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#09919b]" />
                                            <Input
                                                placeholder="Nombre clínica o dentista"
                                                value={manualClinicName}
                                                onChange={(e) => setManualClinicName(e.target.value)}
                                                className="pl-8 h-9 text-sm border-[#b0dde0] focus-visible:ring-[#09919b]/20 focus-visible:border-[#09919b]"
                                                required={useManualClinic}
                                            />
                                        </div>
                                    ) : (
                                        <Combobox
                                            options={labs.map((l) => ({ value: l.id, label: l.name }))}
                                            value={formData.targetOrgId}
                                            onValueChange={(v) => setFormData({ ...formData, targetOrgId: v })}
                                            placeholder={mode === "dentist" ? "Seleccionar Lab" : "Seleccionar Clínica"}
                                            searchPlaceholder={mode === "dentist" ? "Buscar laboratorio..." : "Buscar clínica..."}
                                            emptyText={mode === "dentist" ? "Sin laboratorios" : "Sin clínicas"}
                                            className="border-[#b0dde0]"
                                        />
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 02 · Trabajo — multi-item (BLOQUE 7) */}
                        <div>
                            <div className="flex items-center gap-3 mb-3">
                                <span className="text-[9px] font-black text-[#09919b] uppercase tracking-[0.15em]">02</span>
                                <div className="h-px flex-1 bg-[#d2f2f3]" />
                                <span className="text-[9px] font-bold text-[#09919b]/60 uppercase tracking-widest">Trabajos</span>
                            </div>

                            {/* Counter + total estimado */}
                            <div className="flex items-center gap-3 flex-wrap mb-3">
                                <Badge variant="outline" className="font-bold text-xs border-[#09919b]/40 text-[#09919b]">
                                    Items: {items.length}
                                </Badge>
                                {showPrices && liveTotal > 0 && (
                                    <span className="text-sm font-semibold text-[#044c64]">
                                        Total estimado:{" "}
                                        <span className="tabular-nums text-[#09919b]">${formatNumber(liveTotal)}</span>
                                    </span>
                                )}
                            </div>

                            {/* Cargando catálogo */}
                            {catalogLoading && (
                                <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    {mode === "dentist" ? "Cargando arancel del laboratorio..." : "Cargando arancel..."}
                                </div>
                            )}

                            <div className="space-y-3">
                                {items.map((it, idx) => {
                                    const cat = catalogItems.find((c) => c.id === it.catalogItemId) ?? null;
                                    return (
                                        <div key={it._tempId} className="rounded-xl border border-[#b0dde0] bg-[#fafdfd] p-4 space-y-3">
                                            {/* Header del ítem: número + duplicar/quitar */}
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-[10px] font-bold text-[#09919b] uppercase tracking-wider flex items-center gap-2">
                                                    <Package className="h-3.5 w-3.5" />
                                                    Ítem {idx + 1}
                                                </span>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => duplicateItem(it._tempId)}
                                                        className="h-7 px-2 text-[10px] text-[#09919b] hover:bg-[#09919b]/10 rounded flex items-center gap-1 transition-colors"
                                                        title="Duplicar este ítem"
                                                    >
                                                        <Copy className="h-3 w-3" />
                                                        Duplicar
                                                    </button>
                                                    {items.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removeItem(it._tempId)}
                                                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded flex items-center justify-center transition-colors"
                                                            title="Quitar ítem"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Tipo de trabajo: catálogo (si hay) o fallback genérico */}
                                            {showCatalog ? (
                                                <div className="space-y-1.5">
                                                    <Label className="text-[11px] font-bold uppercase tracking-wide text-[#044c64]">
                                                        Tipo de Trabajo
                                                        <span className="ml-1.5 text-[9px] font-normal text-[#09919b] normal-case tracking-normal">
                                                            (desde arancel{mode === "dentist" ? " del laboratorio" : ""})
                                                        </span>
                                                    </Label>
                                                    <div className="relative">
                                                        <Ticket className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#09919b] z-10 pointer-events-none" />
                                                        <CatalogPicker
                                                            value={it.catalogItemId}
                                                            onChange={(catId) => handleCatalogSelect(it._tempId, catId)}
                                                            categories={catalogCategories}
                                                            grouped={catalogGrouped}
                                                            items={catalogItems}
                                                            showPrices={showPrices}
                                                            organizationId={organizationId}
                                                            onItemCreated={(newCat) => {
                                                                setCatalogItems((prev) => [...prev, newCat]);
                                                                handleCatalogSelect(it._tempId, newCat.id);
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            ) : showFallback ? (
                                                <div className="space-y-1.5">
                                                    <Label className="text-[11px] font-bold uppercase tracking-wide text-[#044c64]">
                                                        Tipo de Trabajo
                                                    </Label>
                                                    {mode === "lab" && idx === 0 && (
                                                        <p className="text-[10px] text-[#09919b]/70">
                                                            Sin arancel configurado.{" "}
                                                            <a href="/dashboard/settings" className="underline">Configurar precios</a>
                                                        </p>
                                                    )}
                                                    {mode === "dentist" && formData.targetOrgId && idx === 0 && (
                                                        <p className="text-[10px] text-muted-foreground mb-1">
                                                            Este laboratorio no tiene arancel configurado.
                                                        </p>
                                                    )}
                                                    <Combobox
                                                        options={workTypes}
                                                        value={it.workType}
                                                        onValueChange={(v) => patchItem(it._tempId, { workType: v })}
                                                        placeholder="Selecciona el tipo de trabajo"
                                                        searchPlaceholder="Buscar tipo..."
                                                        emptyText="Sin resultados."
                                                        className="border-[#b0dde0]"
                                                    />
                                                </div>
                                            ) : null}

                                            {/* Extras del ítem (si el catálogo del item los define) */}
                                            {cat && cat.extras.length > 0 && (
                                                <div className="border border-[#b0dde0] rounded-lg overflow-hidden">
                                                    <div className="px-3 py-2 bg-[#f5fbfc] border-b border-[#d2f2f3]">
                                                        <p className="text-[11px] font-bold uppercase tracking-wide text-[#044c64]">
                                                            Extras / Adicionales
                                                        </p>
                                                    </div>
                                                    <div className="px-3 py-2 space-y-1">
                                                        {cat.extras.map((extra, i) => {
                                                            const maxQty = extra.max_qty || 1;
                                                            const selExtra = it.selectedExtras.find((e) => e.name === extra.name);
                                                            const currentQty = selExtra?.qty ?? 0;
                                                            if (maxQty > 1) {
                                                                return (
                                                                    <div key={i} className="flex items-center justify-between py-1.5 px-1">
                                                                        <span className="text-sm">{extra.name}</span>
                                                                        <div className="flex items-center gap-1.5">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => updateExtraQty(it._tempId, extra, currentQty - 1)}
                                                                                disabled={currentQty === 0}
                                                                                className="h-6 w-6 rounded border border-[#b0dde0] text-sm font-bold text-[#09919b] disabled:opacity-30 hover:bg-[#f5fbfc] transition-colors"
                                                                            >−</button>
                                                                            <span className="w-6 text-center text-sm font-semibold">{currentQty}</span>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => updateExtraQty(it._tempId, extra, currentQty + 1)}
                                                                                disabled={currentQty >= maxQty}
                                                                                className="h-6 w-6 rounded border border-[#b0dde0] text-sm font-bold text-[#09919b] disabled:opacity-30 hover:bg-[#f5fbfc] transition-colors"
                                                                            >+</button>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            }
                                                            return (
                                                                <label key={i} className="flex items-center justify-between cursor-pointer py-1.5 px-1 hover:bg-muted/20 rounded transition-colors">
                                                                    <div className="flex items-center gap-2.5">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={currentQty > 0}
                                                                            onChange={(e) => updateExtraQty(it._tempId, extra, e.target.checked ? 1 : 0)}
                                                                            className="h-3.5 w-3.5 accent-[#09919b]"
                                                                        />
                                                                        <span className="text-sm">{extra.name}</span>
                                                                    </div>
                                                                </label>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Piezas + Color */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1.5">
                                                    <Label className="text-[11px] font-bold uppercase tracking-wide text-[#044c64]">
                                                        Piezas Dentales
                                                    </Label>
                                                    <div className="relative">
                                                        <Info className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#09919b]" />
                                                        <Input
                                                            placeholder="Ej: 11, 21, 22"
                                                            className="pl-8 h-9 text-sm border-[#b0dde0] focus-visible:ring-[#09919b]/20 focus-visible:border-[#09919b]"
                                                            value={it.toothNumbers}
                                                            onChange={(e) => patchItem(it._tempId, { toothNumbers: e.target.value })}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-[11px] font-bold uppercase tracking-wide text-[#044c64]">
                                                        Color / Tono
                                                    </Label>
                                                    <Input
                                                        placeholder="Ej: A2"
                                                        className="h-9 text-sm border-[#b0dde0] focus-visible:ring-[#09919b]/20 focus-visible:border-[#09919b]"
                                                        value={it.shade}
                                                        onChange={(e) => patchItem(it._tempId, { shade: e.target.value })}
                                                    />
                                                </div>
                                            </div>

                                            {/* Cantidad */}
                                            <div className="space-y-1.5 max-w-[120px]">
                                                <Label className="text-[11px] font-bold uppercase tracking-wide text-[#044c64]">
                                                    Cantidad
                                                </Label>
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    className="h-9 text-sm border-[#b0dde0] focus-visible:ring-[#09919b]/20 focus-visible:border-[#09919b]"
                                                    value={it.quantity}
                                                    onChange={(e) => patchItem(it._tempId, { quantity: parseInt(e.target.value) || 1 })}
                                                />
                                            </div>

                                            {/* Subtotal del ítem */}
                                            {showPrices && it.unitPrice > 0 && (
                                                <div className="flex items-baseline justify-between pt-2 border-t border-[#d2f2f3]">
                                                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                                        Subtotal ítem
                                                    </span>
                                                    <span className="text-sm font-bold text-[#044c64] tabular-nums">
                                                        ${formatNumber(it.unitPrice * (it.quantity || 1))}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                {/* Botón "Agregar otro ítem" al final */}
                                <button
                                    type="button"
                                    onClick={addItem}
                                    className="w-full py-2.5 rounded-xl border border-dashed border-[#09919b]/40 text-[#09919b] hover:bg-[#09919b]/5 transition-colors font-semibold text-sm flex items-center justify-center gap-1.5"
                                >
                                    <Plus className="h-4 w-4" />
                                    Agregar otro ítem
                                </button>
                            </div>
                        </div>

                        {/* 03 · Fecha de Entrega */}
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <span className="text-[9px] font-black text-[#09919b] uppercase tracking-[0.15em]">03</span>
                                <div className="h-px flex-1 bg-[#d2f2f3]" />
                                <span className="text-[9px] font-bold text-[#09919b]/60 uppercase tracking-widest">
                                    Fecha de Entrega
                                </span>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="col-span-1 space-y-1.5">
                                    <Label className="text-[11px] font-bold uppercase tracking-wide text-[#044c64]">
                                        Fecha
                                    </Label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#09919b]" />
                                        <Input
                                            type="date"
                                            className="pl-8 h-9 text-sm border-[#b0dde0] focus-visible:ring-[#09919b]/20 focus-visible:border-[#09919b]"
                                            value={formData.dueDate}
                                            onChange={(e) =>
                                                setFormData({ ...formData, dueDate: e.target.value })
                                            }
                                        />
                                    </div>
                                </div>
                                <div className="col-span-1 space-y-1.5">
                                    <Label className="text-[11px] font-bold uppercase tracking-wide text-[#044c64]">
                                        Hora
                                    </Label>
                                    <div className="relative">
                                        <Clock className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#09919b]" />
                                        <Input
                                            type="time"
                                            className="pl-8 h-9 text-sm border-[#b0dde0] focus-visible:ring-[#09919b]/20 focus-visible:border-[#09919b]"
                                            value={formData.dueTime}
                                            onChange={(e) =>
                                                setFormData({ ...formData, dueTime: e.target.value })
                                            }
                                        />
                                    </div>
                                </div>
                                <div className="col-span-1 space-y-1.5">
                                    <Label className="text-[11px] font-bold uppercase tracking-wide text-[#044c64]">
                                        Prioridad
                                    </Label>
                                    <Combobox
                                        options={[
                                            { value: "low",    label: "Baja" },
                                            { value: "normal", label: "Normal" },
                                            { value: "high",   label: "Alta" },
                                            { value: "urgent", label: "Urgente" },
                                        ]}
                                        value={formData.priority}
                                        onValueChange={(v) => setFormData({ ...formData, priority: v as "low" | "normal" | "high" | "urgent" })}
                                        placeholder="Prioridad"
                                        searchPlaceholder="Buscar..."
                                        emptyText="Sin resultados."
                                        className="border-[#b0dde0]"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 04 · Descripción */}
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <span className="text-[9px] font-black text-[#09919b] uppercase tracking-[0.15em]">04</span>
                                <div className="h-px flex-1 bg-[#d2f2f3]" />
                                <span className="text-[9px] font-bold text-[#09919b]/60 uppercase tracking-widest">
                                    Descripción
                                </span>
                            </div>
                            <div className="relative rounded-xl border border-[#b0dde0] bg-[#f5fbfc] overflow-hidden">
                                <FileText className="absolute left-3 top-3 h-3.5 w-3.5 text-[#09919b]/50" />
                                <Textarea
                                    className="pl-8 min-h-[100px] bg-transparent border-0 text-sm text-foreground placeholder:text-[#09919b]/30 focus-visible:ring-0 resize-none"
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="Diseño, materiales, instrucciones especiales..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* ── Footer ── */}
                    <div className="px-6 py-4 border-t border-[#d2f2f3] bg-[#f5fbfc] flex items-center justify-between shrink-0">
                        <p className="text-[10px] text-[#09919b]/50 font-medium">
                            El número de orden se asigna automáticamente
                        </p>
                        <div className="flex items-center gap-3">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setOpen(false)}
                                className="text-sm text-muted-foreground hover:text-foreground h-9"
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                disabled={loading}
                                size="sm"
                                className="h-9 px-5 bg-[#044c64] hover:bg-[#0d687d] text-white text-sm font-semibold shadow-md shadow-[#044c64]/20 transition-all"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                        Creando...
                                    </>
                                ) : (
                                    <>
                                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                                        Crear Orden
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
