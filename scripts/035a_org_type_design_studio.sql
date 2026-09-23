-- ============================================================
-- 035a_org_type_design_studio.sql
-- Agrega 'design_studio' al enum org_type
-- ============================================================
-- CORRER ESTA LINEA SOLA, ANTES QUE 035.
--
-- POR QUE VA APARTE
--   organizations.type es el ENUM org_type de 001_schema.sql, no un
--   TEXT con CHECK. Postgres NO deja usar un valor de enum recien
--   agregado dentro de la misma transaccion ("unsafe use of new value"),
--   asi que este ALTER tiene que confirmarse solo antes de que
--   cualquier otra sentencia mencione 'design_studio'.
--
-- IDEMPOTENTE: si ya existe, avisa y no hace nada.
-- ============================================================

ALTER TYPE org_type ADD VALUE IF NOT EXISTS 'design_studio';
