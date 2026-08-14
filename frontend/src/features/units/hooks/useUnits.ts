import { useCallback, useEffect, useState } from "react";
import { User, UserRole } from "@/types/domain";
import { PropertyWithBalance } from "@/features/admin-panel/types";
import { userService } from "@/features/users/services/user.service";
import { unitService } from "../services/unit.service";

interface Result {
  units: PropertyWithBalance[];
  /** Copropietarios activos disponibles para asignar como titular. */
  owners: User[];
  /** Candidatos a autorizado: copropietarios y usuarios con rol Autorizado. */
  authorizedCandidates: User[];
  loading: boolean;
  refetch: () => Promise<void>;
}

/** Carga departamentos y la lista de copropietarios para los formularios. */
export function useUnits(): Result {
  const [units, setUnits] = useState<PropertyWithBalance[]>([]);
  const [owners, setOwners] = useState<User[]>([]);
  const [authorizedCandidates, setAuthorizedCandidates] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const [unitList, users] = await Promise.all([
        unitService.list(),
        userService.list(),
      ]);
      setUnits(unitList);
      const active = users.filter((u) => u.isActive);
      setOwners(active.filter((u) => u.role === UserRole.OWNER));
      // El titular también puede figurar como autorizado de su propia unidad.
      setAuthorizedCandidates(
        active.filter(
          (u) => u.role === UserRole.OWNER || u.role === UserRole.AUTHORIZED
        )
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { units, owners, authorizedCandidates, loading, refetch: fetch };
}
