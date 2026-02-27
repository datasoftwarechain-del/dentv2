import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { EditAppointmentForm } from "@/components/appointments/edit-appointment-form";

interface PageProps {
  params: Promise<{ id: string }> | { id: string };
}

export default async function EditAppointmentPage(props: PageProps) {
  const params = await Promise.resolve(props.params);
  const appointmentId = params.id;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // Get user's organization
  const { data: memberships } = await supabase
    .from("org_members")
    .select("organization:org_id(id, name, type, is_system_account)")
    .eq("user_id", user.id);

  const orgs = (memberships || [])
    .map((m: any) => {
      const orgData = m.organization;
      return Array.isArray(orgData) ? orgData[0] : orgData;
    })
    .filter((o: any) => o && o.is_system_account !== false);

  const org = orgs[0] || null;
  if (!org || org.type !== "dentist") redirect("/dashboard");

  // Fetch appointment with patient
  const { data: appointment, error } = await supabase
    .from("appointments")
    .select(`*, patient:patients(id, first_name, last_name)`)
    .eq("id", appointmentId)
    .eq("dentist_org_id", org.id)
    .single();

  if (error || !appointment) notFound();

  // Fetch all patients for the org (for patient selector)
  const { data: patients } = await supabase
    .from("patients")
    .select("id, first_name, last_name")
    .eq("dentist_org_id", org.id)
    .order("last_name");

  return (
    <div className="flex flex-col">
      <DashboardHeader
        title="Editar Cita"
        user={{
          email: user.email || "",
          firstName: user.user_metadata?.first_name,
          lastName: user.user_metadata?.last_name,
        }}
      />
      <div className="flex-1 p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/appointments/${appointmentId}`}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Volver a la cita
            </Link>
          </Button>

          <EditAppointmentForm
            appointment={appointment}
            patients={patients || []}
            organizationId={org.id}
          />
        </div>
      </div>
    </div>
  );
}
