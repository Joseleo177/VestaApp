import { Request, Response, NextFunction } from "express";
import { UserService } from "../services/user.service";
import { UserRole } from "../models/User";
import { HttpError } from "../middlewares/error.middleware";

function parseRole(value: unknown): UserRole {
  return value === UserRole.ADMIN ? UserRole.ADMIN : UserRole.OWNER;
}

export const UserController = {
  // GET /api/users  (admin)
  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await UserService.list());
    } catch (err) {
      next(err);
    }
  },

  // POST /api/users  (admin)
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { cedula, password, fullName, phone, role } = req.body;
      if (!cedula || !password || !fullName) {
        throw new HttpError(400, "cedula, password y fullName son requeridos");
      }
      const user = await UserService.create({
        cedula,
        password,
        fullName,
        phone,
        role: parseRole(role),
      });
      res.status(201).json(user);
    } catch (err) {
      next(err);
    }
  },

  // PATCH /api/users/:id  (admin)
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { cedula, fullName, phone, role, password } = req.body;
      const user = await UserService.update(req.params.id, {
        cedula,
        fullName,
        phone,
        role: role === undefined ? undefined : parseRole(role),
        password: password || undefined,
      });
      res.json(user);
    } catch (err) {
      next(err);
    }
  },

  // PATCH /api/users/:id/status  (admin) — activar / desactivar
  async setStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { isActive } = req.body;
      if (typeof isActive !== "boolean") {
        throw new HttpError(400, "isActive (boolean) es requerido");
      }
      const user = await UserService.setActive(
        req.params.id,
        isActive,
        req.user!.sub
      );
      res.json(user);
    } catch (err) {
      next(err);
    }
  },
};
