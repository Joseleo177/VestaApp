import {
  BarChart3,
  CalendarClock,
  Check,
  Copy,
  FileSpreadsheet,
  FileText,
  Layers,
  LucideIcon,
  Receipt,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from "lucide-react";

interface Feature {
  icon: LucideIcon;
  title: string;
  text: string;
}

const RESIDENT: Feature[] = [
  { icon: Wallet, title: "Tu saldo al entrar", text: "Cuánto debes, qué está vencido y el equivalente en bolívares a la tasa del día." },
  { icon: Layers, title: "Varias cuotas, un pago", text: "Marca las cuotas que quieras y págalas con una sola transferencia." },
  { icon: Copy, title: "Datos para transferir", text: "Las cuentas de la asociación con un botón para copiar cada dato." },
  { icon: FileText, title: "Recibos en PDF", text: "Cada cuota pagada trae su recibo, y tu estado de cuenta se descarga completo." },
];

const BOARD: Feature[] = [
  { icon: Receipt, title: "Emisión de cuotas", text: "Genera las cuotas del mes para todas las unidades, regulares o especiales." },
  { icon: ShieldCheck, title: "Validación de pagos", text: "Los pagos reportados llegan a una bandeja para confirmarlos o rechazarlos." },
  { icon: FileSpreadsheet, title: "Conciliación bancaria", text: "Sube el extracto del banco y los pagos que coinciden se confirman solos." },
  { icon: CalendarClock, title: "Control de morosidad", text: "Quién debe, cuánto y desde cuándo, por torre y por departamento." },
  { icon: TrendingUp, title: "Tasa BCV del día", text: "Tasas del dólar y del euro para convertir cada cuota a bolívares." },
  { icon: BarChart3, title: "Reportes en Excel", text: "Lo cobrado en un período y lo que queda por cobrar, listos para la asamblea." },
];

function FeatureItem({ icon: Icon, title, text }: Feature) {
  return (
    <li className="flex gap-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <h3 className="text-[16px] font-semibold text-ios-label">{title}</h3>
        <p className="mt-0.5 text-[14px] leading-relaxed text-ios-secondary">{text}</p>
      </div>
    </li>
  );
}

/**
 * Maqueta de la cuenta del vecino. Es una ilustración con cifras de ejemplo, y
 * lo dice: nadie debe confundirla con datos de su cuenta.
 */
function AccountPreview() {
  const rows = [
    { month: "Octubre de 2026", due: "Vence en 5 días", amount: "30,00", tone: "text-ios-secondary" },
    { month: "Septiembre de 2026", due: "Vencida hace 3 días", amount: "30,00", tone: "text-red-600 dark:text-red-400" },
  ];
  return (
    <div className="relative">
      <div aria-hidden className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-brand-500/20 to-violet-500/10 blur-2xl" />
      <div className="relative overflow-hidden rounded-3xl border border-black/[0.06] bg-ios-card shadow-ios-lg dark:border-white/10">
        <div className="flex items-start justify-between gap-4 px-6 pb-5 pt-6">
          <div>
            <p className="text-[13px] font-medium text-ios-secondary">Saldo pendiente</p>
            <p className="mt-1 text-[32px] font-bold leading-none tracking-tight text-ios-label">
              <span className="mr-1 text-[0.5em] font-medium text-ios-secondary">REF</span>60,00
            </p>
            <p className="mt-1.5 text-[13px] tabular-nums text-ios-secondary">≈ Bs. 58.358,92 a la tasa de hoy</p>
          </div>
          <span className="rounded-full bg-ios-fill px-2.5 py-1 text-[11px] font-semibold text-ios-secondary">
            Ejemplo
          </span>
        </div>
        <ul className="divide-y divide-ios-separator border-t border-ios-separator">
          {rows.map((r) => (
            <li key={r.month} className="flex items-center gap-3 px-6 py-3.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-brand-600 text-white">
                <Check className="h-3.5 w-3.5" strokeWidth={3.5} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-ios-label">{r.month}</p>
                <p className={`text-[12px] font-medium ${r.tone}`}>{r.due}</p>
              </div>
              <p className="text-[14px] font-semibold tabular-nums text-ios-label">
                <span className="mr-1 text-[0.78em] font-medium text-ios-secondary">REF</span>
                {r.amount}
              </p>
            </li>
          ))}
        </ul>
        <div className="border-t border-ios-separator px-6 py-4">
          <div className="flex h-11 items-center justify-center rounded-xl bg-brand-600 text-[15px] font-semibold text-white">
            Pagar REF 60,00
          </div>
        </div>
      </div>
    </div>
  );
}

/** Qué hace la app, para cada uno de sus dos públicos. */
export function LandingAudiences() {
  return (
    <>
      <section id="vecinos" className="scroll-mt-20 border-t border-ios-separator bg-ios-card">
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div>
            <p className="text-[14px] font-semibold text-brand-600">Para cada vecino</p>
            <h2 className="mt-2 text-[30px] font-bold leading-tight tracking-[-0.02em] text-ios-label sm:text-[38px]">
              Tu cuenta de la asociación, clara y en el teléfono
            </h2>
            <p className="mt-3 text-[16px] leading-relaxed text-ios-secondary">
              Sin preguntar por WhatsApp ni sacar cuentas: entras y ves qué debes, cómo pagarlo y lo que ya pagaste.
            </p>
            <ul className="mt-8 space-y-6">
              {RESIDENT.map((f) => (
                <FeatureItem key={f.title} {...f} />
              ))}
            </ul>
          </div>
          <AccountPreview />
        </div>
      </section>

      <section id="junta" className="scroll-mt-20 border-t border-ios-separator">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
          <div className="max-w-2xl">
            <p className="text-[14px] font-semibold text-brand-600">Para la junta directiva</p>
            <h2 className="mt-2 text-[30px] font-bold leading-tight tracking-[-0.02em] text-ios-label sm:text-[38px]">
              La cobranza del mes, ordenada de principio a fin
            </h2>
            <p className="mt-3 text-[16px] leading-relaxed text-ios-secondary">
              De emitir las cuotas a cuadrar con el banco, sin hojas de cálculo aparte.
            </p>
          </div>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BOARD.map(({ icon: Icon, title, text }) => (
              <li
                key={title}
                className="group rounded-2xl border border-ios-separator bg-ios-card p-6 transition-colors hover:border-brand-500/40"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-[17px] font-semibold text-ios-label">{title}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-ios-secondary">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
