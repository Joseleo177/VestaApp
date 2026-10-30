import { useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/cn";

// Solo respuestas que la app respalda hoy. Lo que depende de cada asociación
// (montos, fechas, mora) no se responde aquí: lo decide su junta.
const FAQ: [string, string][] = [
  [
    "¿Cómo obtengo mi usuario?",
    "Tu usuario y tu contraseña te los entrega la administración de tu asociación. Si no los tienes, pídeselos directamente.",
  ],
  [
    "¿En qué moneda pago?",
    "Las cuotas están expresadas en referencia (REF). Puedes pagarlas en divisas o en bolívares; en bolívares se convierten con la tasa BCV de la fecha de tu pago.",
  ],
  [
    "¿Puedo pagar varias cuotas juntas?",
    "Sí. Marca las cuotas que quieras pagar, haz una sola transferencia por el total y regístrala una vez.",
  ],
  [
    "¿Cuándo se refleja mi pago?",
    "Al registrarlo queda “En revisión”. Cuando la administración lo confirma, la cuota pasa a pagada y su recibo queda disponible para descargar.",
  ],
  [
    "¿Qué pasa si pago de más?",
    "El excedente queda como saldo a favor en tu cuenta. Al pagar tu próxima cuota puedes usarlo con «Pagar con saldo a favor».",
  ],
  [
    "Olvidé mi contraseña, ¿qué hago?",
    "Pídele a la administración de tu asociación que te asigne una nueva. Después puedes cambiarla desde tu perfil.",
  ],
];

export function LandingFaq() {
  const [open, setOpen] = useState(0);

  return (
    <section id="preguntas" className="scroll-mt-20 border-t border-ios-separator">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:py-24">
        <div>
          <p className="text-[14px] font-semibold text-brand-600">Preguntas frecuentes</p>
          <h2 className="mt-2 text-[30px] font-bold leading-tight tracking-[-0.02em] text-ios-label sm:text-[38px]">
            Lo que suelen preguntar los vecinos
          </h2>
        </div>

        <div className="divide-y divide-ios-separator border-y border-ios-separator">
          {FAQ.map(([q, a], i) => {
            const on = open === i;
            return (
              <div key={q}>
                <button
                  type="button"
                  onClick={() => setOpen(on ? -1 : i)}
                  aria-expanded={on}
                  className="flex w-full items-center justify-between gap-4 py-5 text-left"
                >
                  <span className="text-[17px] font-semibold text-ios-label">{q}</span>
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ios-separator text-ios-secondary transition-transform duration-200",
                      on && "rotate-45"
                    )}
                  >
                    <Plus className="h-4 w-4" />
                  </span>
                </button>
                {on && (
                  <p className="popover-in -mt-1 pb-5 pr-12 text-[15px] leading-relaxed text-ios-secondary">{a}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
