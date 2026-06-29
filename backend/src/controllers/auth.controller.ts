import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../config/data-source";
import { User, UserRole } from "../models/User";
import { env } from "../config/env";
import { HttpError } from "../middlewares/error.middleware";
import { AuthPayload } from "../middlewares/auth.middleware";

const userRepo = () => AppDataSource.getRepository(User);

export const AuthController = {
  // POST /api/auth/login
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { cedula, password } = req.body;
      if (!cedula || !password) {
        throw new HttpError(400, "Cédula y contraseña requeridas");
      }

      // passwordHash tiene select:false, hay que pedirlo explícitamente.
      const user = await userRepo()
        .createQueryBuilder("u")
        .addSelect("u.passwordHash")
        .where("u.cedula = :cedula", { cedula })
        .getOne();
      if (!user || !user.isActive) {
        throw new HttpError(401, "Credenciales inválidas");
      }

      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) throw new HttpError(401, "Credenciales inválidas");

      const payload: AuthPayload = {
        sub: user.id,
        role: user.role,
        cedula: user.cedula,
      };
      const token = jwt.sign(payload, env.jwt.secret, {
        expiresIn: env.jwt.expiresIn,
      } as jwt.SignOptions);

      res.json({
        token,
        user: {
          id: user.id,
          cedula: user.cedula,
          fullName: user.fullName,
          role: user.role,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  // POST /api/auth/register  (uso administrativo: crear copropietarios)
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { cedula, password, fullName, phone, role } = req.body;
      if (!cedula || !password || !fullName) {
        throw new HttpError(400, "cedula, password y fullName son requeridos");
      }

      const exists = await userRepo().findOneBy({ cedula });
      if (exists) throw new HttpError(409, "La cédula ya está registrada");

      const passwordHash = await bcrypt.hash(password, 10);
      const user = userRepo().create({
        cedula,
        passwordHash,
        fullName,
        phone,
        role: role === UserRole.ADMIN ? UserRole.ADMIN : UserRole.OWNER,
      });
      await userRepo().save(user);

      res.status(201).json({ id: user.id, cedula: user.cedula, role: user.role });
    } catch (err) {
      next(err);
    }
  },

  // GET /api/auth/me
  async me(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await userRepo().findOneBy({ id: req.user!.sub });
      if (!user) throw new HttpError(404, "Usuario no encontrado");
      res.json({
        id: user.id,
        cedula: user.cedula,
        fullName: user.fullName,
        role: user.role,
      });
    } catch (err) {
      next(err);
    }
  },
};
