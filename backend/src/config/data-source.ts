import "reflect-metadata";
import { DataSource } from "typeorm";
import { env } from "./env";
import { User } from "../models/User";
import { Tower } from "../models/Tower";
import { Property } from "../models/Property";
import { Charge } from "../models/Charge";
import { Payment } from "../models/Payment";
import { Receipt } from "../models/Receipt";
import { BankEntry } from "../models/BankEntry";
import { ExchangeRateRecord } from "../models/ExchangeRateRecord";
import { Setting } from "../models/Setting";

const entities = [User, Tower, Property, Charge, Payment, Receipt, BankEntry, ExchangeRateRecord, Setting];

const poolOptions = {
  // Con Supabase Transaction Mode (PgBouncer puerto 6543) no hay límite duro,
  // pero igual mantenemos el pool pequeño por buenas prácticas serverless
  max: 5,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 5_000,
};

export const AppDataSource = env.db.url
  ? new DataSource({
      type: "postgres",
      url: env.db.url,
      ssl: env.db.ssl ? { rejectUnauthorized: false } : false,
      synchronize: env.dbSynchronize,
      logging: env.nodeEnv === "development",
      entities,
      extra: poolOptions,
    })
  : new DataSource({
      type: "postgres",
      host: env.db.host,
      port: env.db.port,
      username: env.db.user,
      password: env.db.password,
      database: env.db.name,
      synchronize: env.dbSynchronize,
      logging: env.nodeEnv === "development",
      entities,
      extra: poolOptions,
    });
