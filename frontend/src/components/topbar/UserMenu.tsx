import { useRef, useState } from "react";
import { ChevronDown, LogOut, Moon, Sun, UserRound } from "lucide-react";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { ProfileModal } from "@/features/auth/components/ProfileModal";
import { ROLE_LABELS } from "@/features/users/types";
import { Avatar } from "@/components/ui/Avatar";
import { FilterPopover } from "@/components/ui/FilterPopover";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/cn";

const item =
  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] text-ios-label transition-colors hover:bg-ios-fill";

/**
 * Menú de la cuenta. Perfil, tema y salir vivían como tres iconos sueltos a la
 * derecha de la barra; agrupados bajo el avatar la barra respira, y "salir" deja
 * de estar a un clic accidental del cambio de tema.
 */
export function UserMenu() {
  const { user, logout, updateUser } = useAuth();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  if (!user) return null;

  const role = ROLE_LABELS[user.role] ?? "Copropietario";
  const dark = theme === "dark";

  return (
    <>
      <button
        ref={anchorRef}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2.5 rounded-xl py-1 pl-1 pr-2 transition-colors hover:bg-ios-fill"
      >
        <Avatar name={user.fullName} className="!h-8 !w-8" />
        <span className="hidden min-w-0 text-left leading-tight md:block">
          <span className="block max-w-[200px] truncate text-[13px] font-semibold text-ios-label">{user.fullName}</span>
          <span className="block text-[11px] font-medium text-ios-secondary">{role}</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 text-ios-secondary transition-transform", open && "rotate-180")} />
      </button>

      <FilterPopover open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} width={272}>
        <div role="menu" className="p-2">
          <div className="flex items-center gap-3 px-3 pb-3 pt-2">
            <Avatar name={user.fullName} />
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-ios-label">{user.fullName}</p>
              <p className="truncate text-[12px] text-ios-secondary">{user.email || role}</p>
            </div>
          </div>
          <div className="my-1 h-px bg-ios-separator" />
          <button
            role="menuitem"
            className={item}
            onClick={() => {
              setOpen(false);
              setProfileOpen(true);
            }}
          >
            <UserRound className="h-[18px] w-[18px] text-ios-secondary" />
            Mi perfil
          </button>
          <button role="menuitemcheckbox" aria-checked={dark} className={item} onClick={toggle}>
            {dark ? (
              <Sun className="h-[18px] w-[18px] text-ios-secondary" />
            ) : (
              <Moon className="h-[18px] w-[18px] text-ios-secondary" />
            )}
            <span className="flex-1">Modo noche</span>
            {/* Interruptor: dice el estado actual, no la acción. */}
            <span
              aria-hidden
              className={cn(
                "relative h-[22px] w-[38px] rounded-full transition-colors",
                dark ? "bg-brand-600" : "bg-ios-separator"
              )}
            >
              <span
                className={cn(
                  "absolute top-[3px] h-4 w-4 rounded-full bg-white shadow transition-[left]",
                  dark ? "left-[19px]" : "left-[3px]"
                )}
              />
            </span>
          </button>
          <div className="my-1 h-px bg-ios-separator" />
          <button
            role="menuitem"
            className={cn(item, "text-red-600 hover:bg-red-500/10 dark:text-red-400")}
            onClick={logout}
          >
            <LogOut className="h-[18px] w-[18px]" />
            Cerrar sesión
          </button>
        </div>
      </FilterPopover>

      <ProfileModal open={profileOpen} user={user} onClose={() => setProfileOpen(false)} onSaved={updateUser} />
    </>
  );
}
