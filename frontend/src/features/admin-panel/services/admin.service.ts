import { api } from "@/services/api";
import { PropertyWithBalance } from "../types";

/** Capa de datos específica del panel de administración. */
export const adminService = {
  async listProperties(): Promise<PropertyWithBalance[]> {
    const { data } = await api.get<PropertyWithBalance[]>("/properties");
    return data;
  },
};
