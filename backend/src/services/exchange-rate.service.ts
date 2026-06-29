import { AppDataSource } from "../config/data-source";
import { ExchangeRateRecord } from "../models/ExchangeRateRecord";
import { User } from "../models/User";
import { HttpError } from "../middlewares/error.middleware";

const BCV_URL = "https://ve.dolarapi.com/v1/euros/oficial";
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 min

export interface ExchangeRate {
  rate: number;
  source: string;
  updatedAt: string;
  fetchedAt: string;
}

interface BcvResponse {
  promedio: number;
  fechaActualizacion: string;
}

let cache: ExchangeRate | null = null;
let cachedAtMs = 0;

const repo = () => AppDataSource.getRepository(ExchangeRateRecord);

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Persiste (o actualiza) la tasa de una fecha en la DB. Solo refresca la caché si es la tasa de hoy. */
export async function saveRate(
  rate: number,
  source: string,
  userId?: string,
  date?: string
): Promise<ExchangeRateRecord> {
  const targetDate = date ?? todayStr();
  let record = await repo().findOne({ where: { date: targetDate } });
  if (record) {
    record.rate = rate;
    record.source = source;
  } else {
    record = repo().create({
      date: targetDate,
      rate,
      source,
      ...(userId ? { createdBy: { id: userId } as User } : {}),
    });
  }
  const saved = await repo().save(record);

  // Solo actualizar caché en memoria si es la tasa de hoy.
  if (targetDate === todayStr()) {
    cache = {
      rate,
      source,
      updatedAt: targetDate,
      fetchedAt: new Date().toISOString(),
    };
    cachedAtMs = Date.now();
  }

  return saved;
}

/** Lista las tasas guardadas ordenadas de más reciente a más antigua. */
export async function listRates(limit = 60): Promise<ExchangeRateRecord[]> {
  return repo().find({ order: { date: "DESC" }, take: limit });
}

/**
 * Devuelve la tasa aplicable a una fecha concreta:
 * 1. Tasa exacta de ese día.
 * 2. Tasa más reciente anterior a esa fecha (fin de semana / feriado).
 * 3. Degradación: tasa activa de hoy.
 */
export async function getRateForDate(date: string): Promise<ExchangeRate> {
  const record = await repo()
    .createQueryBuilder("r")
    .where("r.date <= :date", { date })
    .orderBy("r.date", "DESC")
    .getOne();

  if (record) {
    return {
      rate: Number(record.rate),
      source: record.source,
      updatedAt: record.date,
      fetchedAt: record.updatedAt.toISOString(),
    };
  }

  return getExchangeRate();
}

/**
 * Obtiene la tasa activa con la siguiente prioridad:
 * 1. Caché en memoria (< 15 min) — si `force` es false.
 * 2. Tasa del día en DB.
 * 3. API BCV externa → persiste el resultado en DB.
 * 4. Tasa más reciente en DB (degradación).
 */
export async function getExchangeRate(force = false): Promise<ExchangeRate> {
  // 1. Caché rápida en memoria
  if (!force && cache && Date.now() - cachedAtMs < CACHE_TTL_MS) {
    return cache as ExchangeRate;
  }

  // 2. Tasa del día ya guardada en DB
  if (!force) {
    const record = await repo().findOne({ where: { date: todayStr() } });
    if (record) {
      cache = {
        rate: Number(record.rate),
        source: record.source,
        updatedAt: record.date,
        fetchedAt: record.updatedAt.toISOString(),
      };
      cachedAtMs = Date.now();
      return cache;
    }
  }

  // 3. Obtener de la API BCV y persistir
  try {
    const res = await fetch(BCV_URL, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`BCV respondió ${res.status}`);
    const data = (await res.json()) as BcvResponse;
    if (typeof data.promedio !== "number") throw new Error("Respuesta BCV inválida");

    // saveRate actualiza la caché en memoria también.
    await saveRate(data.promedio, "BCV");
    return cache as ExchangeRate;
  } catch (err) {
    // 4. Degradación: devolver caché o el registro más reciente de DB.
    if (cache) return cache;

    const latest = await repo().findOne({ order: { date: "DESC" } });
    if (latest) {
      cache = {
        rate: Number(latest.rate),
        source: `${latest.source} (${latest.date})`,
        updatedAt: latest.date,
        fetchedAt: latest.updatedAt.toISOString(),
      };
      cachedAtMs = Date.now();
      return cache;
    }

    throw new HttpError(502, `No se pudo obtener la tasa BCV: ${(err as Error).message}`);
  }
}
