import { Inbox } from "lucide-react";
import { Payment } from "@/types/domain";
import { Card } from "@/components/ui/Card";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatDate } from "@/lib/format";

interface ValidationInboxProps {
  payments: Payment[];
  loading: boolean;
  onSelect: (payment: Payment) => void;
}

/** Inbox de validación: lista de pagos pendientes; al hacer clic abre el drawer. */
export function ValidationInbox({ payments, loading, onSelect }: ValidationInboxProps) {
  if (loading) {
    return (
      <Card className="overflow-hidden">
        <TableSkeleton rows={5} cols={5} />
      </Card>
    );
  }

  if (payments.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Inbox className="h-7 w-7" />}
          title="Sin pagos por validar"
          description="Los nuevos pagos de los vecinos aparecerán aquí."
        />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      {/* Vista móvil: tarjetas */}
      <div className="sm:hidden divide-y divide-slate-100">
        {payments.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p)}
            className="w-full p-4 text-left transition-colors hover:bg-brand-50/50 active:bg-brand-50"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-800">{p.submittedBy.fullName}</p>
                <p className="text-xs text-slate-400">{p.property.code}</p>
              </div>
              <p className="shrink-0 font-bold text-slate-700">{formatCurrency(p.amount)}</p>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-3">
              <p className="text-sm text-slate-500">{p.reference}</p>
              <p className="text-xs text-slate-400">{formatDate(p.paymentDate)}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Vista desktop: tabla */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Vecino</th>
              <th className="px-5 py-3 font-medium">Propiedad</th>
              <th className="px-5 py-3 font-medium">Monto</th>
              <th className="px-5 py-3 font-medium">Referencia</th>
              <th className="px-5 py-3 font-medium">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {payments.map((p) => (
              <tr
                key={p.id}
                onClick={() => onSelect(p)}
                className="cursor-pointer transition-colors hover:bg-brand-50/50"
              >
                <td className="px-5 py-3.5 font-medium text-slate-800">
                  {p.submittedBy.fullName}
                </td>
                <td className="px-5 py-3.5 text-slate-600">{p.property.code}</td>
                <td className="px-5 py-3.5 font-semibold text-slate-700">
                  {formatCurrency(p.amount)}
                </td>
                <td className="px-5 py-3.5 text-slate-600">{p.reference}</td>
                <td className="px-5 py-3.5 text-slate-500">{formatDate(p.paymentDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
