import { Request, Response, NextFunction } from "express";
import { PropertyService } from "../services/property.service";
import { HttpError } from "../middlewares/error.middleware";

export const PropertyController = {
  async listMine(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await PropertyService.listForOwner(req.user!.sub));
    } catch (err) {
      next(err);
    }
  },

  async listAll(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await PropertyService.listAll());
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { code, towerId, ownerId } = req.body;
      if (!code || !ownerId) {
        throw new HttpError(400, "code y ownerId son requeridos");
      }
      const property = await PropertyService.create({ code, towerId, ownerId });
      res.status(201).json(property);
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { code, towerId, ownerId } = req.body;
      const property = await PropertyService.update(req.params.id, {
        code,
        towerId,
        ownerId,
      });
      res.json(property);
    } catch (err) {
      next(err);
    }
  },
};
