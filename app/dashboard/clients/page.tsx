import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, FileText, DollarSign, ChevronRight } from "lucide-react";
import { formatNumber } from "@/lib/date-utils";
import Link from "next/link";
import { getUserOrg } from "@/lib/get-user-org";

export default async function ClientsPage() {
  // Shares React.cache() with layout — no extra auth round-trip
  const { user, org, isCollaborator, permissions } = await getUserOrg();
  if (org.type !== "lab") redirect("/dashboard");
  if (isCollaborator && !permissions?.view_clients) redirect("/dashboard");

  const supabase = await createClient();

  // Source of truth: lab_dentist_relations (includes clients with no orders yet)
  const { data: relations } = await supabase
    .from("lab_dentist_relations")
    .select("dentist_org_id")
    .eq("lab_org_id", org.id);

  const dentistIds = (relations || []).map((r: any) => r.dentist_org_id).filter(Boolean) as string[];

  const [{ data: clientOrgs }, { data: orders }] = await Promise.all([
    dentistIds.length > 0
      ? supabase.from("organizations").select("id, name, phone, address").in("id", dentistIds).order("name")
      : Promise.resolve({ data: [] }),
    dentistIds.length > 0
      ? supabase.from("lab_orders").select("dentist_org_id").eq("lab_org_id", org.id).in("dentist_org_id", dentistIds)
      : Promise.resolve({ data: [] }),
  ]);

  // Order count per client
  const orderCountMap = new Map<string, number>();
  (orders || []).forEach((o: any) => {
    orderCountMap.set(o.dentist_org_id, (orderCountMap.get(o.dentist_org_id) || 0) + 1);
  });

  const clients = (clientOrgs || []).map((c: any) => ({
    id: c.id as string,
    name: c.name as string,
    phone: (c.phone as string | null) ?? null,
    address: (c.address as string | null) ?? null,
    orderCount: orderCountMap.get(c.id) || 0,
    totalValue: 0,
  }));

  return (
    <div className="flex flex-col">
      <DashboardHeader
        title="Clinicas"
        user={{
          email: user.email || "",
          firstName: user.user_metadata?.first_name,
          lastName: user.user_metadata?.last_name,
        }}
      />
      <div className="flex-1 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Clinicas Asociadas</CardTitle>
            <CardDescription>
              Clinicas dentales que han enviado pedidos
            </CardDescription>
          </CardHeader>
          <CardContent>
            {clients.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Clinica</TableHead>
                      <TableHead>Contacto</TableHead>
                      <TableHead>Pedidos</TableHead>
                      <TableHead>Total Facturado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients.map((client) => (
                      <TableRow key={client.id} className="cursor-pointer hover:bg-muted/40 transition-colors group">
                        <TableCell>
                          <Link href={`/dashboard/clients/${client.id}`} className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted group-hover:bg-primary/10 transition-colors">
                              <Building2 className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                            <div>
                              <p className="font-bold group-hover:text-primary transition-colors">{client.name}</p>
                              {client.address ? (
                                <p className="text-xs text-muted-foreground">{client.address}</p>
                              ) : (
                                <p className="text-xs text-muted-foreground/50 italic">Sin dirección</p>
                              )}
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link href={`/dashboard/clients/${client.id}`} className="block">
                            {client.phone ? (
                              <span className="font-medium">{client.phone}</span>
                            ) : (
                              <span className="text-muted-foreground/50 italic text-xs">Sin teléfono</span>
                            )}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link href={`/dashboard/clients/${client.id}`} className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{client.orderCount}</span>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link href={`/dashboard/clients/${client.id}`} className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <DollarSign className="h-4 w-4 text-muted-foreground" />
                              <span className="font-bold">${formatNumber(client.totalValue)}</span>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="py-12 text-center">
                <Building2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-medium">No hay clinicas</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Conecta clínicas desde Configuración para que aparezcan aquí
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
