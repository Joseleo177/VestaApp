import { Request, Response, NextFunction } from "express";
import { TowerService } from "../services/tower.service";
import { HttpError } from "../middlewares/error.middleware";

export const TowerController = {
  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await TowerService.list());
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, description } = req.body;
      if (!name) throw new HttpError(400, "name es requerido");
      res.status(201).json(await TowerService.create({ name, description }));
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, description } = req.body;
      res.json(await TowerService.update(req.params.id, { name, description }));
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await TowerService.delete(req.params.id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
};
