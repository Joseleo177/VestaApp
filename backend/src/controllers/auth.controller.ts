import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../config/data-source";
import { User, UserRole } from "../models/User";
import { env } from "../config/env";
import { HttpError } from "../middlewares/error.middleware";
import { AuthPayload } from "../middlewares/auth.middleware";

const userRepo = () => AppDataSource.getRepository(User);

function parseRole(value: unknown): UserRole {
  if (value === UserRole.ADMIN) return UserRole.ADMIN;
  if (value === UserRole.AUTHORIZED) return UserRole.AUTHORIZED;
  return UserRole.OWNER;
}

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
          email: user.email,
          phone: user.phone,
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
        role: parseRole(role),
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
        email: user.email,
        phone: user.phone,
        role: user.role,
      });
    } catch (err) {
      next(err);
    }
  },

  // PATCH /api/auth/profile
  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.sub;
      const { phone, email, password, fullName } = req.body;

      const user = await userRepo().findOneBy({ id: userId });
      if (!user) throw new HttpError(404, "Usuario no encontrado");

      // Solo el administrador corrige su propio nombre. El del vecino identifica
      // al titular en recibos y estados de cuenta: lo cambia la administración.
      // El rol se toma de la base de datos, no del token.
      if (fullName !== undefined) {
        if (user.role !== UserRole.ADMIN) {
          throw new HttpError(403, "Pide a la administración que corrija tu nombre");
        }
        const name = String(fullName).trim();
        if (name.length < 3) throw new HttpError(400, "Indica el nombre completo");
        user.fullName = name;
      }
      if (phone !== undefined) user.phone = phone;
      if (email !== undefined) user.email = email;
      
      if (password) {
        user.passwordHash = await bcrypt.hash(password, 10);
      }
      
      await userRepo().save(user);

      res.json({
        id: user.id,
        cedula: user.cedula,
        cedulaTipo: user.cedulaTipo,
        fullName: user.fullName,
        phone: user.phone,
        email: user.email,
        role: user.role,
      });
    } catch (err) {
      next(err);
    }
  },
};
