-- ============================================================
-- 036_design_studio_setup.sql
-- Puesta en marcha del Estudio de Diseno Digital
-- ============================================================
-- Requiere haber corrido antes scripts/035_design_studio.sql.
--
-- SIN bloques DO y SIN dollar-quoting a proposito: son sentencias
-- planas, para que cualquier editor SQL las ejecute sin tener que
-- entender dollar-quoting. Se pueden correr juntas o una por una.
--
-- EDITAR: el nombre del estudio en el PASO 1 y tu email en el PASO 2.
--
-- IDEMPOTENTE: volver a correrlo no duplica nada ni pisa precios.
-- ============================================================


-- ============================================================
-- PASO 1 - Crear la organizacion del estudio
-- ============================================================
-- Cambia 'Estudio de Diseño Digital' por el nombre que quieras.

INSERT INTO organizations (name, type)
SELECT 'Estudio de Diseño Digital', 'design_studio'
WHERE NOT EXISTS (
  SELECT 1 FROM organizations WHERE type = 'design_studio'
);


-- ============================================================
-- PASO 2 - Darte de alta como administrador del estudio
-- ============================================================
-- Cambia el email por el tuyo. Tiene que ser una cuenta que YA exista
-- en la app. Sin este paso la organizacion existe pero nadie entra.

INSERT INTO org_members (org_id, user_id, role)
SELECT o.id, u.id, 'admin'
  FROM organizations o
  CROSS JOIN auth.users u
 WHERE o.type = 'design_studio'
   AND lower(u.email) = lower('na.achenlo@gmail.com')
   AND NOT EXISTS (
     SELECT 1 FROM org_members m
      WHERE m.org_id = o.id AND m.user_id = u.id
   );


-- ============================================================
-- PASO 3 - Sembrar los 12 servicios en el catalogo
-- ============================================================
-- Los codigos deben coincidir exactamente con lib/design/services.ts:
-- son la bisagra entre el desplegable, el precio y la linea de factura.
-- Nacen en 0: los precios se cargan desde Ajustes -> Catalogo.

INSERT INTO price_catalog
  (org_id, category, name, design_service_code, billing_unit,
   included_revisions, turnaround_hours, base_price, unit_cost, sort_order)
SELECT o.id, 'Diseño Digital', s.name, s.code, s.unit,
       s.revisions, s.hours, 0, 0, s.ord
  FROM organizations o
  CROSS JOIN (VALUES
    ('Diseño de Modelo',                          'model_design',        'arch', 2, 24, 1),
    ('Corona y Puente · Corona sobre Implante',   'crown_bridge',        'unit', 2, 24, 2),
    ('Onlay / Inlay / Carilla',                   'onlay_inlay_veneer',  'unit', 2, 24, 3),
    ('Diseño de Sonrisa · Encerado Digital',      'smile_design_waxup',  'case', 3, 48, 4),
    ('Corona Atornillada',                        'screw_retained_crown','unit', 2, 24, 5),
    ('Pilar Personalizado sobre Implante',        'custom_abutment',     'unit', 2, 24, 6),
    ('Estructura de Prótesis Parcial',            'partial_framework',   'arch', 2, 48, 7),
    ('Prótesis Parcial Acrílica (Flipper)',       'acrylic_flipper',     'unit', 2, 24, 8),
    ('Cubeta Individual',                         'impression_tray',     'arch', 1, 24, 9),
    ('Férula de Descarga / Protector Bucal',      'night_guard_splint',  'arch', 2, 24, 10),
    ('Prótesis Completa / Arcada Total',          'complete_denture',    'arch', 3, 72, 11),
    ('All-on-X / Arcada sobre Implantes',         'all_on_x',            'arch', 3, 72, 12)
  ) AS s(name, code, unit, revisions, hours, ord)
 WHERE o.type = 'design_studio'
   AND NOT EXISTS (
     SELECT 1 FROM price_catalog pc
      WHERE pc.org_id = o.id AND pc.design_service_code = s.code
   );


-- ============================================================
-- PASO 4 - El cargo por revision fuera de las incluidas
-- ============================================================
-- No es un servicio del desplegable: el cliente no lo pide, lo genera
-- el sistema cuando se piden mas vueltas de las incluidas. Nace en 0,
-- asi que mientras no le pongas precio las revisiones extra NO se
-- cobran y queda constancia en la bitacora de cada orden.

INSERT INTO price_catalog
  (org_id, category, name, design_service_code, billing_unit,
   included_revisions, base_price, unit_cost, sort_order)
SELECT o.id, 'Diseño Digital', 'Revisión adicional',
       'revision_fee', 'case', 0, 0, 0, 99
  FROM organizations o
 WHERE o.type = 'design_studio'
   AND NOT EXISTS (
     SELECT 1 FROM price_catalog pc
      WHERE pc.org_id = o.id AND pc.design_service_code = 'revision_fee'
   );


-- ============================================================
-- PASO 5 - Verificacion
-- ============================================================
-- Tiene que devolver una fila: 13 aranceles y 1 admin.

SELECT o.name AS estudio,
       (SELECT count(*) FROM price_catalog pc
         WHERE pc.org_id = o.id AND pc.design_service_code IS NOT NULL) AS aranceles,
       (SELECT count(*) FROM price_catalog pc
         WHERE pc.org_id = o.id AND pc.design_service_code IS NOT NULL
           AND pc.base_price > 0) AS con_precio,
       (SELECT count(*) FROM org_members m WHERE m.org_id = o.id) AS miembros
  FROM organizations o
 WHERE o.type = 'design_studio';
