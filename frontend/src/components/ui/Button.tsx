import { ButtonHTMLAttributes, forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "success" | "danger" | "ghost" | "outline";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

/**
 * Botones al estilo iOS: relleno sólido para la acción principal, relleno gris
 * para la secundaria (`outline`) y texto teñido sin fondo para la terciaria
 * (`ghost`). Los nombres de variante se conservan para no tocar las páginas.
 */
const variants: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white hover:brightness-95 focus-visible:ring-brand-500",
  success:
    "bg-ios-green text-white hover:brightness-95 focus-visible:ring-ios-green",
  danger:
    "bg-ios-red text-white hover:brightness-95 focus-visible:ring-ios-red",
  ghost:
    "text-brand-600 hover:bg-brand-50 focus-visible:ring-brand-500",
  outline:
    "bg-ios-fill text-ios-label hover:bg-ios-separator focus-visible:ring-ios-tertiary",
};

// Altura mínima táctil de 44 pt en el tamaño por defecto.
const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[13px]",
  md: "h-11 px-5 text-[15px]",
  lg: "h-12 px-6 text-[17px]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, className, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold",
        "transition-all duration-150 active:scale-[0.97]",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
);
Button.displayName = "Button";
