import { ReactNode, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";

interface PageProps {
  /** Módulo al que pertenece la pantalla: se lee como miga sobre el título. */
  module: string;
  title: ReactNode;
  /** Botones de la derecha. En móvil se desplazan en horizontal. */
  actions?: ReactNode;
  /** Barra bajo el encabezado (buscador, filtros, pestañas). */
  subheader?: ReactNode;
  /** Vuelta a la pantalla anterior. */
  onBack?: () => void;
  backLabel?: string;
  children: ReactNode;
}

/**
 * Esqueleto común de una pantalla: miga + título a la izquierda y acciones a la
 * derecha. "Volver" va pegado al título y no entre las acciones: no es una acción
 * sobre lo que se ve sino salir de ello, y es donde se lo busca.
 */
export function Page({
  module,
  title,
  actions,
  subheader,
  onBack,
  backLabel = "Volver",
  children,
}: PageProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState(false);

  // Con la barra de acciones más ancha que la pantalla, el último botón quedaba
  // cortado sin pista de que hubiera más. El desvanecido del borde derecho lo
  // delata, y solo se aplica cuando de verdad queda contenido por ver. Se recalcula
  // en cada render: los botones cambian según el contexto sin cambiar el tamaño
  // del contenedor, que es lo único que ve el observer.
  useLayoutEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const check = () => {
      const overflow = el.scrollWidth - el.clientWidth > 1;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
      setFade((prev) => (prev === (overflow && !atEnd) ? prev : overflow && !atEnd));
    };
    check();
    el.addEventListener("scroll", check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", check);
      ro.disconnect();
    };
  });

  const mask = "linear-gradient(to right, #000 calc(100% - 20px), transparent)";

  return (
    <div className="space-y-4">
      <header className="flex min-w-0 items-center gap-2 sm:gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            title={backLabel}
            aria-label={backLabel}
            className="flex h-9 shrink-0 items-center gap-1 rounded-xl pl-1.5 pr-2 text-[13px] font-medium text-ios-secondary transition-colors hover:bg-ios-fill hover:text-ios-label sm:pr-3"
          >
            <ChevronLeft className="h-5 w-5" />
            {/* En móvil solo la flecha: el texto se comería el ancho del título. */}
            <span className="hidden sm:inline">{backLabel}</span>
          </button>
        )}

        <div className="min-w-0 max-w-[65%] shrink-0">
          <p className="mb-0.5 truncate text-[12px] font-semibold leading-none text-brand-600">
            {module}
          </p>
          <h1 className="truncate text-[22px] font-bold leading-tight text-ios-label sm:text-[26px]">
            {title}
          </h1>
        </div>

        {actions && (
          <div
            ref={barRef}
            className="no-scrollbar ml-auto flex min-w-0 shrink items-center gap-2 overflow-x-auto py-0.5"
            style={fade ? { WebkitMaskImage: mask, maskImage: mask } : undefined}
          >
            {actions}
          </div>
        )}
      </header>

      {subheader}
      {children}
    </div>
  );
}
