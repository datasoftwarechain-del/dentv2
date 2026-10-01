-- [044] Cerrar las RPC SECURITY DEFINER abiertas sin sesion.
--
-- APLICADO EN PRODUCCION el 2026-10-01 como dos migraciones:
--   revoke_anon_security_definer_rpc        (este archivo, primer intento)
--   revoke_public_execute_security_definer_rpc  (la correccion de abajo)
--
-- Auditoria 2026-09-30, hallazgo P0 #3. Probado por HTTP sin sesion:
--   POST /rest/v1/rpc/get_user_orgs {"uid":"<real>"} -> 200 con org_id/type/role
--   GET  /rest/v1/org_members                       -> 200 [] (la RLS si corta)
-- Al ser SECURITY DEFINER estas funciones saltean la RLS.
--
-- LECCION: la primera version revocaba a anon y a authenticated y NO cambio
-- NADA. El EXECUTE no venia de un grant a esos roles sino de PUBLIC: en el
-- ACL se ve como "=X/postgres", con el grantee vacio. La migracion devolvio
-- exito y los permisos quedaron intactos. Solo se detecto porque se midio
-- DESPUES de aplicar, con has_function_privilege.
--
-- NO se tocan user_belongs_to_org, is_org_member ni can_access_design_order:
-- las invocan 19, 12 y 5 policies. Las de user_belongs_to_org aplican a
-- PUBLIC (polroles = 0), asi que anon SI las evalua: revocarle EXECUTE
-- convertiria un `[]` inofensivo en un error 42501 en siete tablas. Esas
-- tres se arreglan cambiando la firma para que usen auth.uid() en vez de
-- recibir un uid arbitrario, y eso es un cambio de codigo con su prueba.
--
-- service_role y el dueno (postgres) conservan su grant explicito, asi que
-- el admin client del servidor sigue funcionando. Los triggers tambien:
-- Postgres no exige EXECUTE al dispararlos (verificado empiricamente con
-- una tabla y una funcion descartables, SET ROLE authenticated).
--
-- Una sentencia por linea a proposito: el editor SQL de Supabase rompe el
-- paste multilinea. REVOKE es idempotente, se puede correr dos veces.

-- Grupo A - funciones de trigger.
revoke execute on function public.auto_generate_invoice() from public, anon, authenticated;
revoke execute on function public.design_order_auto_invoice() from public, anon, authenticated;
revoke execute on function public.design_order_release_on_payment() from public, anon, authenticated;
revoke execute on function public.handle_new_organization() from public, anon, authenticated;
revoke execute on function public.handle_order_cancellation() from public, anon, authenticated;

-- Grupo B - sin consumidores en la app: cero policies, cero triggers, cero
-- llamadas .rpc() (grep en todo el arbol: un solo resultado, search_labs).
-- Las dos primeras son las graves: aceptan un p_lab_org_id arbitrario, una
-- LEE facturacion de cualquier laboratorio y la otra CREA facturas.
revoke execute on function public.repair_missing_invoices(uuid) from public, anon, authenticated;
revoke execute on function public.verify_billing_integrity(uuid) from public, anon, authenticated;
revoke execute on function public.get_user_orgs(uuid) from public, anon, authenticated;
revoke execute on function public.get_user_lab_orgs(uuid) from public, anon, authenticated;
revoke execute on function public.get_user_dentist_orgs(uuid) from public, anon, authenticated;

-- Grupo C - search_labs la llama el navegador con sesion iniciada
-- (components/settings/settings-form.tsx:135), asi que authenticated la
-- conserva con grant EXPLICITO, para que no dependa de PUBLIC.
revoke execute on function public.search_labs(text) from public, anon;
grant execute on function public.search_labs(text) to authenticated;

-- Verificacion. Esperado: 11 filas, anon=false en las 11, auth=false en 10
-- y auth=true solo en search_labs. service_role=true en las 11.
select p.proname, pg_get_function_identity_arguments(p.oid) as args, has_function_privilege('anon', p.oid, 'EXECUTE') as anon, has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth, has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('auto_generate_invoice','design_order_auto_invoice','design_order_release_on_payment','handle_new_organization','handle_order_cancellation','repair_missing_invoices','verify_billing_integrity','get_user_orgs','get_user_lab_orgs','get_user_dentist_orgs','search_labs') order by anon desc, auth desc, p.proname;
