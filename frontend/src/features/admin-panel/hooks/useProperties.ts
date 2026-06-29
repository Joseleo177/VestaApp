import { useEffect, useState } from "react";
import { PropertyWithBalance } from "../types";
import { adminService } from "../services/admin.service";

interface Result {
  properties: PropertyWithBalance[];
  loading: boolean;
}

/** Listado global de propiedades con saldo (control de morosidad). */
export function useProperties(): Result {
  const [properties, setProperties] = useState<PropertyWithBalance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    adminService
      .listProperties()
      .then((data) => active && setProperties(data))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return { properties, loading };
}
