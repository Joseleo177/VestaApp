import { Flame, LogOut, Moon, Sun } from "lucide-react";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useTheme } from "@/lib/theme";
import { ROLE_LABELS } from "@/features/users/types";
import { useState, useEffect } from "react";
import { AppDrawer } from "./AppDrawer";
import { ExchangeRatePill } from "./ExchangeRatePill";
import { ProfileModal } from "@/features/auth/components/ProfileModal";
import { api } from "@/services/api";

/** Navigation bar iOS: translúcida con blur · cajón de apps · marca · tasa · usuario. */
export function TopBar() {
  const { user, logout, isAdmin, updateUser } = useAuth();
  const { theme, toggle } = useTheme();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [condoName, setCondoName] = useState<string>("");
  const roleLabel = user ? ROLE_LABELS[user.role] ?? "Copropietario" : "Copropietario";

  useEffect(() => {
    api.get<{ condo_name: string }>("/settings")
      .then(({ data }) => { if (data.condo_name) setCondoName(data.condo_name); })
      .catch(() => {});
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-ios-separator/80 bg-ios-card/80 text-ios-label backdrop-blur-xl backdrop-saturate-150">
      <div className="flex h-14 items-center justify-between gap-4 px-4">
        {/* Izquierda: cajón de apps (solo admin) + marca */}
        <div className="flex items-center gap-3">
          {isAdmin && <AppDrawer />}
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Flame className="h-4 w-4" />
            </span>
            <span className="text-[15px] font-semibold tracking-tight">VestaApp</span>
            {condoName && (
              <span className="hidden rounded-full bg-ios-fill px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ios-secondary sm:inline">
                {condoName}
              </span>
            )}
          </div>
        </div>

        {/* Centro: fecha + tasa BCV */}
        <div className="hidden md:block">
          <ExchangeRatePill />
        </div>

        {/* Derecha: tema + usuario + logout */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggle}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-ios-secondary transition-colors hover:bg-ios-fill hover:text-ios-label"
            aria-label={theme === "dark" ? "Cambiar a modo día" : "Cambiar a modo noche"}
            title={theme === "dark" ? "Modo día" : "Modo noche"}
          >
            {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          </button>
          <button
            onClick={() => setIsProfileOpen(true)}
            className="flex items-center gap-2.5 rounded-xl p-1 transition-colors hover:bg-ios-fill"
            aria-label="Ver perfil"
            title="Ver perfil"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
              {user?.fullName?.charAt(0).toUpperCase() ?? "U"}
            </span>
            <div className="hidden leading-tight sm:block text-left">
              <p className="text-[13px] font-semibold text-ios-label">{user?.fullName}</p>
              <p className="text-[11px] font-medium text-ios-secondary">{roleLabel}</p>
            </div>
          </button>
          <button
            onClick={logout}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-ios-secondary transition-colors hover:bg-ios-fill hover:text-ios-red"
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
          >
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>

      {/* Tasa visible también en móvil (debajo de la barra) */}
      <div className="flex justify-center border-t border-ios-separator/70 px-4 py-1.5 md:hidden">
        <ExchangeRatePill />
      </div>

      {user && (
        <ProfileModal
          open={isProfileOpen}
          user={user}
          onClose={() => setIsProfileOpen(false)}
          onSaved={updateUser}
        />
      )}
    </header>
  );
}
