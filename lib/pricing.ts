/**
 * [BLOQUE 4] Effective price resolution for catalog items per client.
 *
 * client_price_overrides lets a lab set a custom base_price for a specific
 * dentist client + catalog item. These helpers resolve the effective price
 * applying the override when present, falling back to the catalog's
 * base_price otherwise.
 *
 * Override scope: ONLY the base_price of the catalog item. Extras keep the
 * general price for everyone (decided in BLOQUE 4 scope). Future override
 * of extras would be a separate table, not an extension here.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface EffectivePrice {
  /** Final price the lab should charge this dentist for this item. */
  effective: number;
  /** The general catalog base_price, kept for reference / tooltip / badge. */
  base: number;
  /** True if the lab has set a custom override for this client+item. */
  hasOverride: boolean;
}

/**
 * Single-item lookup. For batches, use getEffectivePricesBatch to avoid N+1.
 *
 * Returns null if the catalog item doesn't exist (or doesn't belong to the
 * lab — Supabase RLS on price_catalog enforces lab ownership). Caller should
 * decide how to handle null (typically: 0 fallback or skip).
 */
export async function getEffectivePrice(
  supabase: SupabaseClient,
  labOrgId: string,
  dentistOrgId: string,
  catalogItemId: string,
): Promise<EffectivePrice | null> {
  const { data: item } = await supabase
    .from("price_catalog")
    .select("id, base_price, org_id")
    .eq("id", catalogItemId)
    .eq("org_id", labOrgId)
    .maybeSingle();

  if (!item) return null;

  const base = Number(item.base_price) || 0;

  const { data: override } = await supabase
    .from("client_price_overrides")
    .select("custom_price")
    .eq("lab_org_id", labOrgId)
    .eq("dentist_org_id", dentistOrgId)
    .eq("catalog_item_id", catalogItemId)
    .maybeSingle();

  if (override) {
    return { effective: Number(override.custom_price), base, hasOverride: true };
  }
  return { effective: base, base, hasOverride: false };
}

/**
 * Batch lookup. Single trip to client_price_overrides for the given
 * (lab, dentist) pair, then merges with the provided catalog items.
 *
 * Returns a Map keyed by catalog_item_id so the form can prefill prices
 * without per-item round-trips. The base_price comes from the items array
 * the caller already fetched, so this only needs the overrides table.
 */
export async function getEffectivePricesBatch(
  supabase: SupabaseClient,
  labOrgId: string,
  dentistOrgId: string,
  items: { id: string; base_price: number | string }[],
): Promise<Map<string, EffectivePrice>> {
  const result = new Map<string, EffectivePrice>();
  if (items.length === 0) return result;

  const itemIds = items.map((i) => i.id);
  const { data: overrides } = await supabase
    .from("client_price_overrides")
    .select("catalog_item_id, custom_price")
    .eq("lab_org_id", labOrgId)
    .eq("dentist_org_id", dentistOrgId)
    .in("catalog_item_id", itemIds);

  const overrideMap = new Map<string, number>();
  for (const row of overrides ?? []) {
    overrideMap.set(row.catalog_item_id, Number(row.custom_price));
  }

  for (const item of items) {
    const base = Number(item.base_price) || 0;
    const override = overrideMap.get(item.id);
    if (override !== undefined) {
      result.set(item.id, { effective: override, base, hasOverride: true });
    } else {
      result.set(item.id, { effective: base, base, hasOverride: false });
    }
  }
  return result;
}
