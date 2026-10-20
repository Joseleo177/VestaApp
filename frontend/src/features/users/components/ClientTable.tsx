import { Pencil, Power, PowerOff } from "lucide-react";
import {
  EmptyBlock,
  LedgerEmpty,
  LedgerSkeleton,
  ledgerRow,
  ROW_TONE,
  RowIcon,
  stopRow,
} from "@/components/ui/Ledger";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDocumentId } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Client, DEBT_EPSILON, isActiveClient, ROLE_LABELS } from "../types";
import { ClientAvatar, ClientBalance, InactiveTag, UnitChips } from "./ClientCells";

interface ClientTableProps {
  clients: Client[];
  loading: boolean;
  /** Hay búsqueda o filtros puestos: el vacío ofrece quitarlos. */
  hasQuery: boolean;
  onClear: () => void;
  onOpen: (c: Client) => void;
  onEdit: (c: Client) => void;
  onToggle: (c: Client) => void;
  togglingId: string | null;
}

const COLS = 6;

function Actions({
  client,
  onEdit,
  onToggle,
  busy,
}: {
  client: Client;
  onEdit: (c: Client) => void;
  onToggle: (c: Client) => void;
  busy: boolean;
}) {
  const active = isActiveClient(client);
  return (
    <div className="flex justify-end gap-0.5">
      <RowIcon icon={Pencil} title="Editar" onClick={() => onEdit(client)} />
      <RowIcon
        icon={active ? PowerOff : Power}
        title={active ? "Desactivar acceso" : "Activar acceso"}
        tone={active ? "danger" : "success"}
        busy={busy}
        onClick={() => onToggle(client)}
      />
    </div>
  );
}

/**
 * Listado de clientes. La tabla necesita ~900px; por debajo de `lg` las mismas
 * filas se pintan como tarjetas, en vez de esconder el saldo y las acciones tras
 * un scroll horizontal que nadie descubre. La fila entera abre la ficha.
 */
export function ClientTable({
  clients,
  loading,
  hasQuery,
  onClear,
  onOpen,
  onEdit,
  onToggle,
  togglingId,
}: ClientTableProps) {
  const empty = hasQuery
    ? { title: "Ningún cliente coincide", hint: "Prueba con otro nombre, cédula o código de departamento.", onClear }
    : { title: "Sin clientes", hint: "Los copropietarios y autorizados que registres aparecerán aquí." };

  return (
    <>
      {/* ── Escritorio: tabla ── */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="table-ledger min-w-[880px]">
          <thead>
            <tr>
              <th className="pl-5">Cliente</th>
              <th>Documento</th>
              <th>Teléfono</th>
              <th>Departamentos</th>
              <th>Saldo</th>
              <th className="w-px pr-5">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <LedgerSkeleton cols={COLS} />
            ) : clients.length === 0 ? (
              <LedgerEmpty cols={COLS} {...empty} />
            ) : (
              clients.map((c) => {
                const active = isActiveClient(c);
                return (
                  <tr
                    key={c.id}
                    {...ledgerRow(() => onOpen(c), c.debt > DEBT_EPSILON ? ROW_TONE.danger : undefined)}
                  >
                    <td className="w-[32%] max-w-0 pl-5">
                      <div className="flex min-w-0 items-center gap-3">
                        <ClientAvatar client={c} />
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className={cn(
                                "truncate font-semibold",
                                active ? "text-ios-label" : "text-ios-secondary"
                              )}
                            >
                              {c.fullName}
                            </span>
                            {!active && <InactiveTag />}
                          </div>
                          <p className="truncate text-[12px] text-ios-secondary">
                            {[ROLE_LABELS[c.role], c.email].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap tabular-nums text-ios-secondary">
                      {formatDocumentId(c.cedulaTipo, c.cedula)}
                    </td>
                    <td className="whitespace-nowrap tabular-nums text-ios-secondary">
                      {c.phone || <span className="text-ios-tertiary">—</span>}
                    </td>
                    <td>
                      <UnitChips units={c.units} />
                    </td>
                    <td>
                      <ClientBalance client={c} />
                    </td>
                    <td className="cursor-default whitespace-nowrap pr-5" onClick={stopRow}>
                      <Actions
                        client={c}
                        onEdit={onEdit}
                        onToggle={onToggle}
                        busy={togglingId === c.id}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Móvil y tablet: tarjetas ── */}
      <div className="space-y-2 p-3 lg:hidden">
        {loading ? (
          Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-ios-separator p-3">
              <Skeleton className="h-9 w-9" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-2.5 w-1/3" />
              </div>
            </div>
          ))
        ) : clients.length === 0 ? (
          <EmptyBlock {...empty} />
        ) : (
          clients.map((c) => {
            const active = isActiveClient(c);
            const owes = c.debt > DEBT_EPSILON;
            return (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpen(c)}
                onKeyDown={(e) => {
                  if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    onOpen(c);
                  }
                }}
                className={cn(
                  "rounded-xl border border-ios-separator p-3 transition-colors active:bg-ios-fill",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60",
                  owes && "shadow-[inset_3px_0_0_#ef4444]"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <ClientAvatar client={c} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span
                          className={cn(
                            "break-words text-[15px] font-semibold",
                            active ? "text-ios-label" : "text-ios-secondary"
                          )}
                        >
                          {c.fullName}
                        </span>
                        {!active && <InactiveTag />}
                      </div>
                      {/* La cédula es con lo que se identifica al vecino en la
                          conserjería; en móvil no puede quedar escondida. */}
                      <p className="mt-0.5 text-[12px] tabular-nums text-ios-secondary">
                        {[ROLE_LABELS[c.role], formatDocumentId(c.cedulaTipo, c.cedula)].join(" · ")}
                      </p>
                    </div>
                  </div>
                  {/* La tarjeta entera abre la ficha; editar y desactivar no pueden
                      dispararla de paso. */}
                  <div className="shrink-0" onClick={stopRow} onKeyDown={stopRow}>
                    <Actions client={c} onEdit={onEdit} onToggle={onToggle} busy={togglingId === c.id} />
                  </div>
                </div>

                <div className="mt-2.5 flex items-end justify-between gap-3 border-t border-ios-separator pt-2.5">
                  <UnitChips units={c.units} max={4} />
                  <div className="shrink-0 text-right">
                    <ClientBalance client={c} />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
