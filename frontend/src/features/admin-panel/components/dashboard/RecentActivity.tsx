import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Payment } from "@/types/domain";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency } from "@/lib/format";
import { relativeDay } from "./PendingQueue";

/** Los últimos pagos que entraron: el pulso del día. */
export function RecentActivity({
  loading,
  payments,
  nameOf,
}: {
  loading: boolean;
  payments: Payment[];
  nameOf: (p: Payment) => string;
}) {
  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-ios-separator px-5 py-4">
        <h2 className="text-[15px] font-semibold text-ios-label">Últimos pagos confirmados</h2>
        <p className="text-[12px] text-ios-secondary">Lo más reciente que entró a caja</p>
      </div>
      {loading ? (
        <div className="space-y-4 p-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-9 w-9" />
              <Skeleton className="h-3 flex-1" />
            </div>
          ))}
        </div>
      ) : payments.length === 0 ? (
        <p className="flex-1 px-5 py-8 text-center text-[13px] text-ios-secondary">Todavía no hay pagos confirmados.</p>
      ) : (
        <ul className="flex-1 divide-y divide-ios-separator">
          {payments.map((p) => {
            const who = nameOf(p);
            return (
              <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                <Avatar name={who} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-ios-label">{who}</p>
                  <p className="truncate text-[12px] text-ios-secondary">
                    {[p.property?.code, relativeDay(p.reviewedAt ?? p.paymentDate)].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <Money value={formatCurrency(p.amount)} className="shrink-0 text-[13px] font-semibold text-ios-label" />
              </li>
            );
          })}
        </ul>
      )}
      <Link
        to="/admin/pagos"
        className="flex items-center justify-center gap-1 border-t border-ios-separator py-3 text-[13px] font-semibold text-brand-600 transition-colors hover:bg-ios-fill/50"
      >
        Ver todos los pagos <ChevronRight className="h-4 w-4" />
      </Link>
    </Card>
  );
}
