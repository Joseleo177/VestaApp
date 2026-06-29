import { api } from "@/services/api";
import { AccountStatement, Property } from "@/types/domain";

/** Capa de datos del estado de cuenta del copropietario. */
export const accountService = {
  async getStatement(): Promise<AccountStatement> {
    const { data } = await api.get<AccountStatement>("/charges/me");
    return data;
  },

  async listMyProperties(): Promise<Property[]> {
    const { data } = await api.get<Property[]>("/properties/me");
    return data;
  },
};
