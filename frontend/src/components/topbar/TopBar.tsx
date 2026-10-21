import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Flame } from "lucide-react";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { api } from "@/services/api";
import { AppDrawer } from "./AppDrawer";
import { ExchangeRatePill } from "./ExchangeRatePill";
import { UserMenu } from "./UserMenu";
import { appForPath } from "./apps";

// Palabras que en un nombre propio van en minúscula ("Asociación Civil de Vivienda").
const SMALL = new Set(["de", "del", "la", "las", "los", "el", "y", "e", "en"]);

/** El nombre suele cargarse en mayúsculas; en la barra se lee mejor en caja de título. */
const titleCase = (s: string) =>
  s
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i > 0 && SMALL.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");

/**
 * Barra superior: dónde estoy (marca › asociación › sección), la tasa del día al
 * centro y la cuenta a la derecha. Translúcida con blur, como la de iOS.
 */
export function TopBar() {
  const { isAdmin } = useAuth();
  const { pathname } = useLocation();
  const [orgName, setOrgName] = useState("");
  const section = isAdmin ? appForPath(pathname) : undefined;

  useEffect(() => {
    api
      .get<{ condo_name: string }>("/settings")
      .then(({ data }) => data.condo_name && setOrgName(titleCase(data.condo_name.trim())))
      .catch(() => {});
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-ios-separator/80 bg-ios-card/80 text-ios-label backdrop-blur-xl backdrop-saturate-150">
      <div className="flex h-14 items-center gap-3 px-3 sm:px-4">
        {/* Izquierda: lanzador (admin) + dónde estoy */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {isAdmin && <AppDrawer />}
          <Link to={isAdmin ? "/admin" : "/"} className="flex shrink-0 items-center gap-2 rounded-lg pr-1">
            <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
              <Flame className="h-[18px] w-[18px]" />
            </span>
            <span className="hidden text-[15px] font-bold tracking-tight sm:inline">VestaApp</span>
          </Link>

          {orgName && (
            <>
              <span className="hidden h-5 w-px shrink-0 bg-ios-separator md:block" aria-hidden />
              <span
                className="hidden min-w-0 truncate text-[13px] font-medium text-ios-secondary md:block"
                title={orgName}
              >
                {orgName}
              </span>
            </>
          )}

          {section && (
            <span className="hidden shrink-0 items-center gap-1.5 lg:flex">
              <ChevronRight className="h-4 w-4 text-ios-tertiary" aria-hidden />
              <span className="flex items-center gap-1.5 rounded-lg bg-ios-fill/70 px-2 py-1 text-[13px] font-semibold text-ios-label">
                <section.icon className="h-4 w-4 text-brand-600" />
                {section.label}
              </span>
            </span>
          )}
        </div>

        {/* Centro: fecha + tasas */}
        <ExchangeRatePill className="hidden shrink-0 md:flex" />

        {/* Derecha: la cuenta */}
        <div className="flex flex-1 justify-end">
          <UserMenu />
        </div>
      </div>

      {/* En móvil la tasa va debajo: al centro no cabe. */}
      <div className="flex justify-center border-t border-ios-separator/70 px-3 py-1.5 md:hidden">
        <ExchangeRatePill />
      </div>
    </header>
  );
}
