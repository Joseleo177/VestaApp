import { UserRole } from "@/types/domain";
import { Avatar, AvatarTone } from "@/components/ui/Avatar";
import { Money } from "@/components/ui/Money";
import { StatusMark } from "@/components/ui/StatusMark";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Client, ClientUnit, DEBT_EPSILON, isActiveClient } from "../types";

// Piezas que la tabla de escritorio, las tarjetas de móvil y la ficha comparten:
// si cada vista pintara su propio saldo, tarde o temprano dirían cosas distintas.

const ROLE_TONE: Record<UserRole, AvatarTone> = {
  [UserRole.OWNER]: "brand",
  [UserRole.AUTHORIZED]: "violet",
  [UserRole.ADMIN]: "neutral",
};

export function ClientAvatar({ client, size }: { client: Client; size?: "sm" | "lg" }) {
  return (
    <Avatar
      name={client.fullName}
      size={size}
      tone={isActiveClient(client) ? ROLE_TONE[client.role] : "neutral"}
    />
  );
}

/** Lo que debe el cliente, o en qué estado está si no debe nada. */
export function ClientBalance({ client }: { client: Client }) {
  if (client.debt > DEBT_EPSILON) {
    return (
      <div className="leading-tight">
        <Money
          value={formatCurrency(client.debt)}
          className="text-[14px] font-semibold text-red-600 dark:text-red-400"
        />
        <p className="mt-0.5 text-[12px] text-ios-secondary">
          por cobrar
          {client.unitsWithDebt > 1 && ` · ${client.unitsWithDebt} deptos.`}
        </p>
      </div>
    );
  }
  if (client.units.length === 0) {
    // Un administrador no tiene unidades por definición; a un copropietario sin
    // departamento le falta un dato, y conviene que se note.
    return client.role === UserRole.ADMIN ? (
      <span className="text-[13px] text-ios-tertiary">—</span>
    ) : (
      <StatusMark label="Sin departamento" tone="warning" />
    );
  }
  // Al día es lo normal: gris con un visto, sin pastilla verde.
  return <StatusMark label="Al día" tone="success" quiet="check" />;
}

/** Códigos de departamento; un punto rojo marca los que deben. */
export function UnitChips({ units, max = 3 }: { units: ClientUnit[]; max?: number }) {
  if (units.length === 0) return <span className="text-[13px] text-ios-tertiary">—</span>;
  const shown = units.slice(0, max);
  const rest = units.length - shown.length;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map(({ property }) => {
        const owes = Number(property.balance) > DEBT_EPSILON;
        return (
          <span
            key={property.id}
            title={owes ? `${property.code}: debe ${formatCurrency(property.balance)}` : property.code}
            className="inline-flex h-6 items-center gap-1.5 rounded-md bg-ios-fill px-2 text-[12px] font-medium tabular-nums text-ios-label"
          >
            {owes && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
            {property.code}
          </span>
        );
      })}
      {rest > 0 && (
        <span
          className="text-[12px] font-medium text-ios-secondary"
          title={units.slice(max).map((u) => u.property.code).join(", ")}
        >
          +{rest}
        </span>
      )}
    </div>
  );
}

/** "Inactivo" junto al nombre: el único estado de acceso que pide atención. */
export function InactiveTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-md bg-ios-fill px-1.5 text-[11px] font-semibold text-ios-secondary",
        className
      )}
    >
      Inactivo
    </span>
  );
}
