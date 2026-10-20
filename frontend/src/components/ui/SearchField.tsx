import { useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/cn";

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Tecla "/" para enfocar el buscador desde cualquier parte de la página. */
  hotkey?: boolean;
}

/** Buscador de listado: lupa que se tiñe al enfocar y botón para vaciarlo. */
export function SearchField({
  value,
  onChange,
  placeholder = "Buscar…",
  className,
  hotkey = false,
}: SearchFieldProps) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!hotkey) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName);
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hotkey]);

  return (
    <div className={cn("group relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ios-secondary transition-colors group-focus-within:text-brand-600" />
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && value && onChange("")}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border-0 bg-ios-fill pl-9 pr-9 text-[14px] text-ios-label transition-shadow placeholder:text-ios-secondary focus:outline-none focus:ring-2 focus:ring-brand-500/60 [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          onClick={() => {
            onChange("");
            ref.current?.focus();
          }}
          className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-ios-secondary hover:bg-ios-separator hover:text-ios-label"
          aria-label="Limpiar búsqueda"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>
      ) : (
        hotkey && (
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden h-5 -translate-y-1/2 items-center rounded-md border border-ios-separator px-1.5 text-[11px] font-medium text-ios-secondary sm:inline-flex">
            /
          </kbd>
        )
      )}
    </div>
  );
}
