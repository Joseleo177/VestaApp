import "reflect-metadata";
import { DataSource } from "typeorm";
import { env } from "./env";
import { User } from "../models/User";
import { Tower } from "../models/Tower";
import { Property } from "../models/Property";
import { Charge } from "../models/Charge";
import { Payment } from "../models/Payment";
import { PaymentApplication } from "../models/PaymentApplication";
import { PaymentTarget } from "../models/PaymentTarget";
import { Receipt } from "../models/Receipt";
import { BankEntry } from "../models/BankEntry";
import { ExchangeRateRecord } from "../models/ExchangeRateRecord";
import { Setting } from "../models/Setting";

const entities = [User, Tower, Property, Charge, Payment, PaymentApplication, PaymentTarget, Receipt, BankEntry, ExchangeRateRecord, Setting];

const poolOptions = {
  // En Vercel cada instancia abre su propio pool y bajo carga se levantan
  // muchas instancias a la vez: conexiones = instancias × max. Se mantiene
  // mínimo para no agotar el pooler de Supabase (usar el puerto 6543).
  max: process.env.VERCEL ? 2 : 5,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 5_000,
  // Una consulta desbocada se corta en vez de retener la conexión y mantener
  // la función facturando. statement_timeout lo aplica Postgres;
  // query_timeout es el respaldo del lado del cliente por si el pooler en
  // modo transacción descarta el parámetro de arranque.
  statement_timeout: 15_000,
  query_timeout: 20_000,
  idle_in_transaction_session_timeout: 15_000,
  application_name: "condoapp-api",
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
