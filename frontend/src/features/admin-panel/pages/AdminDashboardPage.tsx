import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { Payment } from "@/types/domain";
import { Page } from "@/components/ui/Page";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { formatPeriod } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useAdminDashboard } from "../hooks/useAdminDashboard";
import { PaymentDetailModal } from "../components/PaymentDetailModal";
import { CollectionHero } from "../components/dashboard/CollectionHero";
import { AttentionCard } from "../components/dashboard/AttentionCard";
import { IncomeChart } from "../components/dashboard/IncomeChart";
import { TopDebtors } from "../components/dashboard/TopDebtors";
import { PendingQueue } from "../components/dashboard/PendingQueue";
import { RecentActivity } from "../components/dashboard/RecentActivity";

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Panel del administrador. Abre con una frase que resume el estado de la
 * asociación y la cifra que más importa (cuánto se ha cobrado del período);
 * debajo, lo que pide acción y luego el contexto: ingresos, deuda y actividad.
 */
export function AdminDashboardPage() {
  const { user } = useAuth();
  const d = useAdminDashboard();
  const [selected, setSelected] = useState<Payment | null>(null);
  const firstName = user?.fullName?.trim().split(/\s+/)[0];

  // La historia del día en una frase, armada solo con lo que hay.
  const summary = (() => {
    const parts: string[] = [];
    if (d.period) parts.push(`llevas cobrado el ${Math.round(d.collection.ratio * 100)}% de ${formatPeriod(d.period).toLowerCase()}`);
    parts.push(
      d.pending.length
        ? `tienes ${plural(d.pending.length, "pago", "pagos")} por validar`
        : "no hay pagos esperando validación"
    );
    if (d.debtors.length) parts.push(`${plural(d.debtors.length, "departamento tiene", "departamentos tienen")} saldo pendiente`);
    else parts.push("todos los departamentos están al día");
    const text = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} y ${parts[parts.length - 1]}` : parts[0];
    return text.charAt(0).toUpperCase() + text.slice(1) + ".";
  })();

  const handleResolved = () => {
    setSelected(null);
    d.refreshAll();
  };

  return (
    <Page
      module="Panel de administración"
      title={firstName ? `${greeting()}, ${firstName}` : greeting()}
      actions={
        <Link
          to="/admin/gasto-comun"
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 text-[13px] font-semibold text-white transition hover:brightness-95 active:scale-[0.97]"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Emitir cuotas</span>
          <span className="sm:hidden">Cuotas</span>
        </Link>
      }
      subheader={
        d.loading || d.loadingActivity ? (
          <Skeleton className="h-4 w-2/3 max-w-xl" />
        ) : (
          <p className="max-w-3xl text-[15px] leading-relaxed text-ios-secondary">{summary}</p>
        )
      }
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CollectionHero loading={d.loadingActivity} period={d.period} collection={d.collection} />
        </div>
        <AttentionCard
          loading={d.loading}
          pendingCount={d.pending.length}
          pendingTotal={d.pendingTotal}
          debtorCount={d.debtors.length}
          totalDebt={d.totalDebt}
        />

        <div className="lg:col-span-2">
          <IncomeChart
            loading={d.loadingActivity}
            months={d.income}
            thisMonth={d.thisMonth}
            lastMonth={d.lastMonth}
          />
        </div>
        <TopDebtors loading={d.loading} debtors={d.debtors} totalDebt={d.totalDebt} />

        {d.pending.length > 0 && (
          <div className="lg:col-span-2">
            <PendingQueue payments={d.pending} onReview={setSelected} nameOf={d.ownerName} />
          </div>
        )}
        <div className={cn(d.pending.length === 0 && "lg:col-span-3")}>
          <RecentActivity loading={d.loadingActivity} payments={d.recent} nameOf={d.ownerName} />
        </div>
      </div>

      <PaymentDetailModal
        payment={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        onResolved={handleResolved}
        ownerName={selected ? d.ownerName(selected) : undefined}
      />
    </Page>
  );
}
