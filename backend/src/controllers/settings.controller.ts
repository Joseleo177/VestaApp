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
      const data = req.body as Record<string, string>;
      await SettingsService.setMany(data);
      res.json(await SettingsService.getAll());
    } catch (err) {
      next(err);
    }
  },
};
