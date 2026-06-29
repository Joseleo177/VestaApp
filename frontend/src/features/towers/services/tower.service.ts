import { api } from "@/services/api";
import { Tower } from "@/types/domain";

export interface TowerInput {
  name: string;
  description?: string;
}

export const towerService = {
  async list(): Promise<Tower[]> {
    const { data } = await api.get<Tower[]>("/towers");
    return data;
  },

  async create(input: TowerInput): Promise<Tower> {
    const { data } = await api.post<Tower>("/towers", input);
    return data;
  },

  async update(id: string, input: TowerInput): Promise<Tower> {
    const { data } = await api.patch<Tower>(`/towers/${id}`, input);
    return data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/towers/${id}`);
  },
};
