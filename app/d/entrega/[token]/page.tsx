import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolverToken, MENSAJE_RECHAZO } from "@/lib/design/dispatch/resolve";
import { DESIGN_BUCKET } from "@/lib/design/files";
import { CASE_EMAIL_LINK_TTL_SECONDS } from "@/lib/design/case-email";
import { DeliveryPortal } from "@/components/design/delivery-portal";
import { AlertCircle } from "lucide-react";

/**
 * [043] Portal de entrega del diseñador.
 *
 * Sin cuenta: el token de la URL es la credencial. Todo lo que decide si
 * el enlace sirve está en resolverToken(); acá solo se pinta.
 *
 * `noindex` y `nofollow` no son decorativos: la URL lleva un secreto y no
 * tiene que terminar en ningún buscador ni en ninguna caché pública.
 */
export const metadata: Metadata = {
  title: "Entrega del caso | DigitalDent",
  robots: { index: false, follow: false, nocache: true },
};

/** El token cambia el contenido en cada visita: nunca se cachea. */
export const dynamic = "force-dynamic";

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-6 py-4">
          <span className="text-lg font-bold tracking-[-.005em]">
            <span className="text-[#044c64]">Digital</span>
            <span className="text-[#09919b]">Dent</span>
          </span>
        </div>
      </header>
      <div className="mx-auto max-w-4xl px-6 py-10">{children}</div>
    </main>
  );
}

export default async function EntregaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const resolucion = await resolverToken(token);

  if (!resolucion.ok) {
    return (
      <Marco>
        <div className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-8 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-amber-500" aria-hidden="true" />
          <h1 className="mt-4 text-xl font-semibold text-slate-800">Enlace no disponible</h1>
          <p className="mt-2 text-sm text-slate-600">{MENSAJE_RECHAZO[resolucion.motivo]}</p>
        </div>
      </Marco>
    );
  }

  const { dispatch, designer, order, studioName } = resolucion.data;
  const admin = createAdminClient();

  const [{ data: items }, { data: files }] = await Promise.all([
    admin
      .from("design_order_items")
      .select("description, service_code, quantity, tooth_positions, arch, notes")
      .eq("design_order_id", order.id)
      .order("created_at"),
    admin
      .from("design_order_files")
      .select("id, file_name, storage_path, kind, file_size")
      .eq("design_order_id", order.id)
      .in("kind", ["input_scan", "input_reference"])
      .order("created_at"),
  ]);

  // Enlaces de descarga de los escaneos del cliente. Misma vida larga que
  // los del correo: el diseñador no tiene sesión que los renueve.
  const archivos = await Promise.all(
    (files ?? []).map(async (f) => {
      const { data: signed } = await admin.storage
        .from(DESIGN_BUCKET)
        .createSignedUrl(f.storage_path, CASE_EMAIL_LINK_TTL_SECONDS, { download: f.file_name });
      return {
        id: f.id,
        file_name: f.file_name,
        file_size: f.file_size as number | null,
        kind: f.kind as string,
        url: signed?.signedUrl ?? null,
      };
    }),
  );

  // Lo que ya subió en despachos anteriores de este mismo caso.
  const { data: entregados } = await admin
    .from("design_order_files")
    .select("id, file_name, created_at")
    .eq("design_order_id", order.id)
    .eq("kind", "output_design")
    .order("version", { ascending: false });

  return (
    <Marco>
      <DeliveryPortal
        token={token}
        designerName={designer.full_name}
        studioName={studioName}
        aceptado={dispatch.status === "accepted"}
        vencimiento={dispatch.token_expires_at}
        order={{
          order_number: order.order_number,
          patient_ref: order.patient_ref,
          case_notes: order.case_notes,
          priority: order.priority,
          due_at: order.due_at,
        }}
        items={items ?? []}
        archivos={archivos}
        yaEntregados={(entregados ?? []).map((e) => ({
          id: e.id,
          file_name: e.file_name,
          created_at: e.created_at as string,
        }))}
      />
    </Marco>
  );
}
