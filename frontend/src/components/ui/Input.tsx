import { forwardRef, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface FieldProps {
  label?: string;
  error?: string;
}

interface InputExtras {
  /** Ícono decorativo al inicio del campo. */
  icon?: ReactNode;
  /** Control al final del campo (p. ej. mostrar/ocultar contraseña). */
  trailing?: ReactNode;
}

/** Campo iOS: relleno gris sin borde, esquinas amplias y altura táctil de 44 pt. */
const baseField =
  "h-11 w-full rounded-xl border-0 bg-ios-fill px-3.5 text-[15px] text-ios-label " +
  "transition-shadow placeholder:text-ios-secondary focus:outline-none focus:ring-2";

const fieldState = (error?: string) =>
  error
    ? "ring-1 ring-ios-red/50 focus:ring-ios-red"
    : "focus:ring-brand-500/70";

const labelClass = "block text-[13px] font-medium text-ios-secondary";
const errorClass = "text-[13px] font-medium text-ios-red";

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & FieldProps & InputExtras
>(({ label, error, className, id, icon, trailing, ...props }, ref) => (
  <div className="space-y-1.5">
    {label && (
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
    )}
    <div className="relative">
      {icon && (
        <span
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ios-secondary"
          aria-hidden
        >
          {icon}
        </span>
      )}
      <input
        ref={ref}
        id={id}
        className={cn(
          baseField,
          fieldState(error),
          icon && "pl-11",
          trailing && "pr-11",
          className
        )}
        {...props}
      />
      {trailing && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2">{trailing}</span>
      )}
    </div>
    {error && <p className={errorClass}>{error}</p>}
  </div>
));
Input.displayName = "Input";

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & FieldProps
>(({ label, error, className, id, children, ...props }, ref) => (
  <div className="space-y-1.5">
    {label && (
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
    )}
    <select
      ref={ref}
      id={id}
      className={cn(baseField, fieldState(error), className)}
      {...props}
    >
      {children}
    </select>
    {error && <p className={errorClass}>{error}</p>}
  </div>
));
Select.displayName = "Select";
