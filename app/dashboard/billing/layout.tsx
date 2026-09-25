import { getUserOrg } from "@/lib/get-user-org";
import { redirect } from "next/navigation";
import { LiveRefresh } from "@/components/billing/live-refresh";

export default async function BillingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { org, isCollaborator, permissions } = await getUserOrg();

  if (isCollaborator && !permissions?.view_billing) {
    redirect("/dashboard");
  }

  // Quién factura (lab / estudio) filtra por lab_org_id; la clínica, por
  // dentist_org_id. El preview de clínica no es dueño de ninguna fila
  // (los datos son de la clínica real): sin realtime, solo refresco al foco.
  const isDentist = org.type === "dentist";
  const isPreview = org.type === "dentist_preview";

  return (
    <>
      {!isPreview && (
        <LiveRefresh orgId={org.id} orgColumn={isDentist ? "dentist_org_id" : "lab_org_id"} />
      )}
      {children}
    </>
  );
}
