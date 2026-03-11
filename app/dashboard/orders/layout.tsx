import { getUserOrg } from "@/lib/get-user-org";
import { redirect } from "next/navigation";

export default async function OrdersLayout({ children }: { children: React.ReactNode }) {
  const { isCollaborator, permissions } = await getUserOrg();
  if (isCollaborator && !permissions?.view_orders) redirect("/dashboard");
  return <>{children}</>;
}
