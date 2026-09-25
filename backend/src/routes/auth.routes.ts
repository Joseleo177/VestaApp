import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import { rateLimit } from "../middlewares/rate-limit.middleware";
import { UserRole } from "../models/User";

const router = Router();

// Frena fuerza bruta sobre cédulas: cada intento hace un bcrypt y una consulta.
const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 20,
  message: "Demasiados intentos de inicio de sesión, espera unos minutos",
});

router.post("/login", loginLimiter, AuthController.login);
// Registro reservado al administrador para dar de alta copropietarios.
router.post(
  "/register",
  authenticate,
  authorize(UserRole.ADMIN),
  AuthController.register
);
router.get("/me", authenticate, AuthController.me);
router.patch("/profile", authenticate, AuthController.updateProfile);

export default router;
