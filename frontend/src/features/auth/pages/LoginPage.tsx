import { ArrowRight, Check, Flame, Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { LoginForm, LOGIN_FIELD_ID } from "../components/LoginForm";
import { LandingBeforeAfter } from "../components/landing/LandingBeforeAfter";
import { LandingAudiences } from "../components/landing/LandingAudiences";
import { LandingFaq } from "../components/landing/LandingFaq";

// Pantalla de entrada con forma de portada: quien llega por primera vez entiende
// qué es la app, y quien entra a pagar tiene el formulario a la vista sin bajar.
// En el teléfono el formulario va justo después del titular.
//
// Los textos describen lo que la app hace hoy. Nada de cifras ni testimonios:
// lo que no se puede respaldar no va en la portada.

const NAV: [string, string][] = [
  ["#vecinos", "Para vecinos"],
  ["#junta", "Para la junta"],
  ["#como-funciona", "Cómo funciona"],
  ["#preguntas", "Preguntas"],
];

const HIGHLIGHTS = [
  "Cuotas en REF, pago en Bs a tasa BCV",
  "Varias cuotas en un solo pago",
  "Recibo en PDF de cada cuota",
  "Hecho para usarse en el teléfono",
];

const STEPS = [
  { title: "Entra a tu cuenta", text: "Usa el usuario y la contraseña que te dio la administración de tu asociación." },
  { title: "Transfiere y registra", text: "Paga a las cuentas de la asociación y registra el pago con su referencia." },
  { title: "Recibe tu recibo", text: "La administración valida el pago y tu recibo en PDF queda en tu cuenta." },
];

/** Lleva al formulario y pone el cursor en el usuario. */
function goToLogin() {
  const field = document.getElementById(LOGIN_FIELD_ID);
  field?.scrollIntoView({ behavior: "smooth", block: "center" });
  // Enfocar sin volver a desplazar: el scroll suave ya está en camino.
  field?.focus({ preventScroll: true });
}

function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
        <Flame className="h-5 w-5" />
      </span>
      <span className="text-[17px] font-bold tracking-tight text-ios-label">VestaApp</span>
    </span>
  );
}

export function LoginPage() {
  const { theme, toggle } = useTheme();
  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-ios-bg text-ios-label">
      {/* ── Cabecera ── */}
      <header className="sticky top-0 z-40 border-b border-ios-separator/70 bg-ios-bg/80 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <a href="#inicio" aria-label="VestaApp, inicio">
            <Logo />
          </a>
          <nav className="ml-6 hidden items-center gap-1 lg:flex">
            {NAV.map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="inline-flex h-9 items-center rounded-lg px-3 text-[14px] font-medium text-ios-secondary transition-colors hover:bg-ios-fill hover:text-ios-label"
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={toggle}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-ios-secondary transition-colors hover:bg-ios-fill hover:text-ios-label"
              aria-label={theme === "dark" ? "Cambiar a modo día" : "Cambiar a modo noche"}
              title={theme === "dark" ? "Modo día" : "Modo noche"}
            >
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={goToLogin}
              className="h-10 rounded-xl bg-brand-600 px-4 text-[14px] font-semibold text-white transition hover:brightness-95 active:scale-[0.98]"
            >
              Iniciar sesión
            </button>
          </div>
        </div>
      </header>

      <main>
        {/* ── Hero ── */}
        <section id="inicio" className="relative overflow-hidden">
          {/* Fondo: rejilla tenue que se desvanece y dos halos de la marca. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgb(0_0_0/0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgb(0_0_0/0.045)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)] dark:bg-[linear-gradient(to_right,rgb(255_255_255/0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.05)_1px,transparent_1px)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -left-32 -top-40 h-[560px] w-[560px] rounded-full bg-indigo-500/20 blur-[120px] dark:bg-indigo-500/25"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-40 top-20 h-[480px] w-[480px] rounded-full bg-violet-400/15 blur-[120px] dark:bg-violet-500/15"
          />

          {/* Tres piezas: en escritorio, texto a la izquierda y formulario a la
              derecha; en el teléfono, titular → formulario → lista. */}
          <div className="relative mx-auto grid max-w-6xl items-start gap-10 px-4 pb-20 pt-10 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-x-16 lg:gap-y-8 lg:pb-28 lg:pt-20">
            <div className="lg:col-start-1 lg:row-start-1">
              <span className="inline-flex h-8 items-center gap-2 rounded-full border border-brand-500/25 bg-ios-card/70 pl-2.5 pr-3.5 text-[13px] font-medium text-ios-secondary backdrop-blur">
                <span className="h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
                Para asociaciones de vecinos y comunidades
              </span>
              <h1 className="mt-5 text-[36px] font-bold leading-[1.04] tracking-[-0.03em] text-ios-label sm:text-[48px] lg:text-[54px]">
                Tu asociación al día, en{" "}
                <span className="bg-gradient-to-r from-indigo-600 to-violet-500 bg-clip-text text-transparent dark:from-indigo-300 dark:to-violet-300">
                  bolívares y en divisas
                </span>
                .
              </h1>
              <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-ios-secondary sm:text-[18px]">
                Cuotas, pagos y recibos en un solo lugar: cada vecino ve lo que debe y paga sin escribirle a nadie, y la
                junta cobra el mes sin planillas sueltas.
              </p>
            </div>

            <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:pt-2">
              <LoginForm />
            </div>

            <div className="lg:col-start-1 lg:row-start-2">
              <ul className="grid max-w-xl gap-x-6 gap-y-3 sm:grid-cols-2">
                {HIGHLIGHTS.map((t) => (
                  <li key={t} className="flex items-center gap-2.5 text-[15px] text-ios-label">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/[0.12] text-emerald-600 dark:text-emerald-400">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
              <a
                href="#como-funciona"
                className="mt-8 inline-flex h-11 items-center gap-2 rounded-full border border-ios-separator bg-ios-card/70 px-5 text-[15px] font-semibold text-ios-label transition-colors hover:bg-ios-card"
              >
                ¿Cómo funciona?
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </section>

        <LandingBeforeAfter />
        <LandingAudiences />

        {/* ── Cómo funciona ── */}
        <section id="como-funciona" className="scroll-mt-20 border-t border-ios-separator bg-ios-card">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
            <div className="max-w-2xl">
              <p className="text-[14px] font-semibold text-brand-600">Cómo funciona</p>
              <h2 className="mt-2 text-[30px] font-bold leading-tight tracking-[-0.02em] text-ios-label sm:text-[38px]">
                Pagar tu cuota en tres pasos
              </h2>
            </div>
            <ol className="mt-10 grid gap-4 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="rounded-2xl border border-ios-separator bg-ios-bg/60 p-6">
                  <span className="bg-gradient-to-br from-indigo-500 to-violet-400 bg-clip-text text-[44px] font-bold leading-none tracking-tight text-transparent tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-4 text-[17px] font-semibold text-ios-label">{s.title}</h3>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-ios-secondary">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <LandingFaq />

        {/* ── Cierre ── */}
        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:pb-24">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-700 px-6 py-12 text-center sm:px-12 sm:py-14">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-24 left-1/2 h-[260px] w-[520px] -translate-x-1/2 rounded-full bg-white/15 blur-[90px]"
            />
            <h2 className="relative text-[26px] font-bold tracking-tight text-white sm:text-[34px]">
              ¿Ya tienes tu usuario?
            </h2>
            <p className="relative mt-2 text-[16px] text-white/80">Entra y revisa cómo está tu cuenta.</p>
            <button
              type="button"
              onClick={goToLogin}
              className="relative mt-7 inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-[15px] font-semibold text-indigo-700 transition hover:bg-white/90 active:scale-[0.98]"
            >
              Iniciar sesión
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      </main>

      {/* ── Pie ── */}
      <footer className="border-t border-ios-separator">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 sm:flex-row sm:px-6">
          <Logo />
          <p className="text-center text-[13px] text-ios-secondary sm:text-right">
            © {year} VestaApp · Gestión y pagos de la asociación
          </p>
        </div>
      </footer>
    </div>
  );
}
