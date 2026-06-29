import { Router } from "express";
import { ChargeController } from "../controllers/charge.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import { UserRole } from "../models/User";

const router = Router();
router.use(authenticate);

router.get("/me", ChargeController.listMine);

// --- Administrador ---
router.post("/generate", authorize(UserRole.ADMIN), ChargeController.generate);
router.get("/periods", authorize(UserRole.ADMIN), ChargeController.listPeriods);
router.get(
  "/period/:period",
  authorize(UserRole.ADMIN),
  ChargeController.listForPeriod
);
router.get(
  "/property/:propertyId",
  authorize(UserRole.ADMIN),
  ChargeController.listForProperty
);
router.delete(
  "/period/:period",
  authorize(UserRole.ADMIN),
  ChargeController.deletePeriod
);
router.patch(
  "/:id/exonerate",
  authorize(UserRole.ADMIN),
  ChargeController.setExonerated
);
router.delete(
  "/:id",
  authorize(UserRole.ADMIN),
  ChargeController.deleteOne
);

export default router;
