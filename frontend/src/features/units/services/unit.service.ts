import { api } from "@/services/api";
import { PropertyWithBalance } from "@/features/admin-panel/types";
import { UnitInput } from "../types";

/** Capa de datos de departamentos/habitaciones (entidad Property en el backend). */
export const unitService = {
  async list(): Promise<PropertyWithBalance[]> {
    const { data } = await api.get<PropertyWithBalance[]>("/properties");
    return data;
  },

  async create(input: UnitInput): Promise<PropertyWithBalance> {
    const { data } = await api.post<PropertyWithBalance>("/properties", input);
    return data;
  },

  async update(id: string, input: UnitInput): Promise<PropertyWithBalance> {
    const { data } = await api.patch<PropertyWithBalance>(`/properties/${id}`, input);
    return data;
  },
};
