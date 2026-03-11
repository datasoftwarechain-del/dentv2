import { getUserOrg } from "@/lib/get-user-org";
import { redirect } from "next/navigation";

export default async function BillingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isCollaborator, permissions } = await getUserOrg();

  if (isCollaborator && !permissions?.view_billing) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
