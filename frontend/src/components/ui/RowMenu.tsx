import { useRef, useState } from "react";
import { LucideIcon, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/cn";
import { FilterPopover } from "./FilterPopover";
import { RowIcon } from "./Ledger";

export interface RowMenuItem {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  tone?: "danger";
  disabled?: boolean;
  /** Por qué está deshabilitada, o qué hace: se lee al pasar el cursor. */
  hint?: string;
}

/**
 * Menú "⋯" de una fila: las acciones secundarias. Una fila con seis botones a la
 * vista no deja ver cuál importa; aquí queda a la vista solo la principal.
 */
export function RowMenu({ items, title = "Más acciones" }: { items: RowMenuItem[]; title?: string }) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;

  return (
    <>
      <span ref={anchorRef} className="inline-flex">
        <RowIcon icon={MoreHorizontal} title={title} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)} />
      </span>
      <FilterPopover open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} width={232}>
        <div role="menu" className="p-1.5">
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              disabled={it.disabled}
              title={it.hint}
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[14px] transition-colors disabled:pointer-events-none disabled:opacity-40",
                it.tone === "danger"
                  ? "text-red-600 hover:bg-red-500/10 dark:text-red-400"
                  : "text-ios-label hover:bg-ios-fill"
              )}
            >
              <it.icon className={cn("h-4 w-4 shrink-0", it.tone === "danger" ? "" : "text-ios-secondary")} />
              {it.label}
            </button>
          ))}
        </div>
      </FilterPopover>
    </>
  );
}
