import { Router } from "express";
import { rateLimit } from "../middlewares/rate-limit.middleware";
import authRoutes from "./auth.routes";
import userRoutes from "./user.routes";
import paymentRoutes from "./payment.routes";
import propertyRoutes from "./property.routes";
import chargeRoutes from "./charge.routes";
import exchangeRateRoutes from "./exchange-rate.routes";
import towerRoutes from "./tower.routes";
import reconciliationRoutes from "./reconciliation.routes";
import settingsRoutes from "./settings.routes";
import reportRoutes from "./report.routes";

const router = Router();

// Excel, PDF y conciliación recorren tablas completas: límite más estricto.
const heavyLimiter = rateLimit({ windowMs: 60_000, max: 20 });

router.get("/health", (_req, res) => res.json({ status: "ok" }));

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/payments/import", heavyLimiter);
router.use("/payments", paymentRoutes);
router.use("/properties", propertyRoutes);
router.use("/charges", chargeRoutes);
router.use("/exchange-rate", exchangeRateRoutes);
router.use("/towers", towerRoutes);
router.use("/bank-statements", heavyLimiter, reconciliationRoutes);
router.use("/settings", settingsRoutes);
router.use("/reports", heavyLimiter, reportRoutes);

export default router;
