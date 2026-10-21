import { ArrowRight, Check, X } from "lucide-react";

// Cada molestia del día a día emparejada con lo que la resuelve. Solo se promete
// lo que la app hace hoy: cada "con VestaApp" corresponde a una función real.
const PAIRS: [string, string][] = [
  [
    "Escribirle a la junta por WhatsApp para saber cuánto debes.",
    "Tu saldo y tus cuotas pendientes, apenas entras.",
  ],
  [
    "Sacar la cuenta de cuántos bolívares es la cuota con la tasa de hoy.",
    "Cada cuota se convierte a bolívares con la tasa BCV de la fecha del pago.",
  ],
  [
    "Mandar la captura de la transferencia y no saber si la vieron.",
    "Registras el pago con su referencia y ves cuándo queda confirmado.",
  ],
  [
    "Recibos en papel que se pierden o nunca llegan.",
    "Cada cuota pagada tiene su recibo en PDF, listo para descargar.",
  ],
  [
    "La junta cruzando el extracto del banco contra una planilla.",
    "Conciliación con el extracto bancario: lo que coincide se confirma solo.",
  ],
];

/** Franja oscura en cualquier tema: corta el ritmo de la portada clara. */
export function LandingBeforeAfter() {
  return (
    <section className="relative overflow-hidden bg-[#0B0B1A] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255/0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.04)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_80%_70%_at_50%_40%,black,transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 right-0 h-[520px] w-[520px] rounded-full bg-indigo-500/25 blur-[130px]"
      />

      <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
        <div className="max-w-3xl">
          <p className="text-[14px] font-semibold text-indigo-300">La asociación, antes y después</p>
          <h2 className="mt-2 text-[30px] font-bold leading-[1.1] tracking-[-0.02em] sm:text-[40px]">
            De la planilla y las capturas sueltas a{" "}
            <span className="bg-gradient-to-r from-indigo-300 to-violet-300 bg-clip-text text-transparent">
              una cuenta clara para cada vecino
            </span>
            .
          </h2>
        </div>

        <div className="mb-3 mt-12 hidden grid-cols-[minmax(0,1fr)_48px_minmax(0,1fr)] gap-4 text-[13px] font-medium md:grid">
          <span className="text-white/45">Antes</span>
          <span />
          <span className="text-indigo-300">Con VestaApp</span>
        </div>

        <ul className="mt-8 space-y-3 md:mt-0">
          {PAIRS.map(([before, after]) => (
            <li
              key={before}
              className="grid items-stretch gap-2 md:grid-cols-[minmax(0,1fr)_48px_minmax(0,1fr)] md:gap-4"
            >
              <div className="flex items-start gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-4">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white/40">
                  <X className="h-3 w-3" strokeWidth={2.5} />
                </span>
                <span className="text-[15px] leading-relaxed text-white/60">{before}</span>
              </div>
              <div className="hidden items-center justify-center text-white/25 md:flex">
                <ArrowRight className="h-5 w-5" />
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-indigo-300/20 bg-gradient-to-br from-indigo-500/[0.2] to-violet-500/[0.06] px-5 py-4">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-300 text-[#0B0B1A]">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
                <span className="text-[15px] font-medium leading-relaxed text-white">{after}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
