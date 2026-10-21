import { Check } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency } from "@/lib/format";
import { PropertyWithBalance } from "../../types";

const TOP = 5;

/**
 * Los saldos más altos, cada uno con una barra proporcional al mayor: de un
 * vistazo se ve si la deuda está repartida o concentrada en pocos. La cifra va
 * en tinta; el rojo vive solo en la barra.
 */
export function TopDebtors({
  loading,
  debtors,
  totalDebt,
}: {
  loading: boolean;
  debtors: PropertyWithBalance[];
  totalDebt: number;
}) {
  const top = debtors.slice(0, TOP);
  const max = Number(top[0]?.balance ?? 0);
  // Qué parte de toda la deuda se llevan los primeros: dice si está concentrada.
  const share = totalDebt > 0 ? top.reduce((s, p) => s + Number(p.balance), 0) / totalDebt : 0;

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-ios-separator px-5 py-4">
        <h2 className="text-[15px] font-semibold text-ios-label">Quién debe más</h2>
        <p className="text-[12px] text-ios-secondary">
          {loading
            ? "Cargando…"
            : debtors.length > TOP
              ? `Estos ${TOP} suman el ${Math.round(share * 100)}% de la deuda`
              : debtors.length
                ? `${debtors.length} ${debtors.length === 1 ? "departamento" : "departamentos"} con saldo`
                : "Nadie tiene saldo pendiente"}
        </p>
      </div>

      {loading ? (
        <div className="space-y-5 p-5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-1.5 w-full" />
            </div>
          ))}
        </div>
      ) : top.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/10">
            <Check className="h-6 w-6 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
          </span>
          <p className="mt-3 text-[14px] font-semibold text-ios-label">Todos al día</p>
          <p className="text-[12px] text-ios-secondary">Ningún departamento debe nada.</p>
        </div>
      ) : (
        <ol className="flex-1 space-y-4 px-5 py-4">
          {top.map((p) => {
            const balance = Number(p.balance);
            return (
              <li key={p.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="min-w-0 truncate text-[13px] text-ios-label">
                    <span className="font-semibold">{p.code}</span>
                    {p.owner && <span className="text-ios-secondary"> · {p.owner.fullName}</span>}
                  </p>
                  <Money value={formatCurrency(balance)} className="shrink-0 text-[13px] font-semibold text-ios-label" />
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ios-fill" aria-hidden>
                  <div
                    className="h-full rounded-full bg-red-500/80 transition-[width] duration-500"
                    style={{ width: `${max > 0 ? Math.max(4, (balance / max) * 100) : 0}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {debtors.length > 0 && (
        <a
          href="#morosidad"
          className="border-t border-ios-separator py-3 text-center text-[13px] font-semibold text-brand-600 transition-colors hover:bg-ios-fill/50"
        >
          Ver control de morosidad
        </a>
      )}
    </Card>
  );
}
