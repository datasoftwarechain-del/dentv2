import { getUserOrg } from "@/lib/get-user-org";
import { redirect } from "next/navigation";

export default async function ScheduleLayout({ children }: { children: React.ReactNode }) {
  const { isCollaborator, permissions } = await getUserOrg();
  if (isCollaborator && !permissions?.view_schedule) redirect("/dashboard");
  return <>{children}</>;
}
