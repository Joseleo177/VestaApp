import { Flame, LogOut } from "lucide-react";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { UserRole } from "@/types/domain";
import { useState } from "react";
import { AppDrawer } from "./AppDrawer";
import { ExchangeRatePill } from "./ExchangeRatePill";
import { ProfileModal } from "@/features/auth/components/ProfileModal";

/** Barra superior oscura: cajón de apps · marca · fecha/tasa · usuario. */
export function TopBar() {
  const { user, logout, isAdmin, updateUser } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const roleLabel = user?.role === UserRole.ADMIN ? "Administrador" : "Copropietario";

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-slate-900 text-white">
      <div className="flex h-14 items-center justify-between gap-4 px-4">
        {/* Izquierda: cajón de apps (solo admin) + marca */}
        <div className="flex items-center gap-3">
          {isAdmin && <AppDrawer />}
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600">
              <Flame className="h-4 w-4" />
            </span>
            <span className="text-sm font-bold tracking-tight">VestaApp</span>
            <span className="hidden rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-300 sm:inline">
              Condominio
            </span>
          </div>
        </div>

        {/* Centro: fecha + tasa BCV */}
        <div className="hidden md:block">
          <ExchangeRatePill />
        </div>

        {/* Derecha: usuario + logout */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsProfileOpen(true)}
            className="flex items-center gap-2.5 rounded-lg p-1 transition-colors hover:bg-white/5"
            aria-label="Ver perfil"
            title="Ver perfil"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold">
              {user?.fullName?.charAt(0).toUpperCase() ?? "U"}
            </span>
            <div className="hidden text-right leading-tight sm:block text-left">
              <p className="text-sm font-medium">{user?.fullName}</p>
              <p className="text-[11px] font-medium text-emerald-400">{roleLabel}</p>
            </div>
          </button>
          <button
            onClick={logout}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-rose-400"
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
          >
            <LogOut className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>

      {/* Tasa visible también en móvil (debajo de la barra) */}
      <div className="flex justify-center border-t border-white/5 px-4 py-1.5 md:hidden">
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
