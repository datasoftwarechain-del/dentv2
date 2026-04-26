# 🧭 Mapa de Flujo de Información - DigitalDent v2

Este documento conecta las áreas clave del proyecto para que cualquier cambio tenga trazabilidad técnica y funcional.

## Punto de Entrada

1. [EMPIEZA_AQUI.md](./EMPIEZA_AQUI.md) para onboarding rápido.
2. [README_DOCUMENTACION.md](./README_DOCUMENTACION.md) para índice general.
3. Este mapa para navegar dependencias entre áreas.

---

## Áreas Importantes y Sus Documentos

| Área | Objetivo | Documento Principal | Documentos Relacionados |
|------|----------|---------------------|--------------------------|
| Producto y pantallas | Entender páginas/componentes | [GUIA_DEL_PROYECTO.md](./GUIA_DEL_PROYECTO.md) | [REFERENCIA_RAPIDA.md](./REFERENCIA_RAPIDA.md), [ARQUITECTURA_VISUAL.md](./ARQUITECTURA_VISUAL.md) |
| Flujo del sistema | Ver navegación y estados | [ARQUITECTURA_VISUAL.md](./ARQUITECTURA_VISUAL.md) | [GUIA_DEL_PROYECTO.md](./GUIA_DEL_PROYECTO.md), [DASHBOARD_IMPLEMENTATION.md](./DASHBOARD_IMPLEMENTATION.md) |
| Base de datos | Modelos, relaciones y reglas | [DATABASE_REFERENCE.md](./DATABASE_REFERENCE.md) | `scripts/*.sql`, [INSTRUCCIONES_FACTURACION.md](./INSTRUCCIONES_FACTURACION.md) |
| Facturación | Operación de facturas/cobros | [INSTRUCCIONES_FACTURACION.md](./INSTRUCCIONES_FACTURACION.md) | [CORRECCIONES_FACTURACION.md](./CORRECCIONES_FACTURACION.md), [CORRECCIONES_ADICIONALES.md](./CORRECCIONES_ADICIONALES.md) |
| Producción de laboratorio | Flujo operativo del lab | [DASHBOARD_IMPLEMENTATION.md](./DASHBOARD_IMPLEMENTATION.md) | [SOLUCION_CLINICAS_CLIENTE.md](./SOLUCION_CLINICAS_CLIENTE.md), [ARQUITECTURA_VISUAL.md](./ARQUITECTURA_VISUAL.md) |
| Performance y estabilidad | Rendimiento y mantenimiento | [OPTIMIZACIONES_REALIZADAS.md](./OPTIMIZACIONES_REALIZADAS.md) | [README.md](./README.md), [REFERENCIA_RAPIDA.md](./REFERENCIA_RAPIDA.md) |

---

## Flujo End-to-End (Negocio → Código → Datos)

1. **Usuario ejecuta una acción** (UI en `app/` + `components/`).
2. **Se aplica lógica funcional** (formularios, validaciones, estados de pedido/factura).
3. **Se persiste en BD** (tablas/triggers/scripts SQL).
4. **Se refleja en dashboards** (dentista/laboratorio/facturación).
5. **Se valida operación** (checklists y documentos de correcciones).

Documentos a revisar en ese orden:

1. [GUIA_DEL_PROYECTO.md](./GUIA_DEL_PROYECTO.md)
2. [ARQUITECTURA_VISUAL.md](./ARQUITECTURA_VISUAL.md)
3. [DATABASE_REFERENCE.md](./DATABASE_REFERENCE.md)
4. [INSTRUCCIONES_FACTURACION.md](./INSTRUCCIONES_FACTURACION.md)
5. [CORRECCIONES_FACTURACION.md](./CORRECCIONES_FACTURACION.md) y [CORRECCIONES_ADICIONALES.md](./CORRECCIONES_ADICIONALES.md)

---

## Matriz de Impacto (Si Cambias X, Revisa Y)

| Si cambias... | Debes revisar también... |
|---------------|---------------------------|
| Campos de formularios (pacientes/pedidos/citas) | [REFERENCIA_RAPIDA.md](./REFERENCIA_RAPIDA.md), [DATABASE_REFERENCE.md](./DATABASE_REFERENCE.md), scripts SQL |
| Estados de pedidos | [ARQUITECTURA_VISUAL.md](./ARQUITECTURA_VISUAL.md), [DASHBOARD_IMPLEMENTATION.md](./DASHBOARD_IMPLEMENTATION.md), facturación |
| Triggers o tablas de facturación | [INSTRUCCIONES_FACTURACION.md](./INSTRUCCIONES_FACTURACION.md), [CORRECCIONES_FACTURACION.md](./CORRECCIONES_FACTURACION.md), [CORRECCIONES_ADICIONALES.md](./CORRECCIONES_ADICIONALES.md) |
| Flujo de clínicas cliente en laboratorio | [SOLUCION_CLINICAS_CLIENTE.md](./SOLUCION_CLINICAS_CLIENTE.md), [DASHBOARD_IMPLEMENTATION.md](./DASHBOARD_IMPLEMENTATION.md) |
| Navegación/dashboard | [GUIA_DEL_PROYECTO.md](./GUIA_DEL_PROYECTO.md), [ARQUITECTURA_VISUAL.md](./ARQUITECTURA_VISUAL.md), [REFERENCIA_RAPIDA.md](./REFERENCIA_RAPIDA.md) |
| Configuración/performance | [OPTIMIZACIONES_REALIZADAS.md](./OPTIMIZACIONES_REALIZADAS.md), [README.md](./README.md) |

---

## Protocolo de Actualización de Documentación

Cuando una PR toque una de estas áreas, actualiza:

1. Documento principal del área.
2. Este [MAPA_FLUJO_INFORMACION.md](./MAPA_FLUJO_INFORMACION.md) (si cambia relación entre áreas).
3. [README_DOCUMENTACION.md](./README_DOCUMENTACION.md) y [REFERENCIA_RAPIDA.md](./REFERENCIA_RAPIDA.md) si cambia la ruta de búsqueda.

Objetivo: mantener un único flujo de información, sin duplicidad inconsistente.
