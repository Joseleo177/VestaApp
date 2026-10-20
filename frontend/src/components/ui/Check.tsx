import { Check as CheckIcon } from "lucide-react";
import { cn } from "@/lib/cn";

interface CheckProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** También es la etiqueta accesible; con `disabled`, explica por qué. */
  title: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Casilla de selección para listas (pagar varias cuotas juntas). Borde entero
 * en reposo para que se note que la fila se puede marcar; marcada, relleno de
 * marca con el visto en blanco. Deshabilitada no se esconde: queda gris y el
 * motivo va en `title`. Detiene el clic para no disparar la fila de paso.
 */
export function Check({ checked, onChange, title, disabled, className }: CheckProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={title}
      title={title}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onChange(!checked);
      }}
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 focus-visible:ring-offset-1",
        checked
          ? "border border-brand-600 bg-brand-600 text-white"
          : disabled
            ? "cursor-not-allowed border border-ios-separator bg-ios-fill"
            : "border-[1.5px] border-ios-tertiary bg-ios-card hover:border-ios-secondary",
        className
      )}
    >
      {checked && <CheckIcon className="h-3.5 w-3.5" strokeWidth={3.5} />}
    </button>
  );
}
