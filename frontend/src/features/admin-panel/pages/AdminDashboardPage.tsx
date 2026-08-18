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

// Tarjetas blancas sobre el fondo agrupado: el color vive solo en el ícono y la cifra.
const COLOR_MAP: Record<KpiCardProps["color"], { icon: string; value: string }> = {
  slate:   { icon: "bg-ios-fill text-ios-secondary",      value: "text-ios-label"  },
  emerald: { icon: "bg-ios-green/10 text-ios-green",      value: "text-ios-green"  },
  rose:    { icon: "bg-ios-red/10 text-ios-red",          value: "text-ios-red"    },
  amber:   { icon: "bg-ios-orange/10 text-ios-orange",    value: "text-ios-orange" },
  brand:   { icon: "bg-brand-50 text-brand-600",          value: "text-brand-600"  },
};

function KpiCard({ icon, label, value, sub, color, loading }: KpiCardProps) {
  const c = COLOR_MAP[color];
  return (
    // `min-w-0`: sin esto el ítem del grid no baja de su ancho de contenido y
    // desborda la página en pantallas angostas.
    <div className="flex min-w-0 items-center gap-4 rounded-2xl bg-ios-card p-5 shadow-ios">
      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", c.icon)}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-ios-secondary">
          {label}
        </p>
        {loading ? (
          <div className="mt-1 h-6 w-16 animate-pulse rounded bg-ios-separator" />
        ) : (
          // Los conteos son cortos, pero un monto como "€16.170,00" no cabe a
          // text-2xl en la columna del grid: se baja un escalón y se permite
          // que parta de línea antes que recortar una cifra de dinero.
          <p
            className={cn(
              "font-bold leading-tight tabular-nums break-words",
              String(value).length > 9 ? "text-xl" : "text-2xl",
              c.value
            )}
          >
            {value}
          </p>
        )}
        {sub && !loading && (
          <p className="mt-0.5 text-xs text-ios-secondary truncate">{sub}</p>
        )}
      </div>
    </div>
  );
}

export function AdminDashboardPage() {
  const { pending, loading: loadingPending, refetch } = usePendingPayments();
  const { properties, loading: loadingProps, refetch: refetchProperties } = useProperties();
  const [selected, setSelected] = useState<Payment | null>(null);

  const stats = useMemo(() => {
    const total      = properties.length;
    const alDia      = properties.filter((p) => p.balance === 0).length;
    const morosos    = properties.filter((p) => p.balance > 0).length;
    const deudaTotal = properties.reduce((s, p) => s + Number(p.balance), 0);
    return { total, alDia, morosos, deudaTotal };
  }, [properties]);

  const loading = loadingProps || loadingPending;

  // Confirmar o rechazar mueve la cola de validación y también los saldos,
  // así que hay que recargar ambas fuentes: KPIs y morosidad salen de properties.
  const handleResolved = () => {
    setSelected(null);
    void refetch();
    void refetchProperties();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[28px] font-bold leading-tight text-ios-label">Dashboard</h1>
        <p className="text-sm text-ios-secondary">Resumen general de la asociación</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
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
          <h2 className="text-lg font-semibold text-ios-label">Pagos por validar</h2>
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
        <h2 className="mb-3 text-lg font-semibold text-ios-label">Control de morosidad</h2>
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
