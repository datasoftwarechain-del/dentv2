import { getUserOrg } from "@/lib/get-user-org";
import { redirect } from "next/navigation";

export default async function KanbanLayout({ children }: { children: React.ReactNode }) {
  const { org, isCollaborator, permissions } = await getUserOrg();
  if (org.type !== "lab") redirect("/dashboard");
  if (isCollaborator && !permissions?.view_kanban) redirect("/dashboard");
  return <>{children}</>;
}
