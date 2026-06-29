import { useCallback, useEffect, useState } from "react";
import { User, UserRole } from "@/types/domain";
import { PropertyWithBalance } from "@/features/admin-panel/types";
import { userService } from "@/features/users/services/user.service";
import { unitService } from "../services/unit.service";

interface Result {
  units: PropertyWithBalance[];
  /** Copropietarios activos disponibles para asignar. */
  owners: User[];
  loading: boolean;
  refetch: () => Promise<void>;
}

/** Carga departamentos y la lista de copropietarios para los formularios. */
export function useUnits(): Result {
  const [units, setUnits] = useState<PropertyWithBalance[]>([]);
  const [owners, setOwners] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const [unitList, users] = await Promise.all([
        unitService.list(),
        userService.list(),
      ]);
      setUnits(unitList);
      setOwners(users.filter((u) => u.role === UserRole.OWNER && u.isActive));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { units, owners, loading, refetch: fetch };
}
