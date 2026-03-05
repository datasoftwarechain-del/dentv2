"use client";

import { useState, useCallback, useRef, useEffect, memo } from "react";
import { Upload, File, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface UploadedFile {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  url?: string;
}

interface CaseFileUploaderProps {
  onFilesUploaded?: (files: UploadedFile[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
  className?: string;
}

// Formatos aceptados: escaneos 3D y archivos comprimidos
const ACCEPTED_FORMATS = {
  '3D Scans': ['.stl', '.ply', '.obj', '.3ds', '.dae'],
  'Compressed': ['.rar', '.zip', '.7z'],
  'Images': ['.jpg', '.jpeg', '.png', '.dcm'],
};

const ALL_EXTENSIONS = Object.values(ACCEPTED_FORMATS).flat();

const CaseFileUploaderComponent = ({
  onFilesUploaded,
  maxFiles = 10,
  maxSizeMB = 500,
  className
}: CaseFileUploaderProps) => {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Notificar al componente padre cuando cambien los archivos
  useEffect(() => {
    if (files.length > 0) {
      console.log("📤 [FileUploader] Notificando archivos al padre:", files.length);
      onFilesUploaded?.(files);
    }
  }, [files, onFilesUploaded]);

  const validateFile = (file: File): string | null => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALL_EXTENSIONS.includes(ext)) {
      return `Formato no soportado. Use: ${ALL_EXTENSIONS.join(', ')}`;
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      return `Archivo muy grande. Máximo ${maxSizeMB}MB`;
    }
    return null;
  };

  const handleFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);

    if (files.length + fileArray.length > maxFiles) {
      alert(`Máximo ${maxFiles} archivos permitidos`);
      return;
    }

    const validatedFiles: UploadedFile[] = fileArray.map(file => {
      const error = validateFile(file);
      return {
        file,
        progress: 0,
        status: error ? 'error' : 'pending',
        error: error || undefined,
      };
    });

    setFiles(prev => [...prev, ...validatedFiles]);

    // Auto-upload valid files
    validatedFiles.forEach((uf, idx) => {
      if (!uf.error) {
        uploadFile(uf, files.length + idx);
      }
    });
  }, [files, maxFiles]);

  const uploadFile = async (uploadedFile: UploadedFile, index: number) => {
    setFiles(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], status: 'uploading' };
      return updated;
    });

    try {
      const formData = new FormData();
      formData.append('file', uploadedFile.file);

      // Simulate upload with progress (replace with real API call)
      await new Promise(resolve => {
        let progress = 0;
        const interval = setInterval(() => {
          progress += 10;
          setFiles(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], progress };
            return updated;
          });
          if (progress >= 100) {
            clearInterval(interval);
            resolve(true);
          }
        }, 200);
      });

      setFiles(prev => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          status: 'success',
          progress: 100,
          url: `/uploads/cases/${uploadedFile.file.name}`, // Placeholder
        };
        return updated;
      });

      // onFilesUploaded ahora se llama automáticamente vía useEffect
    } catch (error) {
      setFiles(prev => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          status: 'error',
          error: 'Error al subir archivo',
        };
        return updated;
      });
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      handleFiles(droppedFiles);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Dropzone */}
      <div
        onDragEnter={handleDragEnter}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer",
          isDragging
            ? "border-[#09919b] bg-[#e0f4f6]"
            : "border-[#d2f2f3] bg-[#f0fafb] hover:border-[#09919b] hover:bg-[#e0f4f6]"
        )}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className={cn(
          "mx-auto h-12 w-12 mb-4 transition-colors",
          isDragging ? "text-[#09919b]" : "text-[#4b8899]"
        )} />

        <p className="text-base font-semibold text-[#044c64] mb-1">
          Arrastra archivos aquí o haz clic para seleccionar
        </p>
        <p className="text-xs text-slate-500 mb-3">
          Máximo {maxFiles} archivos · {maxSizeMB}MB por archivo
        </p>

        {/* Accepted formats */}
        <div className="flex flex-wrap gap-2 justify-center">
          {Object.entries(ACCEPTED_FORMATS).map(([category, exts]) => (
            <div
              key={category}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-[#b0dde0] text-[10px] text-[#09919b] font-semibold"
            >
              <span>{category}:</span>
              <span className="text-slate-600 font-mono">{exts.join(', ')}</span>
            </div>
          ))}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ALL_EXTENSIONS.join(',')}
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          className="hidden"
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-[#09919b]">
            Archivos ({files.length})
          </p>
          {files.map((uf, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200 hover:border-[#b0dde0] transition-colors"
            >
              {/* Status icon */}
              <div className="flex-shrink-0">
                {uf.status === 'uploading' && (
                  <Loader2 className="h-5 w-5 text-[#09919b] animate-spin" />
                )}
                {uf.status === 'success' && (
                  <CheckCircle2 className="h-5 w-5 text-secondary" />
                )}
                {uf.status === 'error' && (
                  <AlertCircle className="h-5 w-5 text-rose-600" />
                )}
                {uf.status === 'pending' && (
                  <File className="h-5 w-5 text-slate-400" />
                )}
              </div>

              {/* File info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-700 truncate">
                  {uf.file.name}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-slate-500">
                    {formatFileSize(uf.file.size)}
                  </span>
                  {uf.status === 'uploading' && (
                    <span className="text-xs text-[#09919b] font-semibold">
                      {uf.progress}%
                    </span>
                  )}
                  {uf.error && (
                    <span className="text-xs text-rose-600">{uf.error}</span>
                  )}
                </div>

                {/* Progress bar */}
                {uf.status === 'uploading' && (
                  <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#09919b] transition-all duration-300"
                      style={{ width: `${uf.progress}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Remove button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(idx);
                }}
                className="flex-shrink-0 p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-rose-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Memoizar para evitar re-renders cuando las props no cambian
export const CaseFileUploader = memo(CaseFileUploaderComponent);
