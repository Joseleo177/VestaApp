import { forwardRef, InputHTMLAttributes, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface FieldProps {
  label?: string;
  error?: string;
}

const baseField =
  "w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-800 shadow-sm transition-colors placeholder:text-slate-400 focus:outline-none focus:ring-2";

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & FieldProps
>(({ label, error, className, id, ...props }, ref) => (
  <div className="space-y-1.5">
    {label && (
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
    )}
    <input
      ref={ref}
      id={id}
      className={cn(
        baseField,
        error
          ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200"
          : "border-slate-300 focus:border-brand-500 focus:ring-brand-100",
        className
      )}
      {...props}
    />
    {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
  </div>
));
Input.displayName = "Input";

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & FieldProps
>(({ label, error, className, id, children, ...props }, ref) => (
  <div className="space-y-1.5">
    {label && (
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
    )}
    <select
      ref={ref}
      id={id}
      className={cn(
        baseField,
        error
          ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200"
          : "border-slate-300 focus:border-brand-500 focus:ring-brand-100",
        className
      )}
      {...props}
    >
      {children}
    </select>
    {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
  </div>
));
Select.displayName = "Select";
