import { AppDataSource } from "../config/data-source";
import {
  ExchangeRateRecord,
  RateCurrency,
  RATE_CURRENCIES,
  isRateCurrency,
} from "../models/ExchangeRateRecord";
import { User } from "../models/User";
import { HttpError } from "../middlewares/error.middleware";
import { SettingsService } from "./settings.service";

const BCV_URLS: Record<RateCurrency, string> = {
  [RateCurrency.USD]: "https://ve.dolarapi.com/v1/dolares/oficial",
  [RateCurrency.EUR]: "https://ve.dolarapi.com/v1/euros/oficial",
};
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 min
const CONFIG_TTL_MS = 30 * 1000;

export interface ExchangeRate {
  currency: RateCurrency;
  rate: number;
  source: string;
  updatedAt: string;
  fetchedAt: string;
}

export interface RateConfig {
  /** Moneda por defecto al emitir cuotas y con la que se valora el saldo a favor. */
  primary: RateCurrency;
  /** Monedas cuya tasa se consulta al BCV y que se pueden elegir al emitir cuotas. */
  enabled: RateCurrency[];
}

interface BcvResponse {
  promedio: number;
  fechaActualizacion: string;
}

const cache = new Map<RateCurrency, { value: ExchangeRate; at: number }>();
let configCache: { value: RateConfig; at: number } | null = null;

const repo = () => AppDataSource.getRepository(ExchangeRateRecord);

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function toRate(record: ExchangeRateRecord, source = record.source): ExchangeRate {
  return {
    currency: record.currency,
    rate: Number(record.rate),
    source,
    updatedAt: record.date,
    fetchedAt: record.updatedAt.toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/*  Configuración: moneda principal y monedas activas                  */
/* ------------------------------------------------------------------ */

/**
 * Hasta que el admin lo cambie se comporta como antes del multimoneda: el euro
 * es la principal y ambas tasas se consultan.
 */
export async function getRateConfig(): Promise<RateConfig> {
  if (configCache && Date.now() - configCache.at < CONFIG_TTL_MS) return configCache.value;

  const all = await SettingsService.getAll();
  const enabled = RATE_CURRENCIES.filter(
    (c) => all[`rate_${c.toLowerCase()}_enabled`] !== "false"
  );
  const primary = isRateCurrency(all.rate_primary) ? all.rate_primary : RateCurrency.EUR;
  const value: RateConfig = {
    primary,
    // La principal siempre está activa, aunque el ajuste diga otra cosa.
    enabled: enabled.includes(primary) ? enabled : [primary, ...enabled],
  };
  configCache = { value, at: Date.now() };
  return value;
}

export async function saveRateConfig(input: {
  primary: unknown;
  enabled: unknown;
}): Promise<RateConfig> {
  if (!isRateCurrency(input.primary)) {
    throw new HttpError(400, "Moneda principal inválida (USD o EUR)");
  }
  if (!Array.isArray(input.enabled) || !input.enabled.every(isRateCurrency)) {
    throw new HttpError(400, "Lista de monedas activas inválida");
  }
  const enabled = input.enabled as RateCurrency[];
  if (!enabled.includes(input.primary)) {
    throw new HttpError(400, "La moneda principal debe estar activa");
  }

  await SettingsService.setMany({
    rate_primary: input.primary,
    ...Object.fromEntries(
      RATE_CURRENCIES.map((c) => [`rate_${c.toLowerCase()}_enabled`, String(enabled.includes(c))])
    ),
  });
  configCache = null;
  return getRateConfig();
}

/** Lanza 400 si la moneda no se puede usar para cuotas nuevas. */
export async function assertEnabledCurrency(currency: unknown): Promise<RateCurrency> {
  if (!isRateCurrency(currency)) throw new HttpError(400, "Moneda inválida (USD o EUR)");
  const { enabled } = await getRateConfig();
  if (!enabled.includes(currency)) {
    throw new HttpError(400, `La tasa ${currency} está desactivada`);
  }
  return currency;
}

/* ------------------------------------------------------------------ */
/*  Tasas                                                              */
/* ------------------------------------------------------------------ */

/** Persiste (o actualiza) la tasa de una fecha y moneda. Solo refresca la caché si es la de hoy. */
export async function saveRate(
  rate: number,
  currency: RateCurrency,
  source: string,
  userId?: string,
  date?: string
): Promise<ExchangeRateRecord> {
  const targetDate = date ?? todayStr();
  let record = await repo().findOne({ where: { date: targetDate, currency } });
  if (record) {
    record.rate = rate;
    record.source = source;
  } else {
    record = repo().create({
      date: targetDate,
      currency,
      rate,
      source,
      ...(userId ? { createdBy: { id: userId } as User } : {}),
    });
  }
  const saved = await repo().save(record);

  if (targetDate === todayStr()) {
    cache.set(currency, {
      value: { currency, rate, source, updatedAt: targetDate, fetchedAt: new Date().toISOString() },
      at: Date.now(),
    });
  }

  return saved;
}

/**
 * Lista las tasas guardadas ordenadas de más reciente a más antigua.
 * Sin `limit` devuelve el historial completo: la tabla crece ~250 filas al
 * año por moneda (solo días hábiles) y el frontend pagina en cliente.
 */
export async function listRates(
  currency?: RateCurrency,
  limit?: number
): Promise<ExchangeRateRecord[]> {
  return repo().find({
    where: currency ? { currency } : undefined,
    order: { date: "DESC", currency: "ASC" },
    ...(limit ? { take: limit } : {}),
  });
}

/**
 * Devuelve la tasa de una moneda aplicable a una fecha concreta:
 * 1. Tasa exacta de ese día.
 * 2. Tasa más reciente anterior a esa fecha (fin de semana / feriado).
 * 3. Degradación: tasa activa de hoy.
 */
export async function getRateForDate(date: string, currency: RateCurrency): Promise<ExchangeRate> {
  const record = await repo()
    .createQueryBuilder("r")
    .where("r.currency = :currency", { currency })
    .andWhere("r.date <= :date", { date })
    .orderBy("r.date", "DESC")
    .getOne();

  if (record) return toRate(record);
  return getExchangeRate(currency);
}

/**
 * Obtiene la tasa vigente de una moneda con la siguiente prioridad:
 * 1. Caché en memoria (< 15 min) — si `force` es false.
 * 2. Tasa del día en DB.
 * 3. API BCV externa → persiste el resultado en DB (solo si la moneda está activa).
 * 4. Tasa más reciente en DB (degradación).
 */
export async function getExchangeRate(currency: RateCurrency, force = false): Promise<ExchangeRate> {
  const hit = cache.get(currency);
  if (!force && hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  if (!force) {
    const record = await repo().findOne({ where: { date: todayStr(), currency } });
    if (record) {
      const value = toRate(record);
      cache.set(currency, { value, at: Date.now() });
      return value;
    }
  }

  // Una moneda desactivada no se consulta: sus cuotas pendientes se siguen
  // convirtiendo con la última tasa guardada.
  const { enabled } = await getRateConfig();
  let fetchError: Error | null = null;
  if (enabled.includes(currency)) {
    try {
      const res = await fetch(BCV_URLS[currency], { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`BCV respondió ${res.status}`);
      const data = (await res.json()) as BcvResponse;
      if (typeof data.promedio !== "number") throw new Error("Respuesta BCV inválida");

      // saveRate actualiza la caché en memoria también.
      await saveRate(data.promedio, currency, "BCV");
      return cache.get(currency)!.value;
    } catch (err) {
      fetchError = err as Error;
    }
  }

  if (hit) return hit.value;

  const latest = await repo().findOne({ where: { currency }, order: { date: "DESC" } });
  if (latest) {
    const value = toRate(latest, `${latest.source} (${latest.date})`);
    cache.set(currency, { value, at: Date.now() });
    return value;
  }

  throw new HttpError(
    502,
    `No se pudo obtener la tasa BCV ${currency}` + (fetchError ? `: ${fetchError.message}` : "")
  );
}

/** Tasas vigentes de todas las monedas activas, para la barra superior. */
export async function getActiveRates(
  force = false
): Promise<{ primary: RateCurrency; rates: ExchangeRate[] }> {
  const { primary, enabled } = await getRateConfig();
  const results = await Promise.allSettled(enabled.map((c) => getExchangeRate(c, force)));
  const rates = results
    .filter((r): r is PromiseFulfilledResult<ExchangeRate> => r.status === "fulfilled")
    .map((r) => r.value);
  if (rates.length === 0) {
    const first = results[0];
    throw first && first.status === "rejected"
      ? first.reason
      : new HttpError(502, "No se pudo obtener la tasa BCV");
  }
  return { primary, rates };
}
