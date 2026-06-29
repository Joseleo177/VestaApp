import { AppDataSource } from "../config/data-source";
import { Setting } from "../models/Setting";

const DEFAULTS: Record<string, string> = {
  receipt_prefix: "RC",
  condo_name: "Condominio",
  condo_city: "Caracas",
};

const repo = () => AppDataSource.getRepository(Setting);

export const SettingsService = {
  async get(key: string): Promise<string> {
    const row = await repo().findOneBy({ key });
    return row?.value ?? DEFAULTS[key] ?? "";
  },

  async getAll(): Promise<Record<string, string>> {
    const rows = await repo().find();
    const result = { ...DEFAULTS };
    for (const row of rows) result[row.key] = row.value;
    return result;
  },

  async set(key: string, value: string): Promise<void> {
    await repo().upsert({ key, value }, ["key"]);
  },

  async setMany(data: Record<string, string>): Promise<void> {
    const entries = Object.entries(data).map(([key, value]) => ({ key, value }));
    if (entries.length) await repo().upsert(entries, ["key"]);
  },
};
