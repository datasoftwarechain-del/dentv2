"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save, RotateCcw, Search, Tag } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/date-utils";

function getCsrfToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

interface PricingItem {
  id: string;
  name: string;
  category: string;
  base_price: number;
  override: { custom_price: number; notes: string | null; updated_at: string } | null;
}

interface ClientPricingSectionProps {
  clientId: string;
  clientName: string;
  /** [BLOQUE 4] Driven by manage_pricing for write access. */
  canManage?: boolean;
}

/**
 * [BLOQUE 4] "Arancel personalizado" panel. Lists every active catalog item
 * with the general base_price (read-only) and an editable input for the
 * custom price for THIS specific client. Empty input = no override = uses
 * the general price. Clicking "Restaurar" deletes the override.
 *
 * Override applies only to base_price. Extras keep the general price.
 */
export function ClientPricingSection({ clientId, clientName, canManage = false }: ClientPricingSectionProps) {
  const [items, setItems] = useState<PricingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // Load once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/clients/${clientId}/pricing`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Error al cargar el catálogo");
        }
        const data = await res.json();
        if (cancelled) return;
        setItems(data.items ?? []);
      } catch (err: any) {
        toast.error(err.message || "No se pudo cargar el catálogo");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.name.toLowerCase().includes(q) ||
        it.category.toLowerCase().includes(q),
    );
  }, [items, search]);

  function getDraftFor(item: PricingItem): string {
    if (drafts[item.id] !== undefined) return drafts[item.id];
    return item.override ? String(item.override.custom_price) : "";
  }

  function isDirty(item: PricingItem): boolean {
    const draft = drafts[item.id];
    if (draft === undefined) return false;
    const trimmed = draft.trim();
    const currentOverride = item.override?.custom_price;
    if (trimmed === "" && currentOverride === undefined) return false;
    if (trimmed === "" && currentOverride !== undefined) return true;
    const parsed = parseFloat(trimmed);
    if (Number.isNaN(parsed)) return false;
    return parsed !== currentOverride;
  }

  async function applyChange(item: PricingItem, customPrice: number | null) {
    setSavingId(item.id);
    try {
      const res = await fetch(`/api/clients/${clientId}/pricing`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": getCsrfToken(),
        },
        body: JSON.stringify({
          catalog_item_id: item.id,
          custom_price: customPrice,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Error al guardar");

      // Refetch the row locally to stay in sync without full page reload.
      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? {
                ...it,
                override:
                  customPrice === null
                    ? null
                    : {
                        custom_price: customPrice,
                        notes: it.override?.notes ?? null,
                        updated_at: new Date().toISOString(),
                      },
              }
            : it,
        ),
      );
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      toast.success(
        customPrice === null
          ? "Precio personalizado eliminado"
          : `Precio personalizado guardado: $${formatNumber(customPrice)}`,
      );
    } catch (err: any) {
      toast.error(err.message || "No se pudo guardar");
    } finally {
      setSavingId(null);
    }
  }

  async function handleSave(item: PricingItem) {
    const draft = (drafts[item.id] ?? "").trim();
    if (draft === "") {
      // Empty draft = remove override.
      await applyChange(item, null);
      return;
    }
    const parsed = parseFloat(draft);
    if (Number.isNaN(parsed) || parsed < 0) {
      toast.error("Ingresá un número válido (≥ 0)");
      return;
    }
    await applyChange(item, parsed);
  }

  async function handleRevert(item: PricingItem) {
    if (!item.override) {
      // Already on general price; just clear the draft.
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      return;
    }
    await applyChange(item, null);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" />
              Arancel personalizado
            </CardTitle>
            <CardDescription className="mt-1">
              Precios específicos para <strong>{clientName}</strong>. Si dejás el
              campo vacío se usa el precio general del catálogo.
            </CardDescription>
            <p className="mt-2 text-[11px] text-muted-foreground italic leading-snug">
              Este precio reemplaza el base del catálogo. Los extras (ganchos, tabletas, ajustes, etc.) mantienen su precio general.
            </p>
          </div>
        </div>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar en el catálogo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            {search.trim()
              ? "Ningún item del catálogo coincide con la búsqueda."
              : "El laboratorio todavía no tiene items en el catálogo."}
          </p>
        ) : (
          <div className="rounded-xl border border-border/40 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border/40">
                <tr>
                  <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Trabajo</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground w-32">Precio general</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground w-44">Precio personalizado</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground w-32"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filtered.map((item) => {
                  const dirty = isDirty(item);
                  const saving = savingId === item.id;
                  const draftValue = getDraftFor(item);
                  return (
                    <tr key={item.id} className="hover:bg-muted/20">
                      <td className="px-4 py-2">
                        <div className="font-semibold text-foreground">{item.name}</div>
                        <div className="text-[11px] text-muted-foreground">{item.category}</div>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                        ${formatNumber(item.base_price)}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-end gap-2">
                          {item.override && (
                            <Badge
                              variant="outline"
                              className="text-[10px] border-[#09919b]/40 text-[#09919b]"
                            >
                              Personalizado
                            </Badge>
                          )}
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder={`Vacío = $${formatNumber(item.base_price)}`}
                            value={draftValue}
                            onChange={(e) =>
                              setDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                            }
                            disabled={!canManage || saving}
                            className="h-8 text-right tabular-nums w-32"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canManage && dirty && (
                            <Button
                              type="button"
                              size="sm"
                              variant="default"
                              onClick={() => handleSave(item)}
                              disabled={saving}
                              className="h-8 px-2"
                              title="Guardar precio personalizado"
                            >
                              {saving ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Save className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          )}
                          {canManage && item.override && !dirty && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRevert(item)}
                              disabled={saving}
                              className="h-8 px-2 text-muted-foreground hover:text-destructive"
                              title="Volver al precio general"
                            >
                              {saving ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <RotateCcw className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!canManage && !loading && (
          <p className="text-xs text-muted-foreground mt-3">
            Modo lectura — pedile a un admin que te asigne el permiso{" "}
            <code className="font-mono">manage_pricing</code> para editar.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
