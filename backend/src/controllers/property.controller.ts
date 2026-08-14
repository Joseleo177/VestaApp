import { Request, Response, NextFunction } from "express";
import { PropertyService } from "../services/property.service";
import { HttpError } from "../middlewares/error.middleware";

export const PropertyController = {
  async listMine(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await PropertyService.listForUser(req.user!.sub));
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
      const { code, towerId, ownerId, authorizedId } = req.body;
      if (!code || !ownerId) {
        throw new HttpError(400, "code y ownerId son requeridos");
      }
      const property = await PropertyService.create({
        code,
        towerId,
        ownerId,
        authorizedId: authorizedId || null,
      });
      res.status(201).json(property);
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { code, towerId, ownerId, authorizedId } = req.body;
      const property = await PropertyService.update(req.params.id, {
        code,
        towerId,
        ownerId,
        // undefined = no tocar; "" o null = quitar el autorizado
        authorizedId: authorizedId === undefined ? undefined : authorizedId || null,
      });
      res.json(property);
    } catch (err) {
      next(err);
    }
  },
};
