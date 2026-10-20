import { useOutletContext } from "react-router-dom";
import { useOwnerDashboard } from "./useOwnerDashboard";
import { CondoSettings } from "./useCondoSettings";

/**
 * Estado compartido por las secciones del vecino (Inicio, Cuotas, Pagos, Datos
 * de pago). Se carga una sola vez en el layout: cambiar de sección no vuelve a
 * pedir nada y el formulario de pago se abre igual desde cualquiera.
 */
export type ResidentContext = ReturnType<typeof useOwnerDashboard> & {
  settings: CondoSettings | null;
  loadingSettings: boolean;
};

export const useResident = () => useOutletContext<ResidentContext>();
