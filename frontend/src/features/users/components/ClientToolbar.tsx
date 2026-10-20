import { useRef, useState } from "react";
import { AlertCircle, SlidersHorizontal } from "lucide-react";
import { UserRole } from "@/types/domain";
import { FilterChip, FilterPopover, FilterSection } from "@/components/ui/FilterPopover";
import { Money } from "@/components/ui/Money";
import { SearchField } from "@/components/ui/SearchField";
import { Segmented } from "@/components/ui/Segmented";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ClientSort, RoleFilter, StatusFilter } from "../types";

interface ClientToolbarProps {
  search: string;
  onSearch: (v: string) => void;
  role: RoleFilter;
  onRole: (v: RoleFilter) => void;
  roleCounts: Record<RoleFilter, number>;
  status: StatusFilter;
  onStatus: (v: StatusFilter) => void;
  onlyDebtors: boolean;
  onOnlyDebtors: (v: boolean) => void;
  withoutUnits: boolean;
  onWithoutUnits: (v: boolean) => void;
  sort: ClientSort;
  onSort: (v: ClientSort) => void;
  filtersCount: number;
  onClearFilters: () => void;
  summary: { count: number; debtors: number; debt: number };
  loading: boolean;
}

/**
 * Cabecera del listado. Lo de todos los días a la vista (rol y buscador); lo
 * ocasional, en el panel de filtros, con un contador para que no se olvide que
 * hay algo puesto.
 */
export function ClientToolbar(props: ClientToolbarProps) {
  const { summary, filtersCount } = props;
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const active = filtersCount > 0;

  return (
    <div className="border-b border-ios-separator">
      <div className="flex flex-col gap-3 px-4 pt-4 lg:flex-row lg:items-center">
        <div className="no-scrollbar -mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          <Segmented
            aria-label="Tipo de cliente"
            value={props.role}
            onChange={props.onRole}
            options={[
              { key: "ALL", label: "Todos", count: props.roleCounts.ALL },
              { key: UserRole.OWNER, label: "Copropietarios", count: props.roleCounts[UserRole.OWNER] },
              { key: UserRole.AUTHORIZED, label: "Autorizados", count: props.roleCounts[UserRole.AUTHORIZED] },
              { key: UserRole.ADMIN, label: "Administradores", count: props.roleCounts[UserRole.ADMIN] },
            ]}
          />
        </div>

        <div className="flex items-center gap-2 lg:ml-auto">
          <SearchField
            value={props.search}
            onChange={props.onSearch}
            placeholder="Nombre, cédula, teléfono o depto."
            className="min-w-0 flex-1 lg:w-80 lg:flex-none"
            hotkey
          />
          <button
            ref={anchorRef}
            type="button"
            onClick={() => setOpen((p) => !p)}
            aria-expanded={open}
            className={cn(
              "flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3 text-[13px] font-semibold transition-colors",
              active
                ? "border-brand-500/40 bg-brand-50 text-brand-700"
                : "border-ios-separator text-ios-secondary hover:bg-ios-fill hover:text-ios-label"
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Filtros</span>
            {active && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] text-white">
                {filtersCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Resumen de lo que se está viendo: cuántos son y cuánto deben. */}
      <p className="min-h-[36px] px-4 py-2.5 text-[12px] text-ios-secondary">
        {props.loading ? (
          "Cargando…"
        ) : (
          <>
            <span className="font-semibold text-ios-label">{summary.count}</span>{" "}
            {summary.count === 1 ? "cliente" : "clientes"}
            {summary.debtors > 0 ? (
              <>
                {" · "}
                <span className="font-semibold text-red-600 dark:text-red-400">{summary.debtors}</span>{" "}
                con deuda {" · "}
                <Money value={formatCurrency(summary.debt)} className="font-semibold text-ios-label" /> por
                cobrar
              </>
            ) : (
              summary.count > 0 && " · todos al día"
            )}
          </>
        )}
      </p>

      <FilterPopover open={open} onClose={() => setOpen(false)} anchorRef={anchorRef}>
        <FilterSection title="Saldo">
          <div className="grid">
            <FilterChip active={props.onlyDebtors} onClick={() => props.onOnlyDebtors(!props.onlyDebtors)}>
              <AlertCircle className="h-3.5 w-3.5" />
              Solo con deuda
            </FilterChip>
          </div>
        </FilterSection>

        <FilterSection title="Acceso al sistema">
          <div className="grid grid-cols-2 gap-1.5">
            {(
              [
                ["ACTIVE", "Activos"],
                ["INACTIVE", "Inactivos"],
              ] as const
            ).map(([key, label]) => (
              <FilterChip
                key={key}
                active={props.status === key}
                onClick={() => props.onStatus(props.status === key ? "ALL" : key)}
              >
                {label}
              </FilterChip>
            ))}
          </div>
        </FilterSection>

        <FilterSection title="Departamentos">
          <div className="grid">
            <FilterChip active={props.withoutUnits} onClick={() => props.onWithoutUnits(!props.withoutUnits)}>
              Sin departamento asignado
            </FilterChip>
          </div>
        </FilterSection>

        <FilterSection title="Ordenar por">
          <Segmented
            className="w-full [&>button]:flex-1 [&>button]:justify-center"
            value={props.sort}
            onChange={props.onSort}
            options={[
              { key: "NAME", label: "Nombre" },
              { key: "DEBT", label: "Mayor deuda" },
            ]}
          />
        </FilterSection>

        {active && (
          <div className="px-4 py-2">
            <button
              type="button"
              onClick={props.onClearFilters}
              className="h-8 w-full rounded-lg text-[13px] font-medium text-ios-secondary transition-colors hover:bg-ios-fill hover:text-ios-label"
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </FilterPopover>
    </div>
  );
}
