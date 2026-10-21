import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronRight, Mail, MessageCircle, Phone } from "lucide-react";
import { UserRole } from "@/types/domain";
import { PropertyWithBalance } from "@/features/admin-panel/types";
import { Card } from "@/components/ui/Card";
import { EmptyBlock } from "@/components/ui/Ledger";
import { Money } from "@/components/ui/Money";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusMark } from "@/components/ui/StatusMark";
import { formatCurrency, formatDate, formatDocumentId } from "@/lib/format";
import { whatsappUrl } from "@/lib/phone";
import { cn } from "@/lib/cn";
import {
  Client,
  DEBT_EPSILON,
  isActiveClient,
  RELATION_LABELS,
  ROLE_LABELS,
} from "../types";
import { ClientAvatar, InactiveTag } from "./ClientCells";

/** Celda de la ficha: rótulo, cifra y una línea de contexto. */
function Fact({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div
      className={cn(
        "min-w-0 border-ios-separator px-5 py-3.5",
        // 2 columnas en móvil, 4 en escritorio: los bordes siguen a la rejilla.
        "[&:nth-child(2n)]:border-l [&:nth-child(n+3)]:border-t",
        "lg:[&:not(:first-child)]:border-l lg:[&:nth-child(n+3)]:border-t-0"
      )}
    >
      <dt className="text-[12px] text-ios-secondary">{label}</dt>
      <dd className="mt-0.5 truncate text-[16px] font-semibold tabular-nums text-ios-label">{value}</dd>
      {sub && <dd className="mt-0.5 text-[12px] text-ios-secondary">{sub}</dd>}
    </div>
  );
}

function ContactLink({ href, icon: Icon, children, external }: {
  href: string;
  icon: typeof Phone;
  children: ReactNode;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      className="inline-flex items-center gap-1.5 rounded-md text-ios-secondary transition-colors hover:text-brand-600"
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </a>
  );
}

interface ClientDetailProps {
  client: Client;
  onOpenUnit: (p: PropertyWithBalance) => void;
}

export function ClientDetail({ client, onOpenUnit }: ClientDetailProps) {
  const active = isActiveClient(client);
  const owes = client.debt > DEBT_EPSILON;
  const wa = whatsappUrl(client.phone);
  const isAdmin = client.role === UserRole.ADMIN;

  const owned = client.units.filter((u) => u.relation !== "AUTHORIZED");
  const authorizedOnly = client.units.length - owned.length;
  // Solo cuenta la alícuota de lo que es suyo: de lo que administra no es dueño.
  const aliquot = owned.reduce((s, u) => s + Number(u.property.aliquotPercentage || 0), 0);

  return (
    <div className="space-y-4">
      {/* ── Ficha: quién es y cuánto debe ── */}
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-4 px-5 pb-4 pt-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <ClientAvatar client={client} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[12px] text-ios-secondary">{ROLE_LABELS[client.role]}</p>
                {!active && <InactiveTag />}
              </div>
              <h2 className="break-words text-[22px] font-bold leading-tight text-ios-label">
                {client.fullName}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]">
                <span className="tabular-nums text-ios-secondary">
                  {formatDocumentId(client.cedulaTipo, client.cedula)}
                </span>
                {client.phone && (
                  <ContactLink href={`tel:${client.phone}`} icon={Phone}>
                    <span className="tabular-nums">{client.phone}</span>
                  </ContactLink>
                )}
                {wa && (
                  <ContactLink href={wa} icon={MessageCircle} external>
                    WhatsApp
                  </ContactLink>
                )}
                {client.email && (
                  <ContactLink href={`mailto:${client.email}`} icon={Mail}>
                    <span className="max-w-[240px] truncate">{client.email}</span>
                  </ContactLink>
                )}
                {!client.phone && !client.email && (
                  <span className="text-ios-tertiary">Sin teléfono ni correo</span>
                )}
              </div>
            </div>
          </div>

          {!isAdmin && (
            <div className="shrink-0 pl-[72px] sm:pl-0 sm:text-right">
              <p className="text-[12px] text-ios-secondary">Debe</p>
              {owes ? (
                <>
                  <Money
                    value={formatCurrency(client.debt)}
                    className="block text-[28px] font-bold leading-tight tracking-tight text-red-600 dark:text-red-400"
                  />
                  <p className="mt-0.5 text-[12px] text-ios-secondary">
                    {client.unitsWithDebt === 1
                      ? "En 1 departamento"
                      : `En ${client.unitsWithDebt} departamentos`}
                  </p>
                </>
              ) : (
                <p className="flex items-center gap-1.5 text-[22px] font-semibold leading-tight text-ios-label sm:justify-end">
                  <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
                  Al día
                </p>
              )}
            </div>
          )}
        </div>

        <dl className="grid grid-cols-2 border-t border-ios-separator lg:grid-cols-4">
          <Fact
            label="Departamentos"
            value={client.units.length}
            sub={
              client.units.length === 0
                ? isAdmin
                  ? "No aplica"
                  : "Ninguno asignado"
                : [owned.length && `${owned.length} como titular`, authorizedOnly && `${authorizedOnly} autorizado`]
                    .filter(Boolean)
                    .join(" · ")
            }
          />
          <Fact
            label="Alícuota"
            value={aliquot > 0 ? `${aliquot.toLocaleString("es-VE", { maximumFractionDigits: 4 })} %` : "—"}
            sub={aliquot > 0 ? "Suma de sus unidades" : "Sin cargar"}
          />
          <Fact
            label="Acceso"
            value={active ? "Activo" : "Inactivo"}
            sub={active ? "Puede iniciar sesión" : "No puede iniciar sesión"}
          />
          <Fact
            label="Cliente desde"
            value={client.createdAt ? formatDate(client.createdAt) : "—"}
          />
        </dl>
      </Card>

      {/* ── Departamentos ── */}
      {!isAdmin && (
        <Card className="overflow-hidden">
          <div className="border-b border-ios-separator px-5 py-3.5">
            <h3 className="text-[15px] font-semibold text-ios-label">Departamentos</h3>
            {client.units.length > 0 && (
              <p className="text-[12px] text-ios-secondary">
                Toca uno para ver sus cuotas o registrar un pago
              </p>
            )}
          </div>

          {client.units.length === 0 ? (
            <EmptyBlock
              title="Sin departamentos asignados"
              hint="Asígnalo como titular o autorizado de una unidad desde Departamentos."
              action={
                <Link
                  to="/admin/departamentos"
                  className="text-[13px] font-semibold text-brand-600 hover:underline"
                >
                  Ir a Departamentos
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-ios-separator">
              {client.units.map(({ property, relation }) => {
                const balance = Number(property.balance);
                const unitOwes = balance > DEBT_EPSILON;
                return (
                  <li key={property.id}>
                    <button
                      type="button"
                      onClick={() => onOpenUnit(property)}
                      className={cn(
                        "flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-ios-fill/50",
                        "focus:outline-none focus-visible:bg-ios-fill/50",
                        unitOwes && "shadow-[inset_2px_0_0_#ef4444]"
                      )}
                    >
                      <span className="flex h-10 min-w-[3.5rem] shrink-0 items-center justify-center rounded-xl bg-ios-fill px-2 text-[14px] font-bold tabular-nums text-ios-label">
                        {property.code}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-medium text-ios-label">
                          {property.tower?.name ?? "Sin torre"}
                        </p>
                        <p className="truncate text-[12px] text-ios-secondary">
                          {RELATION_LABELS[relation]}
                          {relation === "AUTHORIZED" && property.owner && ` · titular: ${property.owner.fullName}`}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        {unitOwes ? (
                          <Money
                            value={formatCurrency(balance)}
                            className="text-[14px] font-semibold text-red-600 dark:text-red-400"
                          />
                        ) : (
                          <StatusMark label="Al día" tone="success" quiet="check" />
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-ios-tertiary" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}

/** Esqueleto de la ficha mientras se carga un enlace directo a un cliente. */
export function ClientDetailSkeleton() {
  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center gap-4">
        <Skeleton className="h-14 w-14" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <Skeleton className="h-16 w-full !rounded-xl" />
    </Card>
  );
}
