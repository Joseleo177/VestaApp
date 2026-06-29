import { useEffect, useRef, useState } from "react";
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
  LucideIcon,
} from "lucide-react";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { cn } from "@/lib/cn";

interface AppItem {
  label: string;
  to: string;
  icon: LucideIcon;
}

const ADMIN_APPS: AppItem[] = [
  { label: "Dashboard",     to: "/admin",               icon: LayoutDashboard },
  { label: "Usuarios",     to: "/admin/usuarios",       icon: Users          },
  { label: "Torres",       to: "/admin/torres",         icon: Building2      },
  { label: "Departamentos",to: "/admin/departamentos",  icon: Building       },
  { label: "Cobros",       to: "/admin/gasto-comun",   icon: Receipt        },
  { label: "Pagos",        to: "/admin/pagos",          icon: CreditCard     },
  { label: "Extracto",     to: "/admin/extracto",       icon: FileSpreadsheet},
  { label: "Tasa",         to: "/admin/tasa",           icon: TrendingUp     },
];

const OWNER_APPS: AppItem[] = [
  { label: "Mi cuenta", to: "/", icon: Wallet },
];

/** Lanzador tipo "cajón de apps" (grid 3x3) con accesos por rol. */
export function AppDrawer() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const apps = isAdmin ? ADMIN_APPS : OWNER_APPS;

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const go = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
        aria-label="Aplicaciones"
      >
        <LayoutGrid className="h-5 w-5" />
      </button>

      {open && (
        <div className="absolute left-0 top-12 z-50 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
          <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Módulos
          </p>
          <div className="grid grid-cols-3 gap-2">
            {apps.map(({ label, to, icon: Icon }) => (
              <button
                key={to}
                onClick={() => go(to)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl p-3 text-center transition-colors",
                  "hover:bg-brand-50"
                )}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-xs font-medium text-slate-600">{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
