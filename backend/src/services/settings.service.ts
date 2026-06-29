import { AppDataSource } from "../config/data-source";
import { Setting } from "../models/Setting";

const DEFAULTS: Record<string, string> = {
  receipt_prefix:   "RC",
  receipt_counter:  "0",
  condo_name:       "Condominio",
  condo_city:       "Caracas",
  condo_rif:        "",
  condo_phone:      "",
  bank_name:        "",
  bank_beneficiary: "",
  bank_account:     "",
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

  /** Incrementa el contador de recibos y devuelve el nuevo valor. */
  async nextReceiptNumber(): Promise<number> {
    await repo().upsert({ key: "receipt_counter", value: "0" }, ["key"]);
    await repo()
      .createQueryBuilder()
      .update()
      .set({ value: () => "(CAST(value AS INTEGER) + 1)::TEXT" })
      .where("key = :key", { key: "receipt_counter" })
      .execute();
    const row = await repo().findOneBy({ key: "receipt_counter" });
    return parseInt(row?.value ?? "1", 10);
  },
};
