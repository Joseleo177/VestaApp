import { cn } from "@/lib/cn";

export interface SegmentedOption<K extends string> {
  key: K;
  label: string;
  /** Cuántos registros hay en esa opción (opcional). */
  count?: number;
}

interface SegmentedProps<K extends string> {
  options: SegmentedOption<K>[];
  value: K;
  onChange: (key: K) => void;
  className?: string;
  "aria-label"?: string;
}

/**
 * Control segmentado: una sola opción activa entre pocas (estado, vista, tipo).
 * Pastilla levantada sobre un riel gris, como el de iOS: se lee como "uno de
 * estos" sin pintar de color la opción activa.
 */
export function Segmented<K extends string>({
  options,
  value,
  onChange,
  className,
  ...aria
}: SegmentedProps<K>) {
  return (
    <div
      role="tablist"
      aria-label={aria["aria-label"]}
      className={cn("inline-flex items-center gap-[2px] rounded-xl bg-ios-fill p-[3px]", className)}
    >
      {options.map((o) => {
        const on = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.key)}
            className={cn(
              "inline-flex h-[30px] items-center gap-1.5 whitespace-nowrap rounded-[9px] px-3 text-[13px] transition-all",
              on
                ? "bg-ios-card font-semibold text-ios-label shadow-[0_1px_2px_rgb(0_0_0/0.08),0_0_0_1px_rgb(0_0_0/0.04)]"
                : "font-medium text-ios-secondary hover:text-ios-label"
            )}
          >
            {o.label}
            {o.count != null && (
              <span className={cn("text-[11px] tabular-nums", on ? "text-ios-secondary" : "text-ios-tertiary")}>
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
