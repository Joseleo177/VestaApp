import { Home, Landmark, LucideIcon, Receipt, Wallet } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { Modal } from "@/components/ui/Modal";
import { PaymentForm } from "@/features/payments/components/PaymentForm";
import { cn } from "@/lib/cn";
import { useOwnerDashboard } from "../hooks/useOwnerDashboard";
import { useCondoSettings } from "../hooks/useCondoSettings";
import { ResidentContext } from "../hooks/useResident";

interface NavItem {
  to: string;
  label: string;
  /** Rótulo corto de la barra inferior del móvil. */
  short: string;
  icon: LucideIcon;
}

const NAV: NavItem[] = [
  { to: "/", label: "Inicio", short: "Inicio", icon: Home },
  { to: "/cuotas", label: "Mis cuotas", short: "Cuotas", icon: Receipt },
  { to: "/pagos", label: "Mis pagos", short: "Pagos", icon: Wallet },
  { to: "/datos-de-pago", label: "Datos de pago", short: "Cómo pagar", icon: Landmark },
];

/** Cuántas cuotas abiertas tiene: se ve desde cualquier sección. */
function Badge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold tabular-nums text-white",
        className
      )}
    >
      {count}
    </span>
  );
}

/**
 * Marco de las secciones del vecino. Antes todo vivía en una sola pantalla, una
 * tabla tras otra; ahora cada cosa tiene su sección y el inicio solo resume.
 * Los datos y el formulario de pago viven aquí, compartidos por todas.
 */
export function ResidentLayout() {
  const dashboard = useOwnerDashboard();
  const { settings, loading: loadingSettings } = useCondoSettings();
  const context: ResidentContext = { ...dashboard, settings, loadingSettings };
  const openCount = dashboard.loadingStatement ? 0 : dashboard.open.length;

  return (
    <>
      {/* ── Escritorio: pestañas bajo la barra superior ── */}
      <nav aria-label="Secciones" className="mb-6 hidden gap-1 border-b border-ios-separator md:flex">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "-mb-px flex items-center gap-2 border-b-2 px-3.5 pb-3 pt-1 text-[14px] transition-colors",
                isActive
                  ? "border-brand-600 font-semibold text-ios-label"
                  : "border-transparent font-medium text-ios-secondary hover:text-ios-label"
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={cn("h-[18px] w-[18px]", isActive && "text-brand-600")} />
                {label}
                {to === "/cuotas" && <Badge count={openCount} />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Aire al final en móvil: la barra inferior no tapa el último elemento. */}
      <div className="pb-24 md:pb-0">
        <Outlet context={context} />
      </div>

      {/* ── Móvil: barra inferior, a mano del pulgar ── */}
      <nav
        aria-label="Secciones"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-ios-separator bg-ios-card/90 backdrop-blur-xl backdrop-saturate-150 md:hidden"
      >
        <div className="mx-auto flex max-w-md items-stretch justify-around px-2 pb-[max(0.375rem,env(safe-area-inset-bottom))] pt-1.5">
          {NAV.map(({ to, short, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "relative flex min-w-[64px] flex-col items-center gap-1 rounded-xl px-2 py-1 transition-colors",
                  isActive ? "text-brand-600" : "text-ios-secondary"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className="h-[22px] w-[22px]" strokeWidth={isActive ? 2.25 : 1.75} />
                  <span className={cn("text-[11px] leading-none", isActive ? "font-semibold" : "font-medium")}>
                    {short}
                  </span>
                  {to === "/cuotas" && <Badge count={openCount} className="absolute -top-0.5 right-2.5" />}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      <Modal open={dashboard.payIds !== null} onClose={dashboard.closePay} title="Registrar un pago">
        {dashboard.payIds && dashboard.open.length > 0 ? (
          <PaymentForm
            // Montar de nuevo con cada apertura: la preselección es solo inicial.
            key={dashboard.payIds.join(",")}
            charges={dashboard.open}
            defaultChargeIds={dashboard.payIds}
            creditBalance={dashboard.creditBalance}
            onSuccess={dashboard.onPaid}
            onCancel={dashboard.closePay}
          />
        ) : (
          <p className="py-4 text-center text-sm text-ios-secondary">No tienes cuotas pendientes por pagar.</p>
        )}
      </Modal>
    </>
  );
}
