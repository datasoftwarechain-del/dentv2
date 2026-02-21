"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Download, FileText, File, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CaseFile {
  id: string;
  file_name: string;
  file_url: string;
  file_size: number;
  file_type: string;
  created_at: string;
}

interface CaseFilesSectionProps {
  orderId: string;
}

export function CaseFilesSection({ orderId }: CaseFilesSectionProps) {
  const [files, setFiles] = useState<CaseFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadFiles();
  }, [orderId]);

  const loadFiles = async () => {
    try {
      setLoading(true);
      setError(null);

      const supabase = createClient();

      console.log("🔍 [CaseFiles] Iniciando carga de archivos");
      console.log("🔍 [CaseFiles] Order ID:", orderId);

      const { data, error: fetchError } = await supabase
        .from("case_files")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });

      console.log("🔍 [CaseFiles] Resultado query:", {
        encontrados: data?.length || 0,
        data,
        error: fetchError
      });

      if (fetchError) {
        console.error("❌ [CaseFiles] Error cargando archivos:", fetchError);
        setError(fetchError.message);
        return;
      }

      console.log("✅ [CaseFiles] Archivos cargados exitosamente:", data?.length || 0);
      setFiles(data || []);
    } catch (err: any) {
      console.error("❌ [CaseFiles] Error en loadFiles:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const handleDownload = (file: CaseFile) => {
    toast.success(`Descargando ${file.file_name}...`);
  };

  if (loading) {
    return (
      <div className="space-y-4 pt-4 border-t border-border/40">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <File className="h-4 w-4 text-[#09919b]" />
          Archivos del Caso Digital
        </h3>
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-[#09919b]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4 pt-4 border-t border-border/40">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <File className="h-4 w-4 text-[#09919b]" />
          Archivos del Caso Digital
        </h3>
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900 mb-1">
                Error al cargar archivos
              </p>
              <p className="text-xs text-amber-700">
                {error}
              </p>
              {error.includes("relation") && (
                <p className="text-xs text-amber-700 mt-2">
                  La tabla <code className="bg-amber-100 px-1 rounded">case_files</code> no existe.
                  Por favor ejecuta el SQL de configuración en Supabase.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Temporalmente mostrar siempre la sección para depuración
  if (files.length === 0) {
    return (
      <div className="space-y-4 pt-4 border-t border-border/40">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <File className="h-4 w-4 text-[#09919b]" />
          Archivos del Caso Digital
        </h3>
        <div className="p-4 rounded-xl border border-dashed border-border/60 bg-muted/10 text-center text-sm text-muted-foreground">
          No hay archivos digitales para esta orden.
          <div className="mt-2 text-xs">
            <p>Order ID: {orderId}</p>
            <p>Archivos encontrados: {files.length}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-4 border-t border-border/40">
      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
        <File className="h-4 w-4 text-[#09919b]" />
        Archivos del Caso Digital ({files.length})
      </h3>
      <div className="grid gap-3">
        {files.map((file) => (
          <div
            key={file.id}
            className="flex items-center justify-between p-4 rounded-xl border border-[#b0dde0] bg-[#f0fafb] hover:bg-[#e0f4f6] transition-colors"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-[#09919b] flex items-center justify-center">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#044c64] truncate">
                  {file.file_name}
                </p>
                <p className="text-xs text-slate-500">
                  {formatFileSize(file.file_size)}
                </p>
              </div>
            </div>
            <a
              href={file.file_url}
              download={file.file_name}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0"
              onClick={() => handleDownload(file)}
            >
              <Button
                size="sm"
                className="bg-[#044c64] hover:bg-[#033a4e] text-white"
              >
                <Download className="h-4 w-4 mr-2" />
                Descargar
              </Button>
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
