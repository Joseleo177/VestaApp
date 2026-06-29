import { Router } from "express";
import { ExchangeRateController } from "../controllers/exchange-rate.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import { UserRole } from "../models/User";

const router = Router();
router.use(authenticate);

// Cualquier usuario autenticado puede ver la tasa actual o la de una fecha concreta.
router.get("/", ExchangeRateController.get);
router.get("/for-date/:date", ExchangeRateController.getForDate);

// Solo admin puede ver historial, guardar manualmente o forzar fetch BCV.
router.get("/history", authorize(UserRole.ADMIN), ExchangeRateController.list);
router.post("/", authorize(UserRole.ADMIN), ExchangeRateController.save);
router.post("/fetch", authorize(UserRole.ADMIN), ExchangeRateController.fetch);

export default router;
