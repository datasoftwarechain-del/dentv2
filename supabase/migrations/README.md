# Migraciones

## Dónde está la verdad

Este proyecto arrastra **dos registros de migraciones en paralelo**, y conviene
saber cuál manda:

| Dónde | Qué tiene | ¿Es la verdad? |
|---|---|---|
| `scripts/NNN_*.sql` | 47 archivos numerados, aplicados **a mano** en el editor SQL de Supabase | Histórico. Nadie registró cuáles se aplicaron |
| `supabase/migrations/*.sql` | 4 archivos sueltos | Histórico |
| `supabase_migrations.schema_migrations` (en la base) | **El SQL exacto que se ejecutó**, con versión, nombre y sentencias | **SÍ** |

El ledger de la base es el único que no puede mentir: guarda el texto aplicado,
no una intención. Se consulta así:

```sql
select version, name, array_to_string(statements, E';\n\n') as sql
from supabase_migrations.schema_migrations
order by version;
```

Y se reconstruyen los archivos con `supabase db pull`.

## Por qué el 2026-10-02 no se copiaron los .sql al repo

Ese día se aplicaron **once** migraciones por MCP (`20261001200208` a
`20261002205316`): RLS real en seis tablas, bucket clínico privado, vistas con
`security_invoker`, endurecimiento de privilegios y `search_path`, respaldo y
recálculo del libro mayor, y el arreglo de `verify_billing_integrity`.

No se transcribieron a archivos porque **copiar ~800 líneas de SQL a mano tiene
riesgo real de error de transcripción**, y un archivo que dice algo distinto de
lo que corre en producción es peor que no tenerlo: la auditoría de ese día
encontró exactamente ese problema en `scripts/044`, que decía `from anon`
cuando lo aplicado era `from public`.

El SQL exacto vive en el ledger, que es verificable.

## Regla para lo que viene

**Las migraciones nuevas van por el ledger del CLI**, no por `scripts/`.
Así hay un solo registro y queda el texto real aplicado. Si se necesita el
archivo en el repo, se saca con `supabase db pull` — nunca se escribe a mano a
partir de lo que uno cree que aplicó.

## Lo aplicado el 2026-10-02

| Versión | Nombre | Qué hizo |
|---|---|---|
| `20261001200208` | `create_public_leads` | La tabla que faltaba desde el 27-02; la captación de leads devolvía 500 |
| `20261001200221` | `revoke_anon_security_definer_rpc` | Primer intento. **No cambió nada**: el EXECUTE venía de PUBLIC |
| `20261001200306` | `revoke_public_execute_security_definer_rpc` | La corrección que sí cerró la fuga |
| `20261002152816` | `rls_real_en_seis_tablas` | Fin de `USING(true)` en patients, lab_orders, lab_order_items, organizations, lab_dentist_relations, client_invitations |
| `20261002153216` | `case_files_bucket_privado` | Bucket clínico a privado + `file_url` → `storage_path` |
| `20261002153438` | `vistas_respetan_rls` | `security_invoker = on` en las 6 vistas, que entregaban todo a `anon` |
| `20261002154526` | `endurecer_privilegios_y_search_path` | 29 políticas PUBLIC → authenticated · 33 funciones con `search_path` fijo |
| `20261002163621` | `respaldo_ledger_antes_de_recalcular` | Copia de `ledger_movements.balance` (203 filas) |
| `20261002163647` | `recalcular_running_balance_ledger` | 95 filas con el saldo desfasado, hasta $34.320 |
| `20261002205250` | `arreglar_verify_billing_integrity` | La función de auditoría estaba rota en sus dos checks |
| `20261002205316` | `arreglar_min_uuid_verify_billing` | `min(uuid)` no existe: la 051 se aplicó sin error pero fallaba al ejecutarse |

**Tabla de respaldo pendiente de borrar:** `ledger_balance_backup_20261002`.
Restaurar con:

```sql
update ledger_movements m set balance = b.balance
  from ledger_balance_backup_20261002 b where b.id = m.id;
```
