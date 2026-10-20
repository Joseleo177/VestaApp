import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

interface SectionCardProps {
  title: string;
  subtitle?: ReactNode;
  /** Controles a la derecha del encabezado (filtro, botón). */
  aside?: ReactNode;
  /** Enlace al pie: "Ver todas mis cuotas". */
  more?: { to: string; label: string };
  children: ReactNode;
}

/** Tarjeta de sección: encabezado, lista y, si hay más, un enlace al pie. */
export function SectionCard({ title, subtitle, aside, more, children }: SectionCardProps) {
  return (
    <Card className="overflow-hidden">
      <div className="flex min-h-[60px] flex-wrap items-center gap-3 border-b border-ios-separator px-5 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold leading-tight text-ios-label">{title}</h2>
          {subtitle && <p className="truncate text-[12px] tabular-nums text-ios-secondary">{subtitle}</p>}
        </div>
        {aside}
      </div>
      {children}
      {more && (
        <Link
          to={more.to}
          className="flex items-center justify-center gap-1 border-t border-ios-separator py-3 text-[13px] font-semibold text-brand-600 transition-colors hover:bg-ios-fill/50"
        >
          {more.label}
          <ChevronRight className="h-4 w-4" />
        </Link>
      )}
    </Card>
  );
}

export function RowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="divide-y divide-ios-separator">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-4">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

/** Vacío corto, de una línea: dentro de una tarjeta no hace falta más. */
export function QuietEmpty({ icon, title, hint }: { icon?: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-5">
      {icon}
      <div>
        <p className="text-[14px] font-medium text-ios-label">{title}</p>
        {hint && <p className="text-[12px] text-ios-secondary">{hint}</p>}
      </div>
    </div>
  );
}
