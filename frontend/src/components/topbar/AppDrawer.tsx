import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  LayoutGrid,
  LayoutDashboard,
  Users,
  Building2,
  Building,
  Receipt,
  Wallet,
  CreditCard,
  FileSpreadsheet,
  TrendingUp,
  Settings,
  X,
  LucideIcon,
} from "lucide-react";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { cn } from "@/lib/cn";

interface AppItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Degradado del mosaico. Clases completas: Tailwind no genera nombres armados. */
  color: string;
}

const ADMIN_APPS: AppItem[] = [
  { label: "Dashboard",     to: "/admin",              icon: LayoutDashboard, color: "from-indigo-500 to-violet-600"  },
  { label: "Usuarios",      to: "/admin/usuarios",     icon: Users,           color: "from-sky-500 to-blue-600"       },
  { label: "Torres",        to: "/admin/torres",       icon: Building2,       color: "from-teal-500 to-cyan-600"      },
  { label: "Departamentos", to: "/admin/departamentos",icon: Building,        color: "from-amber-500 to-orange-600"   },
  { label: "Cobros",        to: "/admin/gasto-comun",  icon: Receipt,         color: "from-emerald-500 to-green-600"  },
  { label: "Pagos",         to: "/admin/pagos",        icon: CreditCard,      color: "from-fuchsia-500 to-purple-600" },
  { label: "Extracto",      to: "/admin/extracto",     icon: FileSpreadsheet, color: "from-rose-500 to-red-600"       },
  { label: "Tasa",          to: "/admin/tasa",         icon: TrendingUp,      color: "from-lime-500 to-green-600"     },
  { label: "Ajustes",       to: "/admin/ajustes",      icon: Settings,        color: "from-slate-500 to-slate-700"    },
];

const OWNER_APPS: AppItem[] = [
  { label: "Mi cuenta", to: "/", icon: Wallet, color: "from-indigo-500 to-violet-600" },
];

/** Lanzador tipo "cajón de apps": modal centrado con mosaicos de color. */
export function AppDrawer() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const apps = isAdmin ? ADMIN_APPS : OWNER_APPS;

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onEsc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onEsc);
      document.body.style.overflow = "";
    };
  }, [open]);

  const go = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-xl text-ios-secondary transition-colors hover:bg-ios-fill hover:text-ios-label"
        aria-label="Aplicaciones"
      >
        <LayoutGrid className="h-5 w-5" />
      </button>

      {/* Portal al body: la barra superior tiene backdrop-filter y se convertiría
          en el bloque contenedor de este overlay `fixed`, descentrándolo. */}
      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-md"
            onClick={() => setOpen(false)}
            aria-hidden
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Aplicaciones"
            className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-ios-card p-6 shadow-ios-lg sm:p-8"
          >
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-[13px] font-semibold uppercase tracking-widest text-ios-secondary">
                Aplicaciones
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-ios-fill text-ios-secondary transition-colors hover:bg-ios-separator hover:text-ios-label"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {apps.map(({ label, to, icon: Icon, color }) => (
                <button
                  key={to}
                  onClick={() => go(to)}
                  className={cn(
                    "flex aspect-[4/3] flex-col items-center justify-center gap-2.5 rounded-2xl",
                    "bg-gradient-to-br text-white shadow-md",
                    "transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-lg",
                    "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2",
                    color
                  )}
                >
                  <Icon className="h-7 w-7" strokeWidth={1.75} />
                  <span className="text-sm font-semibold">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
