"use client";

/**
 * [035_design_studio] Subida de archivos a una orden de diseño.
 *
 * Reemplazo real del uploader simulado de "Casos Digitales": acá el
 * progreso es de red (XHR), y si algo falla se ve el error en la fila del
 * archivo en vez de tragarse en la consola.
 *
 * Un escaneo de arcada completa puede pesar cientos de megabytes, así que
 * las subidas van de a una: veinte PUT en paralelo contra una conexión de
 * consultorio terminan en timeouts.
 */

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { uploadDesignFile } from "@/lib/design/client-api";
import { ACCEPTED_EXTENSIONS, formatBytes, validateDesignFile } from "@/lib/design/files";
import type { DesignFileKind, DesignOrderFile } from "@/lib/design/types";
import { Upload, File as FileIcon, CheckCircle2, AlertCircle, X, Loader2 } from "lucide-react";

interface QueuedFile {
  id: string;
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
}

interface DesignFileUploaderProps {
  orderId: string;
  kind: DesignFileKind;
  label: string;
  hint?: string;
  disabled?: boolean;
  onUploaded?: (file: DesignOrderFile) => void;
}

export function DesignFileUploader({
  orderId,
  kind,
  label,
  hint,
  disabled = false,
  onUploaded,
}: DesignFileUploaderProps) {
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const accept = ACCEPTED_EXTENSIONS[kind].join(",");

  const update = useCallback((id: string, patch: Partial<QueuedFile>) => {
    setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }, []);

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || disabled) return;

      const incoming: QueuedFile[] = Array.from(fileList).map((file) => {
        const check = validateDesignFile(file.name, file.size, kind);
        return {
          id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
          file,
          status: check.ok ? "pending" : "error",
          progress: 0,
          error: check.error,
        };
      });

      setQueue((prev) => [...prev, ...incoming]);

      // De a una. Ver nota del encabezado.
      for (const item of incoming) {
        if (item.status === "error") continue;

        update(item.id, { status: "uploading", progress: 0 });
        try {
          const uploaded = await uploadDesignFile(orderId, item.file, kind, (percent) =>
            update(item.id, { progress: percent }),
          );
          update(item.id, { status: "done", progress: 100 });
          onUploaded?.(uploaded);
        } catch (error) {
          update(item.id, {
            status: "error",
            error: error instanceof Error ? error.message : "Falló la subida",
          });
        }
      }
    },
    [disabled, kind, orderId, onUploaded, update],
  );

  const remove = (id: string) => setQueue((prev) => prev.filter((q) => q.id !== id));

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          "rounded-lg border-2 border-dashed p-6 text-center transition-colors",
          disabled
            ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-60"
            : "cursor-pointer border-[#b0dde0] bg-[#e0f4f6]/30 hover:border-[#09919b] hover:bg-[#e0f4f6]/60",
          isDragging && "border-[#09919b] bg-[#d2f2f3]",
        )}
      >
        <Upload className="mx-auto h-8 w-8 text-[#09919b]" aria-hidden="true" />
        <p className="mt-2 text-sm font-medium text-[#044c64]">{label}</p>
        <p className="mt-1 text-xs text-slate-500">
          {hint ?? `Arrastrá o hacé clic. Formatos: ${ACCEPTED_EXTENSIONS[kind].join(", ")}`}
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = ""; // permite volver a elegir el mismo archivo
          }}
        />
      </div>

      {queue.length > 0 && (
        <ul className="space-y-2">
          {queue.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2"
            >
              <FileIcon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm text-slate-700">{item.file.name}</span>
                  <span className="shrink-0 text-xs text-slate-400">
                    {formatBytes(item.file.size)}
                  </span>
                </div>

                {item.status === "uploading" && (
                  <Progress value={item.progress} className="mt-1.5 h-1" />
                )}
                {item.status === "error" && (
                  <p className="mt-1 text-xs text-red-600">{item.error}</p>
                )}
              </div>

              <div className="shrink-0">
                {item.status === "uploading" && (
                  <Loader2 className="h-4 w-4 animate-spin text-[#09919b]" aria-label="Subiendo" />
                )}
                {item.status === "done" && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label="Subido" />
                )}
                {item.status === "error" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => remove(item.id)}
                    aria-label={`Quitar ${item.file.name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
                {item.status === "pending" && (
                  <AlertCircle className="h-4 w-4 text-slate-300" aria-label="En cola" />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
