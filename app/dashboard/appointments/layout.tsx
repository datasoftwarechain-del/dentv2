import { getUserOrg } from "@/lib/get-user-org";
import { redirect } from "next/navigation";

export default async function AppointmentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { org, isCollaborator, permissions } = await getUserOrg();

  if (org.type !== "dentist" && org.type !== "dentist_preview") redirect("/dashboard");
  if (isCollaborator && !permissions?.view_appointments) redirect("/dashboard");

  return <>{children}</>;
}
