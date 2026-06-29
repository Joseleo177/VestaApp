import { Request, Response, NextFunction } from "express";
import { getExchangeRate, getRateForDate, saveRate, listRates } from "../services/exchange-rate.service";

export const ExchangeRateController = {
  /** GET /api/exchange-rate[?force=true] */
  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const force = req.query.force === "true";
      res.json(await getExchangeRate(force));
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/exchange-rate/history — historial de tasas (admin). */
  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      const records = await listRates();
      res.json(records.map((r) => ({
        id: r.id,
        date: r.date,
        rate: Number(r.rate),
        source: r.source,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })));
    } catch (err) {
      next(err);
    }
  },

  /** POST /api/exchange-rate — guardar tasa manual para una fecha (admin). */
  async save(req: Request, res: Response, next: NextFunction) {
    try {
      const { rate, date } = req.body as { rate: number; date?: string };
      if (!rate || typeof rate !== "number" || rate <= 0) {
        res.status(400).json({ message: "La tasa debe ser un número positivo" });
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
      const userId = (req as Request & { user?: { id: string } }).user?.id;
      const record = await saveRate(rate, "MANUAL", userId, date);
      res.json({
        id: record.id,
        date: record.date,
        rate: Number(record.rate),
        source: record.source,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      });
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/exchange-rate/for-date/:date — tasa aplicable a una fecha concreta. */
  async getForDate(req: Request, res: Response, next: NextFunction) {
    try {
      const { date } = req.params;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        res.status(400).json({ message: "Fecha inválida, use formato YYYY-MM-DD" });
        return;
      }
      res.json(await getRateForDate(date));
    } catch (err) {
      next(err);
    }
  },

  /** POST /api/exchange-rate/fetch — fuerza obtener tasa de BCV y guardarla (admin). */
  async fetch(_req: Request, res: Response, next: NextFunction) {
    try {
      const rate = await getExchangeRate(true);
      res.json(rate);
    } catch (err) {
      next(err);
    }
  },
};
