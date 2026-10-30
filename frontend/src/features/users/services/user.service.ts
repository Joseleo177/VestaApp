import { api } from "@/services/api";
import { User } from "@/types/domain";
import { CreateUserInput, CreditInfo, UpdateUserInput } from "../types";

/** Capa de datos del módulo de usuarios (solo admin). */
export const userService = {
  async list(): Promise<User[]> {
    const { data } = await api.get<User[]>("/users");
    return data;
  },

  async create(input: CreateUserInput): Promise<User> {
    const { data } = await api.post<User>("/users", input);
    return data;
  },

  async update(id: string, input: UpdateUserInput): Promise<User> {
    const { data } = await api.patch<User>(`/users/${id}`, input);
    return data;
  },

  async setActive(id: string, isActive: boolean): Promise<User> {
    const { data } = await api.patch<User>(`/users/${id}/status`, { isActive });
    return data;
  },

  /** Saldo a favor del titular y sus últimos ajustes manuales. */
  async getCredit(id: string): Promise<CreditInfo> {
    const { data } = await api.get<CreditInfo>(`/users/${id}/credit`);
    return data;
  },

  /** Deja el saldo a favor en `balance`; el motivo queda registrado. */
  async setCredit(id: string, balance: number, reason: string): Promise<CreditInfo> {
    const { data } = await api.put<CreditInfo>(`/users/${id}/credit`, { balance, reason });
    return data;
  },
};
