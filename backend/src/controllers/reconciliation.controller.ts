import { Request, Response, NextFunction } from "express";
import { AppDataSource } from "../config/data-source";
import { BankEntry } from "../models/BankEntry";
import { ReconciliationService } from "../services/reconciliation.service";
import { HttpError } from "../middlewares/error.middleware";

export const ReconciliationController = {
  // POST /api/bank-statements/reconcile  (admin)
  async reconcile(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) throw new HttpError(400, "Archivo de extracto requerido");
      const result = await ReconciliationService.reconcile(
        req.file.buffer,
        req.user!.sub
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  // GET /api/bank-statements/entries  (admin) — todas las entradas guardadas
  async listEntries(_req: Request, res: Response, next: NextFunction) {
    try {
      const entries = await AppDataSource.getRepository(BankEntry).find({
        order: { uploadedAt: "DESC" },
      });
      res.json(entries);
    } catch (err) {
      next(err);
    }
  },
};
