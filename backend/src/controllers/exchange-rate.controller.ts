import { Request, Response, NextFunction } from "express";
import {
  getActiveRates,
  getRateConfig,
  getRateForDate,
  listRates,
  saveRate,
  saveRateConfig,
} from "../services/exchange-rate.service";
import { ExchangeRateRecord, isRateCurrency } from "../models/ExchangeRateRecord";

function serializeRecord(r: ExchangeRateRecord) {
  return {
    id: r.id,
    date: r.date,
    currency: r.currency,
    rate: Number(r.rate),
    source: r.source,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export const ExchangeRateController = {
  /** GET /api/exchange-rate[?force=true] — tasas vigentes de las monedas activas. */
  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const force = req.query.force === "true";
      res.json(await getActiveRates(force));
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/exchange-rate/config — moneda principal y monedas activas. */
  async getConfig(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await getRateConfig());
    } catch (err) {
      next(err);
    }
  },

  /** PUT /api/exchange-rate/config {primary, enabled[]} (admin). */
  async saveConfig(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await saveRateConfig(req.body ?? {}));
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/exchange-rate/history[?currency=USD&limit=N] — historial de tasas (admin). */
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      // Sin ?limit devuelve todo el historial; el frontend pagina en cliente.
      const parsed = Number(req.query.limit);
      const limit = Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
      const currency = isRateCurrency(req.query.currency) ? req.query.currency : undefined;
      const records = await listRates(currency, limit);
      res.json(records.map(serializeRecord));
    } catch (err) {
      next(err);
    }
  },

  /** POST /api/exchange-rate {rate, currency, date?} — guardar tasa manual (admin). */
  async save(req: Request, res: Response, next: NextFunction) {
    try {
      const { rate, date, currency } = req.body as { rate: number; date?: string; currency?: string };
      if (!rate || typeof rate !== "number" || rate <= 0) {
        res.status(400).json({ message: "La tasa debe ser un número positivo" });
        return;
      }
      if (!isRateCurrency(currency)) {
        res.status(400).json({ message: "Indica la moneda de la tasa (USD o EUR)" });
        return;
      }
      if (date) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          res.status(400).json({ message: "Fecha inválida, use formato YYYY-MM-DD" });
          return;
        }
        const today = new Date().toISOString().slice(0, 10);
        if (date > today) {
          res.status(400).json({ message: "No se puede registrar una tasa para una fecha futura" });
          return;
        }
      }
      const record = await saveRate(rate, currency, "MANUAL", req.user?.sub, date);
      res.json(serializeRecord(record));
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/exchange-rate/for-date/:date?currency=USD — tasa aplicable a una fecha. */
  async getForDate(req: Request, res: Response, next: NextFunction) {
    try {
      const { date } = req.params;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        res.status(400).json({ message: "Fecha inválida, use formato YYYY-MM-DD" });
        return;
      }
      const currency = isRateCurrency(req.query.currency)
        ? req.query.currency
        : (await getRateConfig()).primary;
      res.json(await getRateForDate(date, currency));
    } catch (err) {
      next(err);
    }
  },

  /** POST /api/exchange-rate/fetch — fuerza obtener las tasas del BCV y guardarlas (admin). */
  async fetch(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await getActiveRates(true));
    } catch (err) {
      next(err);
    }
  },
};
