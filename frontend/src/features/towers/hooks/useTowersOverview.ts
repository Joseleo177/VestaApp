import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Tower } from "@/types/domain";
import { PropertyWithBalance } from "@/features/admin-panel/types";
import { unitService } from "@/features/units/services/unit.service";
import { towerService } from "../services/tower.service";

const EPS = 0.005;

export interface TowerStats {
  tower: Tower;
  units: number;
  /** Departamentos sin saldo pendiente. */
  current: number;
  debtors: number;
  debt: number;
}

/**
 * Torres con lo que pasa dentro de cada una: cuántos departamentos tiene,
 * cuántos están al día y cuánto deben. Sale de `/properties`, que ya trae la
 * torre y el saldo de cada unidad.
 */
export function useTowersOverview() {
  const [towers, setTowers] = useState<Tower[]>([]);
  const [properties, setProperties] = useState<PropertyWithBalance[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [t, p] = await Promise.all([towerService.list(), unitService.list()]);
      setTowers(t);
      setProperties(p);
    } catch {
      toast.error("No se pudieron cargar las torres");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  const stats = useMemo<TowerStats[]>(
    () =>
      towers
        .map((tower) => {
          const inTower = properties.filter((p) => p.tower?.id === tower.id);
          const owing = inTower.filter((p) => Number(p.balance) > EPS);
          return {
            tower,
            units: inTower.length,
            current: inTower.length - owing.length,
            debtors: owing.length,
            debt: owing.reduce((s, p) => s + Number(p.balance), 0),
          };
        })
        .sort((a, b) => a.tower.name.localeCompare(b.tower.name, "es", { numeric: true })),
    [towers, properties]
  );

  // Departamentos sin torre: se cuentan aparte para que no se pierdan de vista.
  const unassigned = useMemo(() => properties.filter((p) => !p.tower).length, [properties]);

  return { stats, unassigned, loading, refetch: () => fetch(true) };
}
