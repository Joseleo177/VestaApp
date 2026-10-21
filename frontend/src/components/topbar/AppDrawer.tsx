import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { LayoutGrid, Search, X } from "lucide-react";
import { paymentService } from "@/features/payments/services/payment.service";
import { normalize } from "@/lib/search";
import { cn } from "@/lib/cn";
import { ADMIN_GROUPS, AppItem, appForPath } from "./apps";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

// Solo con teclado físico se enfoca el buscador: en un teléfono abriría el
// teclado en pantalla sin que nadie lo pidiera.
const hasPhysicalKeyboard = () => window.matchMedia("(min-width: 1024px)").matches;

/**
 * Lanzador de aplicaciones del administrador. Se abre con el botón o con
 * Ctrl+K (⌘K en Mac) desde cualquier pantalla; se escribe para filtrar y Enter
 * abre la primera coincidencia.
 */
export function AppDrawer() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [pendingCount, setPendingCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const current = appForPath(pathname);

  // Atajo global.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    setQ("");
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onEsc);
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => hasPhysicalKeyboard() && inputRef.current?.focus());
    // Cuántos pagos esperan: se ve en la tarjeta de Pagos sin tener que entrar.
    paymentService
      .listPending()
      .then((list) => setPendingCount(list.length))
      .catch(() => {});
    return () => {
      document.removeEventListener("keydown", onEsc);
      document.body.style.overflow = "";
      cancelAnimationFrame(frame);
    };
  }, [open]);

  const needle = normalize(q.trim());
  const groups = useMemo(
    () =>
      ADMIN_GROUPS.map((g) => ({
        ...g,
        apps: g.apps.filter(
          (a) => !needle || normalize(`${a.label} ${a.hint} ${a.keywords ?? ""}`).includes(needle)
        ),
      })).filter((g) => g.apps.length > 0),
    [needle]
  );
  const first = groups[0]?.apps[0];

  const go = (app: AppItem) => {
    setOpen(false);
    navigate(app.to);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-xl text-ios-secondary transition-colors hover:bg-ios-fill hover:text-ios-label"
        aria-label="Aplicaciones"
        title={`Aplicaciones (${isMac ? "⌘" : "Ctrl"} K)`}
      >
        <LayoutGrid className="h-5 w-5" />
      </button>

      {/* Portal al body: la barra superior tiene backdrop-filter y se convertiría
          en el bloque contenedor de este overlay `fixed`, descentrándolo. */}
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[10vh] backdrop-blur-[3px]"
            onClick={() => setOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Aplicaciones"
              onClick={(e) => e.stopPropagation()}
              className="popover-in relative w-full max-w-3xl overflow-hidden rounded-3xl border border-black/[0.06] bg-ios-card shadow-[0_24px_64px_-12px_rgb(0_0_0/0.35)] dark:border-white/10"
            >
              {/* Buscador */}
              <div className="flex h-14 items-center gap-3 border-b border-ios-separator px-5">
                <Search className="h-4 w-4 shrink-0 text-ios-secondary" />
                <input
                  ref={inputRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && first && go(first)}
                  placeholder="Ir a una aplicación…"
                  className="min-w-0 flex-1 bg-transparent text-[15px] text-ios-label outline-none placeholder:text-ios-secondary"
                  autoComplete="off"
                  spellCheck={false}
                />
                <kbd className="hidden h-6 items-center rounded-md border border-ios-separator px-1.5 text-[11px] font-medium text-ios-secondary sm:inline-flex">
                  Esc
                </kbd>
                <button onClick={() => setOpen(false)} className="row-icon shrink-0" aria-label="Cerrar">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="max-h-[70vh] space-y-4 overflow-y-auto p-3 sm:p-4">
                {groups.length === 0 && (
                  <p className="py-10 text-center text-[13px] text-ios-secondary">
                    Ninguna aplicación coincide con «{q}»
                  </p>
                )}
                {groups.map((g) => (
                  <section key={g.label}>
                    <h3 className="mb-1.5 px-2 text-[12px] font-medium text-ios-secondary">{g.label}</h3>
                    <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 md:grid-cols-3">
                      {g.apps.map((app) => {
                        const isCurrent = current?.to === app.to;
                        const isFirst = !!needle && first?.to === app.to;
                        const badge = app.to === "/admin/pagos" ? pendingCount : 0;
                        return (
                          <button
                            key={app.to}
                            onClick={() => go(app)}
                            className={cn(
                              "group flex items-center gap-3 rounded-2xl p-2.5 text-left transition-colors active:scale-[0.99]",
                              isCurrent || isFirst
                                ? "bg-brand-50/70 ring-1 ring-inset ring-brand-500/30"
                                : "hover:bg-ios-fill/70"
                            )}
                          >
                            <span
                              className={cn(
                                "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105",
                                app.tone
                              )}
                            >
                              <app.icon className="h-5 w-5" />
                              {badge > 0 && (
                                <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-ios-card">
                                  {badge}
                                </span>
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2">
                                <span className="truncate text-[14px] font-semibold text-ios-label">{app.label}</span>
                                {isCurrent && (
                                  <span className="shrink-0 text-[11px] font-medium text-brand-600">Actual</span>
                                )}
                              </span>
                              <span className="block truncate text-[12px] text-ios-secondary">
                                {badge > 0 ? `${badge} por validar` : app.hint}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>

              <div className="hidden items-center justify-between border-t border-ios-separator px-5 py-2.5 text-[12px] text-ios-secondary sm:flex">
                <span>Escribe para buscar · Enter para abrir</span>
                <span>
                  Ábrelo desde cualquier pantalla con{" "}
                  <kbd className="rounded-md border border-ios-separator px-1.5 py-0.5 font-medium">
                    {isMac ? "⌘" : "Ctrl"} K
                  </kbd>
                </span>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
