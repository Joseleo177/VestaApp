import { useEffect, useState } from "react";
import { api } from "@/services/api";

/** Datos públicos del condominio que el vecino necesita para pagar. */
export interface CondoSettings {
  condo_name?: string;
  condo_rif?: string;
  condo_phone?: string;
  condo_address?: string;
  bank_name?: string;
  bank_beneficiary?: string;
  bank_account?: string;
  bank_usd_name?: string;
  bank_usd_beneficiary?: string;
  bank_usd_account?: string;
}

export function useCondoSettings() {
  const [settings, setSettings] = useState<CondoSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<CondoSettings>("/settings")
      .then(({ data }) => setSettings(data))
      .catch(() => setSettings({}))
      .finally(() => setLoading(false));
  }, []);

  return { settings, loading };
}
