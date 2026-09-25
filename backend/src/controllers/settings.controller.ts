import { Request, Response, NextFunction } from "express";
import { SettingsService } from "../services/settings.service";

export const SettingsController = {
  async getAll(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await SettingsService.getAll());
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      // La página de ajustes reenvía todos los valores que leyó. Las tasas se
      // gestionan (y validan) en /exchange-rate/config: aquí se ignoran para
      // que una pestaña vieja no revierta la moneda principal.
      const data = Object.fromEntries(
        Object.entries(req.body as Record<string, string>).filter(([k]) => !k.startsWith("rate_"))
      );
      await SettingsService.setMany(data);
      res.json(await SettingsService.getAll());
    } catch (err) {
      next(err);
    }
  },
};
