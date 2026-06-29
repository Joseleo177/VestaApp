import { useCallback, useEffect, useMemo, useState } from "react";
import { UploadCloud, FileText, X } from "lucide-react";
import { cn } from "@/lib/cn";

interface FileDropzoneProps {
  value?: File;
  onChange: (file?: File) => void;
  error?: string;
  accept?: string;
}

/**
 * Zona de arrastrar y soltar para el comprobante. Muestra previsualización si
 * el archivo es imagen, o un ícono de documento si es PDF.
 */
export function FileDropzone({
  value,
  onChange,
  error,
  accept = "image/png,image/jpeg,image/webp,application/pdf",
}: FileDropzoneProps) {
  const [dragging, setDragging] = useState(false);

  // Previsualización de imágenes mediante object URL (se libera al desmontar).
  const previewUrl = useMemo(
    () => (value && value.type.startsWith("image/") ? URL.createObjectURL(value) : null),
    [value]
  );
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) onChange(file);
    },
    [onChange]
  );

  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-medium text-slate-700">Comprobante</span>

      {!value ? (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors",
            dragging
              ? "border-brand-500 bg-brand-50"
              : error
              ? "border-rose-300 bg-rose-50/50"
              : "border-slate-300 bg-slate-50 hover:border-brand-400 hover:bg-brand-50/40"
          )}
        >
          <UploadCloud className="h-8 w-8 text-slate-400" />
          <span className="text-sm font-medium text-slate-600">
            Arrastra el comprobante o haz clic para subir
          </span>
          <span className="text-xs text-slate-400">PNG, JPG o PDF · máx. 5MB</span>
          <input
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => onChange(e.target.files?.[0])}
          />
        </label>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Previsualización del comprobante"
              className="h-16 w-16 rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
              <FileText className="h-7 w-7" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-700">{value.name}</p>
            <p className="text-xs text-slate-400">
              {(value.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600"
            aria-label="Quitar archivo"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
    </div>
  );
}
