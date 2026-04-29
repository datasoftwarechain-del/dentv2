-- ============================================================
-- 030 - Columna manually_overridden en invoices (Opción A)
-- ============================================================
-- Permite que una factura totals_strict=true tenga un monto ajustado
-- manualmente que NO debe recalcularse automáticamente desde items.
--
-- Estados resultantes:
--   totals_strict=false                          → histórica intocable.
--                                                  Lectura: persistido.
--                                                  Edición de montos: bloqueada.
--   totals_strict=true,  manually_overridden=false → factura "viva".
--                                                    Lectura: recalculada desde items.
--                                                    Edición: habilitada.
--   totals_strict=true,  manually_overridden=true  → factura ajustada a mano.
--                                                    Lectura: persistido (con detalle informativo del recalc).
--                                                    Edición: habilitada.
--                                                    Sync con items: requiere ?force=true.
--
-- Reglas que aplican el flag:
--   - app/api/billing/update-invoice: setea manually_overridden=true cuando
--     un usuario edita subtotal/total/tax_amount y los nuevos valores
--     difieren de los persistidos en DB.
--   - app/api/billing/invoices/[id]/sync-from-items: si manually_overridden=true
--     y NO viene ?force=true → 409. Si viene ?force=true → sincroniza y
--     limpia el flag a false.
--
-- Idempotente. Aplicar manualmente desde Supabase SQL Editor.

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS manually_overridden BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN invoices.manually_overridden IS
  'true = el monto persistido fue ajustado manualmente y NO debe recalcularse automáticamente desde lab_order_items. Solo significativo cuando totals_strict=true. Las totals_strict=false ya son persistido verbatim por naturaleza histórica.';
