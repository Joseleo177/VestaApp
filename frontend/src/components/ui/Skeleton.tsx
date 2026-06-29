import { cn } from "@/lib/cn";

/** Bloque skeleton con shimmer. Base para loaders de tablas/cards. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-slate-200/70",
        "after:absolute after:inset-0 after:-translate-x-full",
        "after:animate-shimmer after:bg-gradient-to-r",
        "after:from-transparent after:via-white/60 after:to-transparent",
        className
      )}
    />
  );
}

/** Skeleton para filas de tabla. */
export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-5 py-4">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={cn("h-4", c === 0 ? "w-1/4" : "flex-1")} />
          ))}
        </div>
      ))}
    </div>
  );
}
