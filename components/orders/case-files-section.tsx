"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Download, FileText, File, Loader2 } from "lucide-react";
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
  orderNumber?: string;
}

export function CaseFilesSection({ orderId, orderNumber }: CaseFilesSectionProps) {
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

      const { data, error: fetchError } = await supabase
        .from("case_files")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });

      if (fetchError) {
        // Table may not exist yet — fail silently
        setError(fetchError.message);
        return;
      }

      setFiles(data || []);
    } catch (err: any) {
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
    return null;
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
          No hay archivos digitales para {orderNumber ? `la ${orderNumber}` : "esta orden"}.
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
