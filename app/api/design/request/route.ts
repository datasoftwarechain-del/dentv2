/**
 * [design-intake] Solicitud publica de diseno.
 *
 * Es la unica puerta del modulo abierta a internet: un odontologo que
 * llega desde la web y pide una corona sin tener cuenta.
 *
 * QUE HACE EN UNA LLAMADA
 *   1. Crea la cuenta (ya confirmada, sin mail de verificacion de por medio)
 *   2. Crea su organizacion
 *   3. Lo habilita como cliente del estudio, en modo PREPAGO
 *   4. Crea la orden en 'draft' con los servicios pedidos
 *   5. Devuelve un enlace de acceso de un solo uso para que entre a subir
 *      los escaneos
 *
 * POR QUE EL REGISTRO VA ACA ADENTRO Y NO ES UN FLUJO ANONIMO
 *   La ruta de cada archivo en el bucket arranca con el UUID de la orden,
 *   y la policy de storage exige pertenecer a ella. Un flujo sin cuenta
 *   obligaria a una segunda infraestructura de archivos huerfanos, con su
 *   propia limpieza y sus propios agujeros. Asi el cliente ve un campo de
 *   email, no un registro, y del otro lado es un cliente normal.
 *
 * SI EL EMAIL YA TIENE CUENTA
 *   No se crea nada ni se toca su organizacion: se le pide que inicie
 *   sesion. Dejar pasar eso permitiria crearle ordenes a cualquiera con
 *   solo saber su direccion de correo.
 *
 * COBRO
 *   Nace en 'prepaid': el STL no se descarga hasta que la factura este
 *   paga. No hay pasarela todavia — el estudio cobra por fuera y marca la
 *   factura, y la compuerta is_released se ocupa del resto.
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateCSRF } from "@/lib/csrf";
import { validateBody } from "@/lib/api-validation";
import { getDesignService } from "@/lib/design/services";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { isDuplicateUserError } from "@/lib/design/find-user";

const ItemSchema = z.object({
  service_code: z.string().min(1),
  tooth_positions: z.array(z.string().max(4)).max(32).nullish(),
  arch: z.enum(["upper", "lower", "both"]).nullish(),
  quantity: z.number().int().min(1).max(99).default(1),
  notes: z.string().max(1000).nullish(),
});

const RequestSchema = z.object({
  full_name: z.string().min(2, "Nombre requerido").max(120),
  email: z.string().email("Email inválido").max(200),
  clinic_name: z.string().min(2, "Nombre de la clínica requerido").max(160),
  country: z.string().max(80).nullish(),
  phone: z.string().max(40).nullish(),
  patient_ref: z.string().max(120).nullish(),
  case_notes: z.string().max(4000).nullish(),
  items: z.array(ItemSchema).min(1, "Elegí al menos un servicio").max(20),
});

export async function POST(request: NextRequest) {
  const csrfError = validateCSRF(request);
  if (csrfError) return csrfError;

  try {
    const { data: body, error: bodyError } = await validateBody(request, RequestSchema);
    if (bodyError) return bodyError;

    const email = body.email.trim().toLowerCase();

    // Los codigos se validan contra el catalogo del modulo, nunca contra
    // lo que mande el formulario.
    const unknown = body.items.filter((i) => !getDesignService(i.service_code));
    if (unknown.length > 0) {
      return NextResponse.json(
        { error: `Servicio desconocido: ${unknown.map((i) => i.service_code).join(", ")}` },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    // ─── El estudio que recibe el trabajo ────────────────────────
    const { data: studio } = await admin
      .from("organizations")
      .select("id, name")
      .eq("type", "design_studio")
      .limit(1)
      .maybeSingle();

    if (!studio) {
      return NextResponse.json(
        { error: "El servicio de diseño no está disponible en este momento." },
        { status: 503 },
      );
    }

    // ─── 1. La cuenta ────────────────────────────────────────────
    // Se intenta crear directamente y se atrapa el duplicado. Antes se
    // listaban hasta 1000 usuarios para ver si existía: con más de mil
    // cuentas, un email existente daba "no existe" y se creaba otra.
    //
    // email_confirm: true porque la verificacion la da haber llegado
    // hasta aca desde el sitio; la sesion que se abre abajo es de un
    // solo uso y queda en este navegador.
    const { data: created, error: userError } = await admin.auth.admin.createUser({
      email,
      password: randomBytes(24).toString("base64url"),
      email_confirm: true,
      user_metadata: { first_name: body.full_name, source: "design_intake" },
    });

    if (isDuplicateUserError(userError)) {
      return NextResponse.json(
        {
          error: "Ya existe una cuenta con ese email.",
          code: "account_exists",
          action: "Iniciá sesión y pedí el diseño desde tu panel.",
        },
        { status: 409 },
      );
    }

    if (userError || !created?.user) {
      return NextResponse.json(
        { error: userError?.message ?? "No se pudo crear la cuenta" },
        { status: 500 },
      );
    }
    const userId = created.user.id;

    // ─── 2. Su organizacion ──────────────────────────────────────
    // is_system_account arranca en false para que el trigger
    // on_org_created no intente insertar la membresia con auth.uid(),
    // que aca es NULL. Se enciende despues de crearla a mano.
    const { data: clientOrg, error: orgError } = await admin
      .from("organizations")
      // type 'design_client', NO 'dentist': esta cuenta existe para pedir
      // diseños, no para usar el ERP. Crearla como 'dentist' regalaba el
      // sistema completo a cualquiera que pidiera una corona por la web.
      .insert({ name: body.clinic_name.trim(), type: "design_client", is_system_account: false })
      .select("id, name")
      .single();

    if (orgError || !clientOrg) {
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: orgError?.message ?? "No se pudo crear la organización" },
        { status: 500 },
      );
    }

    const { error: memberError } = await admin
      .from("org_members")
      .insert({ org_id: clientOrg.id, user_id: userId, role: "owner" });

    if (memberError) {
      await admin.from("organizations").delete().eq("id", clientOrg.id);
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }

    await admin.from("organizations")
      .update({ is_system_account: true }).eq("id", clientOrg.id);

    // ─── 3. Alta como cliente del estudio, en prepago ────────────
    await admin.from("design_studio_clients").insert({
      studio_org_id: studio.id,
      client_org_id: clientOrg.id,
      status: "active",
      payment_mode: "prepaid",
      notes: [
        "Alta automática desde el formulario público.",
        body.country ? `País: ${body.country}` : null,
        body.phone ? `Tel: ${body.phone}` : null,
        `Contacto: ${body.full_name}`,
      ].filter(Boolean).join(" · "),
    });

    // ─── 4. La orden, con precios resueltos en el servidor ───────
    const { data: catalog } = await admin
      .from("price_catalog")
      .select("id, design_service_code, base_price, unit_cost")
      .eq("org_id", studio.id)
      .not("design_service_code", "is", null);

    const byCode = new Map(
      (catalog ?? []).map((c: any) => [c.design_service_code as string, c]),
    );

    const { data: order, error: orderError } = await admin
      .from("design_orders")
      .insert({
        studio_org_id: studio.id,
        client_org_id: clientOrg.id,
        status: "draft",
        priority: "normal",
        patient_ref: body.patient_ref ?? null,
        case_notes: body.case_notes ?? null,
        created_by: userId,
      })
      .select("id, order_number")
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: orderError?.message ?? "No se pudo crear la orden" },
        { status: 500 },
      );
    }

    await admin.from("design_order_items").insert(
      body.items.map((item) => {
        const priced = byCode.get(item.service_code);
        return {
          design_order_id: order.id,
          service_code: item.service_code,
          catalog_item_id: priced?.id ?? null,
          tooth_positions: item.tooth_positions?.length ? item.tooth_positions : null,
          arch: item.arch ?? null,
          quantity: item.quantity,
          unit_price: Number(priced?.base_price ?? 0),
          unit_cost: priced?.unit_cost ?? null,
          notes: item.notes ?? null,
        };
      }),
    );

    await admin.from("design_order_events").insert({
      design_order_id: order.id,
      type: "status_change",
      actor_side: "client",
      actor_id: userId,
      to_status: "draft",
      message: "Solicitud creada desde el formulario público",
    });

    // ─── 5. Dejarlo adentro, con sesion iniciada ─────────────────
    // NO se devuelve el action_link de Supabase: Supabase reescribe su
    // redirect_to al Site URL cuando la URL pedida no esta en la lista
    // blanca del proyecto, y el cliente termina en la home en vez de en
    // la pantalla de subir archivos. Eso deja la orden en 'draft' para
    // siempre: invisible para el estudio, olvidada por el cliente.
    //
    // En su lugar se canjea el token acá mismo con verifyOtp, que escribe
    // las cookies de sesion en esta misma respuesta. El navegador navega
    // a una ruta propia y no depende de ninguna configuracion externa.
    const origin = request.nextUrl.origin;
    const nextUrl = `/dashboard/design/${order.id}`;

    const { data: link } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${origin}/auth/callback?next=${nextUrl}` },
    });

    let sessionStarted = false;
    const tokenHash = link?.properties?.hashed_token;

    if (tokenHash) {
      const supabase = await createClient();
      const { error: otpError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: "magiclink",
      });
      sessionStarted = !otpError;
    }

    return NextResponse.json(
      {
        data: {
          order_id: order.id,
          order_number: order.order_number,
          studio_name: studio.name,
          /** Ruta propia a la que navegar. Ya hay sesion iniciada. */
          next_url: nextUrl,
          session_started: sessionStarted,
          /**
           * Solo como red de seguridad si verifyOtp fallo. Depende de que
           * la URL este en Authentication -> URL Configuration.
           */
          access_url: sessionStarted ? null : (link?.properties?.action_link ?? null),
        },
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
