"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { OdontogramSimple } from "@/components/odontogram/odontogram-simple";
import { CaseFileUploader } from "./case-file-uploader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Combobox } from "@/components/ui/combobox";
import { FileText, Upload, Send, Sparkles, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface CasesViewProps {
  organizationId: string;
  isDentist: boolean;
}

const workTypes = [
  { value: "corona_metal_ceramica", label: "Corona Metal-Cerámica" },
  { value: "corona_zirconia", label: "Corona Zirconia" },
  { value: "corona_emax", label: "Corona Emax" },
  { value: "puente_fijo", label: "Puente Fijo" },
  { value: "protesis_removible", label: "Prótesis Removible" },
  { value: "implante_corona", label: "Corona sobre Implante" },
  { value: "carilla", label: "Carilla" },
  { value: "incrustacion", label: "Incrustación" },
  { value: "ferula", label: "Férula" },
];

export function CasesView({ organizationId, isDentist }: CasesViewProps) {
  const router = useRouter();
  const [selectedTeeth, setSelectedTeeth] = useState<number[]>([]);
  const [patientName, setPatientName] = useState("");
  const [workType, setWorkType] = useState("");
  const [shade, setShade] = useState("");
  const [notes, setNotes] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedClinic, setSelectedClinic] = useState("");
  const [clinics, setClinics] = useState<Array<{ id: string; name: string }>>([]);

  // Cargar clínicas si es un laboratorio
  useEffect(() => {
    if (!isDentist) {
      loadClinics();
    }
  }, [isDentist]);

  const loadClinics = async () => {
    const supabase = createClient();

    // Obtener clínicas relacionadas con este laboratorio
    const { data: relations } = await supabase
      .from("lab_dentist_relations")
      .select("dentist_org_id, organizations:dentist_org_id(id, name)")
      .eq("lab_org_id", organizationId)
      .eq("status", "active");

    if (relations) {
      const clinicsList = relations
        .map((rel: any) => {
          const org = rel.organizations;
          return Array.isArray(org) ? org[0] : org;
        })
        .filter((org: any) => org && org.id);

      setClinics(clinicsList);

      // Auto-seleccionar la primera clínica si solo hay una
      if (clinicsList.length === 1) {
        setSelectedClinic(clinicsList[0].id);
      }
    }
  };

  const handleSubmitCase = async () => {
    console.log("📋 [Submit] Archivos en uploadedFiles:", uploadedFiles.length, uploadedFiles);

    // Validaciones
    if (!isDentist && !selectedClinic) {
      toast.error("Selecciona la clínica/dentista para este caso");
      return;
    }
    if (selectedTeeth.length === 0) {
      toast.error("Selecciona al menos una pieza dental");
      return;
    }
    if (!workType) {
      toast.error("Selecciona el tipo de trabajo");
      return;
    }
    if (!patientName.trim()) {
      toast.error("Ingresa el nombre del paciente");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();

      console.log("Iniciando creación de caso...", {
        organizationId,
        isDentist,
        selectedTeeth: selectedTeeth.length,
        patientName
      });

      // 1. Crear paciente si no existe
      const nameParts = patientName.trim().split(' ');
      const firstName = nameParts[0] || patientName;
      const lastName = nameParts.slice(1).join(' ') || '';

      // Determinar el dentist_org_id correcto
      const dentistOrgId = isDentist ? organizationId : selectedClinic;

      console.log("Creando paciente...", { firstName, lastName, dentistOrgId });

      const { data: newPatient, error: patientError } = await supabase
        .from('patients')
        .insert({
          dentist_org_id: dentistOrgId,
          first_name: firstName,
          last_name: lastName,
        })
        .select('id')
        .single();

      if (patientError) {
        console.error("Error creando paciente:", patientError);
        throw patientError;
      }
      if (!newPatient) throw new Error("No se pudo crear el paciente");

      console.log("Paciente creado:", newPatient);

      // 2. Generar número de orden secuencial
      const { data: latestOrders } = await supabase
        .from("lab_orders")
        .select("order_number")
        .order("created_at", { ascending: false })
        .limit(100);

      let nextOrderNumber = 1;
      if (latestOrders && latestOrders.length > 0) {
        const existingNumbers = latestOrders
          .map(order => {
            const match = order.order_number.match(/ORDEN (\d+)/);
            return match ? parseInt(match[1], 10) : 0;
          })
          .filter(num => !isNaN(num));

        if (existingNumbers.length > 0) {
          nextOrderNumber = Math.max(...existingNumbers) + 1;
        }
      }

      const orderNumber = `ORDEN ${nextOrderNumber}`;

      // 3. Obtener el laboratorio por defecto (el primero disponible)
      let labOrgId = null;
      if (isDentist) {
        const { data: relations } = await supabase
          .from("lab_dentist_relations")
          .select("lab_org_id")
          .eq("dentist_org_id", organizationId)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();

        if (relations) {
          labOrgId = relations.lab_org_id;
        } else {
          // Si no hay relación, buscar cualquier laboratorio
          const { data: labs } = await supabase
            .from("organizations")
            .select("id")
            .eq("type", "lab")
            .eq("is_system_account", true)
            .limit(1)
            .maybeSingle();

          if (labs) {
            labOrgId = labs.id;
            // Crear relación
            await supabase
              .from("lab_dentist_relations")
              .insert({
                lab_org_id: labOrgId,
                dentist_org_id: organizationId,
                status: "active"
              });
          } else {
            throw new Error("No hay laboratorios disponibles. Por favor contacta al administrador.");
          }
        }
      }

      // 4. Crear orden
      const orderPayload = {
        order_number: orderNumber,
        dentist_org_id: dentistOrgId, // Siempre tiene valor ahora
        lab_org_id: isDentist ? labOrgId : organizationId,
        patient_id: newPatient.id,
        notes: notes || null,
        status: "received",
        priority: "normal",
      };

      console.log("Creando orden con payload:", orderPayload);

      const orderInsertResult = await supabase
        .from("lab_orders")
        .insert(orderPayload)
        .select();

      console.log("Resultado completo del insert:", {
        data: orderInsertResult.data,
        error: orderInsertResult.error,
        status: orderInsertResult.status,
        statusText: orderInsertResult.statusText
      });

      if (orderInsertResult.error) {
        console.error("Error creando orden:", {
          error: orderInsertResult.error,
          errorString: JSON.stringify(orderInsertResult.error),
          message: orderInsertResult.error?.message,
          details: orderInsertResult.error?.details,
          hint: orderInsertResult.error?.hint,
          code: orderInsertResult.error?.code
        });
        throw new Error(orderInsertResult.error.message || orderInsertResult.error.details || "Error al crear la orden");
      }

      if (!orderInsertResult.data || orderInsertResult.data.length === 0) {
        throw new Error("No se pudo crear la orden - sin datos retornados");
      }

      const orderData = orderInsertResult.data[0];
      console.log("Orden creada exitosamente:", orderData);

      // 5. Extraer números de dientes seleccionados
      const selectedToothNumbers = selectedTeeth.map(t => t.toString());

      // 6. Crear item de orden
      const { error: itemError } = await supabase
        .from("lab_order_items")
        .insert({
          order_id: orderData.id,
          work_type: workType,
          tooth_positions: selectedToothNumbers.length > 0 ? selectedToothNumbers : null,
          shade: shade || null,
          quantity: selectedToothNumbers.length || 1,
          notes: notes || null,
        });

      if (itemError) throw itemError;

      // 7. Guardar archivos subidos a Supabase Storage
      console.log("Subiendo archivos...", uploadedFiles.length);

      if (uploadedFiles.length > 0) {
        for (const uploadedFile of uploadedFiles) {
          if (uploadedFile.status === 'success' && uploadedFile.file) {
            try {
              // Generar nombre con el número de orden
              const fileExt = uploadedFile.file.name.split('.').pop();
              const cleanOrderNumber = orderNumber.replace(/\s+/g, '_'); // "ORDEN 15" -> "ORDEN_15"
              const fileName = `${orderData.id}/${cleanOrderNumber}-${uploadedFile.file.name}`;

              console.log("Subiendo archivo:", fileName);

              // Subir a Supabase Storage
              const { data: storageData, error: storageError } = await supabase.storage
                .from('case-files')
                .upload(fileName, uploadedFile.file, {
                  cacheControl: '3600',
                  upsert: false
                });

              if (storageError) {
                console.error("Error subiendo archivo:", storageError);
                continue; // Continuar con el siguiente archivo
              }

              // Obtener URL pública del archivo
              const { data: { publicUrl } } = supabase.storage
                .from('case-files')
                .getPublicUrl(fileName);

              console.log("Archivo subido, URL:", publicUrl);

              // Guardar referencia en la base de datos
              const { data: fileRecord, error: fileRecordError } = await supabase
                .from('case_files')
                .insert({
                  order_id: orderData.id,
                  file_name: uploadedFile.file.name,
                  file_url: publicUrl,
                  file_size: uploadedFile.file.size,
                  file_type: uploadedFile.file.type || 'application/octet-stream',
                  uploaded_by: (await supabase.auth.getUser()).data.user?.id
                });

              if (fileRecordError) {
                console.error("Error guardando referencia del archivo:", fileRecordError);
              } else {
                console.log("Referencia del archivo guardada:", fileRecord);
              }
            } catch (fileError) {
              console.error("Error procesando archivo:", fileError);
              // Continuar con el siguiente archivo
            }
          }
        }
      }

      console.log("Archivos procesados exitosamente");

      // Éxito
      toast.success("Caso enviado y orden creada exitosamente", {
        description: `${orderNumber} · ${selectedToothNumbers.length} piezas`,
        action: {
          label: "Ver Orden",
          onClick: () => router.push(`/dashboard/orders/${orderData.id}`)
        },
        duration: 8000,
      });

      // Reset form
      setSelectedTeeth([]);
      setPatientName("");
      setWorkType("");
      setShade("");
      setNotes("");
      setUploadedFiles([]);

      // Redirigir a la orden creada después de 2 segundos
      setTimeout(() => {
        router.push(`/dashboard/orders/${orderData.id}`);
      }, 2000);

    } catch (error: any) {
      console.error("Error detallado al enviar caso:");
      console.error("Error tipo:", typeof error);
      console.error("Error objeto:", error);
      console.error("Error JSON:", JSON.stringify(error, null, 2));
      console.error("Error propiedades:", {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
        stack: error?.stack
      });

      // Extraer mensaje de error
      let errorMessage = "Ocurrió un error inesperado al enviar el caso";

      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.details) {
        errorMessage = error.details;
      } else if (error?.hint) {
        errorMessage = error.hint;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error instanceof Error) {
        errorMessage = error.toString();
      }

      toast.error("Error al enviar el caso", {
        description: errorMessage,
        duration: 10000
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <Card className="border-2 border-[#b0dde0]/40 bg-gradient-to-br from-[#e0f4f6] to-white">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-5 w-5 text-[#09919b]" />
                <CardTitle className="text-2xl font-black text-[#044c64]">
                  Casos Digitales
                </CardTitle>
              </div>
              <CardDescription className="text-sm text-slate-600">
                Sube escaneos intraorales (.stl, .ply, .rar) y selecciona las piezas a trabajar
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#b0dde0]">
              <div className="h-2 w-2 rounded-full bg-secondary animate-pulse" />
              <span className="text-xs font-semibold text-[#09919b]">Sistema Digital Activo</span>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main content */}
      <Tabs defaultValue="nuevo" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 h-12 bg-slate-100">
          <TabsTrigger value="nuevo" className="data-[state=active]:bg-[#044c64] data-[state=active]:text-white font-semibold">
            <Upload className="mr-2 h-4 w-4" />
            Nuevo Caso
          </TabsTrigger>
          <TabsTrigger value="enviados" className="data-[state=active]:bg-[#044c64] data-[state=active]:text-white font-semibold">
            <FileText className="mr-2 h-4 w-4" />
            Casos Enviados
          </TabsTrigger>
        </TabsList>

        {/* ── Nuevo Caso ──────────────────────────────────────── */}
        <TabsContent value="nuevo" className="space-y-6">

          {/* Selector de clínica (solo para laboratorios) */}
          {!isDentist && (
            <Card>
              <CardHeader className="bg-[#f0fafb] border-b border-[#d2f2f3]">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-[#09919b]">
                  00 · Seleccionar Clínica/Dentista
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  ¿Para qué clínica es este caso?
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                {clinics.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-slate-600 mb-2">
                      No tienes clínicas asociadas aún
                    </p>
                    <p className="text-xs text-slate-400">
                      Contacta al administrador para asociar clínicas a tu laboratorio
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="clinic-select" className="text-sm font-semibold">
                      Clínica / Dentista
                    </Label>
                    <Combobox
                      id="clinic-select"
                      options={clinics.map((c) => ({ value: c.id, label: c.name }))}
                      value={selectedClinic}
                      onValueChange={setSelectedClinic}
                      placeholder="Selecciona una clínica..."
                      searchPlaceholder="Buscar clínica..."
                      emptyText="No se encontró ninguna clínica."
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Patient info */}
          <Card>
            <CardHeader className="bg-[#f0fafb] border-b border-[#d2f2f3]">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-[#09919b]">
                01 · Información del Paciente
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="patient-name" className="text-sm font-semibold">Nombre del Paciente</Label>
                  <Input
                    id="patient-name"
                    placeholder="Ej: Juan Pérez"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    className="bg-white border-[#d2f2f3] focus:border-[#09919b]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shade" className="text-sm font-semibold">Color / Tono</Label>
                  <Input
                    id="shade"
                    placeholder="Ej: A2, Bleach, OM2"
                    value={shade}
                    onChange={(e) => setShade(e.target.value)}
                    className="bg-white border-[#d2f2f3] focus:border-[#09919b]"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Odontogram */}
          <Card>
            <CardHeader className="bg-[#f0fafb] border-b border-[#d2f2f3]">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-[#09919b]">
                02 · Selección de Piezas Dentales (Odontograma FDI)
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Haz clic en las piezas que requieren trabajo
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <OdontogramSimple
                value={selectedTeeth}
                onChange={setSelectedTeeth}
              />
            </CardContent>
          </Card>

          {/* Work type */}
          <Card>
            <CardHeader className="bg-[#f0fafb] border-b border-[#d2f2f3]">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-[#09919b]">
                03 · Tipo de Trabajo
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="work-type" className="text-sm font-semibold">Selecciona el trabajo a realizar</Label>
                <Combobox
                  id="work-type"
                  options={workTypes}
                  value={workType}
                  onValueChange={setWorkType}
                  placeholder="Elige un tipo de trabajo..."
                  searchPlaceholder="Buscar tipo de trabajo..."
                  emptyText="No se encontró ese tipo de trabajo."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes" className="text-sm font-semibold">Notas Adicionales</Label>
                <Textarea
                  id="notes"
                  placeholder="Ej: Color A2, con refuerzo oclusal..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="bg-white border-[#d2f2f3] min-h-[80px]"
                />
              </div>
            </CardContent>
          </Card>

          {/* File upload */}
          <Card>
            <CardHeader className="bg-[#f0fafb] border-b border-[#d2f2f3]">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-[#09919b]">
                04 · Archivos de Escaneo Intraoral
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Sube archivos .stl, .ply, .obj o carpetas comprimidas (.rar, .zip)
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <CaseFileUploader
                onFilesUploaded={setUploadedFiles}
                maxFiles={10}
                maxSizeMB={500}
              />
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedTeeth([]);
                setPatientName("");
                setWorkType("");
                setShade("");
                setNotes("");
                setUploadedFiles([]);
              }}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmitCase}
              disabled={isSubmitting}
              className="bg-[#044c64] hover:bg-[#033a4e] text-white font-semibold shadow-lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando Orden...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Enviar Caso y Crear Orden
                </>
              )}
            </Button>
          </div>
        </TabsContent>

        {/* ── Casos Enviados ──────────────────────────────────── */}
        <TabsContent value="enviados">
          <Card>
            <CardContent className="py-16 text-center">
              <FileText className="h-16 w-16 mx-auto text-slate-300 mb-4" />
              <p className="text-sm font-semibold text-slate-600 mb-1">
                No hay casos enviados aún
              </p>
              <p className="text-xs text-slate-400">
                Los casos que envíes aparecerán aquí
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
