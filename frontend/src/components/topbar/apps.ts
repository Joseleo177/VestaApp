import {
  BarChart3,
  Building,
  Building2,
  CreditCard,
  FileSpreadsheet,
  LayoutDashboard,
  LucideIcon,
  Receipt,
  Settings,
  TrendingUp,
  Users,
} from "lucide-react";

export interface AppItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Para qué sirve, en una línea: se lee en el lanzador y también se busca. */
  hint: string;
  /** Otras palabras con que alguien podría buscarla. */
  keywords?: string;
  /** Color del icono. Clases completas: Tailwind no genera nombres armados. */
  tone: string;
}

export interface AppGroup {
  label: string;
  apps: AppItem[];
}

/**
 * Apps del administrador agrupadas por el trabajo que resuelven. El color vive
 * solo en el icono: diez tarjetas con degradados saturados competían entre sí y
 * ninguna destacaba.
 */
export const ADMIN_GROUPS: AppGroup[] = [
  {
    label: "Día a día",
    apps: [
      { label: "Dashboard", to: "/admin", icon: LayoutDashboard, hint: "Cobranza, deuda y pendientes", keywords: "inicio resumen panel", tone: "bg-indigo-500/[0.12] text-indigo-600 dark:text-indigo-400" },
      { label: "Pagos", to: "/admin/pagos", icon: CreditCard, hint: "Validar y registrar pagos", keywords: "validar confirmar rechazar importar", tone: "bg-fuchsia-500/[0.12] text-fuchsia-600 dark:text-fuchsia-400" },
      { label: "Cobros", to: "/admin/gasto-comun", icon: Receipt, hint: "Emitir las cuotas del mes", keywords: "cuotas emitir periodo gasto", tone: "bg-emerald-500/[0.12] text-emerald-600 dark:text-emerald-400" },
      { label: "Extracto", to: "/admin/extracto", icon: FileSpreadsheet, hint: "Conciliar con el banco", keywords: "banco conciliacion estado de cuenta", tone: "bg-rose-500/[0.12] text-rose-600 dark:text-rose-400" },
    ],
  },
  {
    label: "Asociación",
    apps: [
      { label: "Clientes", to: "/admin/clientes", icon: Users, hint: "Vecinos, autorizados y accesos", keywords: "usuarios propietarios copropietarios vecinos", tone: "bg-sky-500/[0.12] text-sky-600 dark:text-sky-400" },
      { label: "Departamentos", to: "/admin/departamentos", icon: Building, hint: "Unidades, titulares y alícuotas", keywords: "apartamentos unidades inmuebles", tone: "bg-amber-500/[0.12] text-amber-600 dark:text-amber-400" },
      { label: "Torres", to: "/admin/torres", icon: Building2, hint: "Edificios de la asociación", keywords: "edificios bloques", tone: "bg-teal-500/[0.12] text-teal-600 dark:text-teal-400" },
    ],
  },
  {
    label: "Finanzas y ajustes",
    apps: [
      { label: "Reportes", to: "/admin/reportes", icon: BarChart3, hint: "Cobrado y deuda en Excel", keywords: "excel informes morosidad", tone: "bg-blue-500/[0.12] text-blue-600 dark:text-blue-400" },
      { label: "Tasa", to: "/admin/tasa", icon: TrendingUp, hint: "Tasa BCV del dólar y el euro", keywords: "bcv dolar euro cambio", tone: "bg-lime-500/[0.14] text-lime-700 dark:text-lime-400" },
      { label: "Ajustes", to: "/admin/ajustes", icon: Settings, hint: "Datos y cuentas de la asociación", keywords: "configuracion banco recibos", tone: "bg-slate-500/[0.12] text-slate-600 dark:text-slate-300" },
    ],
  },
];

export const ADMIN_APPS = ADMIN_GROUPS.flatMap((g) => g.apps);

/** La app de una ruta: la de prefijo más largo ("/admin/pagos" antes que "/admin"). */
export function appForPath(pathname: string): AppItem | undefined {
  return ADMIN_APPS.filter((a) => pathname === a.to || pathname.startsWith(`${a.to}/`)).sort(
    (a, b) => b.to.length - a.to.length
  )[0];
}
