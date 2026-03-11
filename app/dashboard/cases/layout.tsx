import { getUserOrg } from "@/lib/get-user-org";
import { redirect } from "next/navigation";

export default async function CasesLayout({ children }: { children: React.ReactNode }) {
  const { isCollaborator, permissions } = await getUserOrg();
  if (isCollaborator && !permissions?.view_cases) redirect("/dashboard");
  return <>{children}</>;
}
