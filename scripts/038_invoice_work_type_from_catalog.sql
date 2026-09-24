-- ============================================================
-- 038_invoice_work_type_from_catalog.sql
-- La descripcion de la factura es el PRODUCTO, no la categoria
-- ============================================================
-- EL PROBLEMA
--   auto_generate_invoice() (016/017) escribe invoices.work_type con la
--   categoria enum del item ("protesis_removible"). Pero el laboratorio
--   vende PRODUCTOS del catalogo: una "DOE Impresa", una "PPR a placa"
--   y un "Esqueleto de cromo" son tres trabajos distintos que salian
--   los tres como "Protesis Removible". El cliente recibia una factura
--   que no decia que compro.
--
-- LA CORRECCION
--   1. Un trigger BEFORE INSERT en invoices que, si la factura cuelga
--      de una orden, reescribe work_type con los nombres del catalogo.
--      Se hace como trigger aparte y NO tocando auto_generate_invoice():
--      esa funcion tiene 140 lineas y reproducirla entera para cambiar
--      cuatro es como se introduce un bug al arreglar otro. Ademas cubre
--      cualquier otro camino que inserte facturas con order_id.
--   2. Un backfill de las facturas existentes, SOLO donde work_type es
--      exactamente lo que escribio el trigger viejo. Una descripcion
--      editada a mano no coincide con ese patron y queda intacta.
--
-- Idempotente. Correr desde el SQL Editor de Supabase.
-- ============================================================


-- ============================================================
-- 1. Funcion: nombres del catalogo de una orden
-- ============================================================
-- Un item sin arancel de catalogo (orden manual vieja) cae a su
-- categoria legible. Nunca devuelve NULL para una orden con items.

CREATE OR REPLACE FUNCTION lab_order_work_description(p_order_id UUID)
RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT string_agg(
           DISTINCT COALESCE(pc.name, replace(loi.work_type::text, '_', ' ')),
           ', '
         )
    FROM lab_order_items loi
    LEFT JOIN price_catalog pc ON pc.id = loi.catalog_item_id
   WHERE loi.order_id = p_order_id;
$$;


-- ============================================================
-- 2. Trigger: toda factura nueva de una orden lleva el producto
-- ============================================================
-- BEFORE INSERT solamente. Un UPDATE de work_type es alguien editando
-- la descripcion a mano, y eso se respeta.

CREATE OR REPLACE FUNCTION invoice_set_work_type_from_catalog()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_desc TEXT;
BEGIN
  IF NEW.order_id IS NOT NULL THEN
    v_desc := lab_order_work_description(NEW.order_id);
    IF v_desc IS NOT NULL AND v_desc <> '' THEN
      NEW.work_type := v_desc;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoices_work_type_from_catalog ON invoices;
CREATE TRIGGER invoices_work_type_from_catalog
  BEFORE INSERT ON invoices
  FOR EACH ROW EXECUTE FUNCTION invoice_set_work_type_from_catalog();


-- ============================================================
-- 3. Backfill guardado: solo lo que escribio el trigger viejo
-- ============================================================
-- El trigger viejo producia array_to_string(array_agg(DISTINCT
-- work_type), ', '): las categorias, ordenadas, separadas por coma.
-- Se recomputa ese valor por factura y se compara: si coincide, nadie
-- lo toco a mano y se puede reemplazar por el producto.

WITH legacy AS (
  SELECT loi.order_id,
         string_agg(DISTINCT loi.work_type::text, ', ') AS legacy_desc
    FROM lab_order_items loi
   WHERE loi.work_type IS NOT NULL
   GROUP BY loi.order_id
)
UPDATE invoices i
   SET work_type = lab_order_work_description(i.order_id),
       updated_at = now()
  FROM legacy l
 WHERE l.order_id = i.order_id
   AND i.order_id IS NOT NULL
   AND i.work_type = l.legacy_desc
   AND lab_order_work_description(i.order_id) IS DISTINCT FROM i.work_type;


-- ============================================================
-- 4. Verificacion
-- ============================================================

SELECT
  (SELECT count(*) FROM pg_trigger WHERE tgname = 'invoices_work_type_from_catalog') AS trigger_instalado,
  (SELECT count(*) FROM invoices i
    WHERE i.order_id IS NOT NULL
      AND i.work_type ~ '^[a-z_]+(, [a-z_]+)*$') AS facturas_aun_con_categoria;
