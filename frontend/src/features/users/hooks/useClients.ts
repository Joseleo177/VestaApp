import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { User } from "@/types/domain";
import { PropertyWithBalance } from "@/features/admin-panel/types";
import { unitService } from "@/features/units/services/unit.service";
import { userService } from "../services/user.service";
import { Client, ClientUnit, DEBT_EPSILON, UnitRelation } from "../types";

const byCode = (a: ClientUnit, b: ClientUnit) =>
  a.property.code.localeCompare(b.property.code, "es", { numeric: true });

/**
 * Cruza usuarios con departamentos. El backend no tiene un "cliente con su
 * deuda": `/properties` ya trae titular, autorizado y saldo de cada unidad, así
 * que la relación se arma aquí sin pedir nada nuevo.
 */
export function buildClients(users: User[], properties: PropertyWithBalance[]): Client[] {
  const links = new Map<string, Map<string, ClientUnit>>();

  const link = (userId: string | undefined, property: PropertyWithBalance, relation: UnitRelation) => {
    if (!userId) return;
    const units = links.get(userId) ?? new Map<string, ClientUnit>();
    links.set(userId, units);
    const prev = units.get(property.id);
    units.set(property.id, {
      property,
      // El titular también puede figurar como autorizado de su propia unidad.
      relation: prev && prev.relation !== relation ? "BOTH" : relation,
    });
  };

  for (const p of properties) {
    link(p.owner?.id, p, "OWNER");
    link(p.authorized?.id, p, "AUTHORIZED");
  }

  return users.map((u) => {
    const units = [...(links.get(u.id)?.values() ?? [])].sort(byCode);
    const owing = units.filter((x) => Number(x.property.balance) > DEBT_EPSILON);
    return {
      ...u,
      units,
      debt: owing.reduce((sum, x) => sum + Number(x.property.balance), 0),
      unitsWithDebt: owing.length,
    };
  });
}

interface Result {
  clients: Client[];
  loading: boolean;
  /** Recarga sin volver al esqueleto: tras guardar, la tabla no parpadea. */
  refetch: () => Promise<void>;
}

/** Clientes con sus departamentos y deuda. El estado vive local al feature. */
export function useClients(): Result {
  const [users, setUsers] = useState<User[]>([]);
  const [properties, setProperties] = useState<PropertyWithBalance[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [userList, propertyList] = await Promise.all([userService.list(), unitService.list()]);
      setUsers(userList);
      setProperties(propertyList);
    } catch {
      toast.error("No se pudieron cargar los clientes");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  const clients = useMemo(() => buildClients(users, properties), [users, properties]);
  const refetch = useCallback(() => fetch(true), [fetch]);

  return { clients, loading, refetch };
}
