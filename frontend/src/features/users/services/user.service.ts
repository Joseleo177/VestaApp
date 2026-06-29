import { api } from "@/services/api";
import { User } from "@/types/domain";
import { CreateUserInput, UpdateUserInput } from "../types";

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
};
