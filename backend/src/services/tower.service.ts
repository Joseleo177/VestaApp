import { AppDataSource } from "../config/data-source";
import { Tower } from "../models/Tower";
import { HttpError } from "../middlewares/error.middleware";

const repo = () => AppDataSource.getRepository(Tower);

export interface CreateTowerInput {
  name: string;
  description?: string;
}

export const TowerService = {
  list(): Promise<Tower[]> {
    return repo().find({ order: { name: "ASC" } });
  },

  async getById(id: string): Promise<Tower> {
    const tower = await repo().findOne({ where: { id }, relations: { properties: true } });
    if (!tower) throw new HttpError(404, "Torre no encontrada");
    return tower;
  },

  async create(input: CreateTowerInput): Promise<Tower> {
    const exists = await repo().findOneBy({ name: input.name });
    if (exists) throw new HttpError(409, "Ya existe una torre con ese nombre");
    const tower = repo().create(input);
    return repo().save(tower);
  },

  async update(id: string, input: Partial<CreateTowerInput>): Promise<Tower> {
    const tower = await repo().findOneBy({ id });
    if (!tower) throw new HttpError(404, "Torre no encontrada");
    if (input.name && input.name !== tower.name) {
      const exists = await repo().findOneBy({ name: input.name });
      if (exists) throw new HttpError(409, "Ya existe una torre con ese nombre");
      tower.name = input.name;
    }
    if (input.description !== undefined) tower.description = input.description;
    return repo().save(tower);
  },

  async delete(id: string): Promise<void> {
    const tower = await repo().findOne({ where: { id }, relations: { properties: true } });
    if (!tower) throw new HttpError(404, "Torre no encontrada");
    if (tower.properties?.length > 0) {
      throw new HttpError(
        409,
        `No se puede eliminar: la torre tiene ${tower.properties.length} departamento(s) asignado(s)`
      );
    }
    await repo().delete(id);
  },
};
