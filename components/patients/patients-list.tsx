"use client";

import { useState } from "react";
import { CreatePatientDialog } from "@/components/dashboard/create-patient-dialog";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, User, Phone, Mail } from "lucide-react";

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  created_at: string;
}

interface PatientsListProps {
  patients: Patient[];
  organizationId: string;
}

export function PatientsList({ patients, organizationId }: PatientsListProps) {
  const [search, setSearch] = useState("");

  const filteredPatients = patients.filter(
    (p) =>
      p.first_name.toLowerCase().includes(search.toLowerCase()) ||
      p.last_name.toLowerCase().includes(search.toLowerCase()) ||
      p.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card className="border-0 shadow-lg bg-white/50 dark:bg-black/20 backdrop-blur-sm">
      <CardHeader className="border-b border-border/50">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
              Lista de Pacientes
            </CardTitle>
            <CardDescription>
              Gestiona el expediente y contacto de tus pacientes
            </CardDescription>
          </div>
          <CreatePatientDialog organizationId={organizationId} />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="p-4 border-b border-border/50">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, correo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-background/50 focus:bg-background transition-all"
            />
          </div>
        </div>

        {filteredPatients.length > 0 ? (
          <div className="relative w-full overflow-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold text-primary">Paciente</TableHead>
                  <TableHead className="font-semibold text-primary">Contacto</TableHead>
                  <TableHead className="font-semibold text-primary">Nacimiento</TableHead>
                  <TableHead className="font-semibold text-primary">Registro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPatients.map((patient) => (
                  <TableRow
                    key={patient.id}
                    className="hover:bg-muted/30 transition-colors cursor-pointer group"
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary/10 to-primary/5 group-hover:from-accent/10 group-hover:to-accent/5 transition-all shadow-sm border border-primary/10">
                          <User className="h-5 w-5 text-primary group-hover:text-accent transition-colors" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            {patient.first_name} {patient.last_name}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {patient.email ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                            <Mail className="h-3.5 w-3.5" />
                            {patient.email}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground/50 italic">Sin correo</div>
                        )}
                        {patient.phone ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                            <Phone className="h-3.5 w-3.5" />
                            {patient.phone}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground/50 italic">Sin teléfono</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {patient.date_of_birth
                        ? new Date(patient.date_of_birth).toLocaleDateString("es-ES", {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })
                        : "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(patient.created_at).toLocaleDateString("es-ES", {
                        month: 'short',
                        day: 'numeric'
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="py-16 text-center bg-muted/5">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-muted shadow-sm mb-4">
              <User className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-medium text-foreground">No hay pacientes</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-xs mx-auto">
              No se encontraron pacientes que coincidan con tu búsqueda o aún no has agregado ninguno.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
