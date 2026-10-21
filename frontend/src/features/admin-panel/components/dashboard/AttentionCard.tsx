import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Check, ChevronRight, ClipboardCheck, FileSpreadsheet } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/cn";

interface ItemProps {
  icon: ReactNode;
  /** Pide atención: icono en color y la cifra en grande. En cero, todo en gris. */
  hot: boolean;
  tone: "brand" | "danger" | "neutral";
  title: string;
  sub: ReactNode;
  count?: number;
  /** Ancla dentro del panel (#por-validar) o ruta de otra sección. */
  to: string;
}

const TONE = {
  brand: "bg-brand-50 text-brand-600",
  danger: "bg-red-500/10 text-red-600 dark:text-red-400",
  neutral: "bg-ios-fill text-ios-secondary",
};

function Item({ icon, hot, tone, title, sub, count, to }: ItemProps) {
  const body = (
    <>
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", hot ? TONE[tone] : TONE.neutral)}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-ios-label">{title}</p>
        <p className="truncate text-[12px] text-ios-secondary">{sub}</p>
      </div>
      {count !== undefined &&
        (hot ? (
          <span className="text-[22px] font-bold tabular-nums text-ios-label">{count}</span>
        ) : (
          <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
        ))}
      <ChevronRight className="h-4 w-4 shrink-0 text-ios-tertiary" />
    </>
  );
  const cls = "flex items-center gap-3 px-5 py-4 transition-colors hover:bg-ios-fill/50";
  return to.startsWith("#") ? (
    <a href={to} className={cls}>
      {body}
    </a>
  ) : (
    <Link to={to} className={cls}>
      {body}
    </Link>
  );
}

interface AttentionCardProps {
  loading: boolean;
  pendingCount: number;
  pendingTotal: number;
  debtorCount: number;
  totalDebt: number;
}

/** Lo que el administrador tiene que hacer hoy, cada cosa con su camino. */
export function AttentionCard(p: AttentionCardProps) {
  const anything = p.pendingCount > 0 || p.debtorCount > 0;
  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-ios-separator px-5 py-4">
        <h2 className="text-[15px] font-semibold text-ios-label">Requiere tu atención</h2>
        <p className="text-[12px] text-ios-secondary">
          {p.loading ? "Revisando…" : anything ? "Esto está esperando por ti" : "Todo en orden por ahora"}
        </p>
      </div>
      {p.loading ? (
        <div className="space-y-4 p-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 !rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-2.5 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 divide-y divide-ios-separator">
          <Item
            icon={<ClipboardCheck className="h-5 w-5" />}
            hot={p.pendingCount > 0}
            tone="brand"
            title="Pagos por validar"
            sub={
              p.pendingCount > 0 ? (
                <>
                  <Money value={formatCurrency(p.pendingTotal)} /> reportados por los vecinos
                </>
              ) : (
                "No hay pagos esperando revisión"
              )
            }
            count={p.pendingCount}
            to="#por-validar"
          />
          <Item
            icon={<AlertTriangle className="h-5 w-5" />}
            hot={p.debtorCount > 0}
            tone="danger"
            title="Departamentos con deuda"
            sub={
              p.debtorCount > 0 ? (
                <>
                  <Money value={formatCurrency(p.totalDebt)} /> por cobrar en total
                </>
              ) : (
                "Todos están al día"
              )
            }
            count={p.debtorCount}
            to="/admin/departamentos?saldo=deuda"
          />
          <Item
            icon={<FileSpreadsheet className="h-5 w-5" />}
            hot={false}
            tone="neutral"
            title="Conciliar con el banco"
            sub="Sube el extracto y confirma los pagos que coinciden"
            to="/admin/extracto"
          />
        </div>
      )}
    </Card>
  );
}
