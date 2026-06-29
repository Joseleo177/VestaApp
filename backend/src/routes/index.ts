import { Router } from "express";
import authRoutes from "./auth.routes";
import userRoutes from "./user.routes";
import paymentRoutes from "./payment.routes";
import propertyRoutes from "./property.routes";
import chargeRoutes from "./charge.routes";
import exchangeRateRoutes from "./exchange-rate.routes";
import towerRoutes from "./tower.routes";
import reconciliationRoutes from "./reconciliation.routes";

const router = Router();

router.get("/health", (_req, res) => res.json({ status: "ok" }));

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/payments", paymentRoutes);
router.use("/properties", propertyRoutes);
router.use("/charges", chargeRoutes);
router.use("/exchange-rate", exchangeRateRoutes);
router.use("/towers", towerRoutes);
router.use("/bank-statements", reconciliationRoutes);

export default router;
