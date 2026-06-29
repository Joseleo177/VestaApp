import { useMemo, useState } from "react";
import {
  Building,
  CheckCircle2,
  AlertTriangle,
  Euro,
  ClipboardList,
} from "lucide-react";
import { Payment } from "@/types/domain";
import { usePendingPayments } from "../hooks/usePendingPayments";
import { useProperties } from "../hooks/useProperties";
import { ValidationInbox } from "../components/ValidationInbox";
import { PaymentReviewDrawer } from "../components/PaymentReviewDrawer";
import { DelinquencyTable } from "../components/DelinquencyTable";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/cn";

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color: "slate" | "emerald" | "rose" | "amber" | "brand";
  loading?: boolean;
}

const COLOR_MAP: Record<KpiCardProps["color"], { bg: string; icon: string; value: string }> = {
  slate:   { bg: "bg-slate-50",   icon: "bg-slate-100 text-slate-500",   value: "text-slate-800"  },
  emerald: { bg: "bg-emerald-50", icon: "bg-emerald-100 text-emerald-600",value: "text-emerald-700"},
  rose:    { bg: "bg-rose-50",    icon: "bg-rose-100 text-rose-600",      value: "text-rose-700"   },
  amber:   { bg: "bg-amber-50",   icon: "bg-amber-100 text-amber-600",    value: "text-amber-700"  },
  brand:   { bg: "bg-brand-50",   icon: "bg-brand-100 text-brand-700",    value: "text-brand-700"  },
};

function KpiCard({ icon, label, value, sub, color, loading }: KpiCardProps) {
  const c = COLOR_MAP[color];
  return (
    <div className={cn("flex items-center gap-4 rounded-2xl p-5", c.bg)}>
      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", c.icon)}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
        {loading ? (
          <div className="mt-1 h-6 w-16 animate-pulse rounded bg-slate-200" />
        ) : (
          <p className={cn("text-2xl font-bold leading-tight", c.value)}>{value}</p>
        )}
        {sub && !loading && (
          <p className="mt-0.5 text-xs text-slate-400 truncate">{sub}</p>
        )}
      </div>
    </div>
  );
}

export function AdminDashboardPage() {
  const { pending, loading: loadingPending, refetch } = usePendingPayments();
  const { properties, loading: loadingProps } = useProperties();
  const [selected, setSelected] = useState<Payment | null>(null);

  const stats = useMemo(() => {
    const total      = properties.length;
    const alDia      = properties.filter((p) => p.balance === 0).length;
    const morosos    = properties.filter((p) => p.balance > 0).length;
    const deudaTotal = properties.reduce((s, p) => s + Number(p.balance), 0);
    return { total, alDia, morosos, deudaTotal };
  }, [properties]);

  const loading = loadingProps || loadingPending;

  const handleResolved = () => {
    setSelected(null);
    void refetch();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-sm text-slate-500">Resumen general del condominio</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          icon={<Building className="h-5 w-5" />}
          label="Departamentos"
          value={stats.total}
          color="slate"
          loading={loading}
        />
        <KpiCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Al día"
          value={stats.alDia}
          sub={stats.total > 0 ? `${Math.round((stats.alDia / stats.total) * 100)}% del total` : undefined}
          color="emerald"
          loading={loading}
        />
        <KpiCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Morosos"
          value={stats.morosos}
          sub={stats.total > 0 ? `${Math.round((stats.morosos / stats.total) * 100)}% del total` : undefined}
          color="rose"
          loading={loading}
        />
        <KpiCard
          icon={<Euro className="h-5 w-5" />}
          label="Deuda total"
          value={formatCurrency(stats.deudaTotal)}
          sub="saldo pendiente"
          color="amber"
          loading={loading}
        />
        <KpiCard
          icon={<ClipboardList className="h-5 w-5" />}
          label="Por validar"
          value={pending.length}
          sub={pending.length === 0 ? "Todo al día" : `${pending.length} pago${pending.length !== 1 ? "s" : ""} esperando`}
          color={pending.length > 0 ? "brand" : "slate"}
          loading={loading}
        />
      </div>

      {/* Pagos por validar */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-lg font-semibold text-slate-800">Pagos por validar</h2>
          {pending.length > 0 && (
            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">
              {pending.length}
            </span>
          )}
        </div>
        <ValidationInbox
          payments={pending}
          loading={loadingPending}
          onSelect={setSelected}
        />
      </section>

      {/* Control de morosidad */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-800">Control de morosidad</h2>
        <DelinquencyTable properties={properties} loading={loadingProps} />
      </section>

      <PaymentReviewDrawer
        payment={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        onResolved={handleResolved}
      />
    </div>
  );
}
