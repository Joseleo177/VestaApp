import { Router } from "express";
import { ReconciliationController } from "../controllers/reconciliation.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import { uploadXlsx } from "../middlewares/upload.middleware";
import { UserRole } from "../models/User";

const router = Router();
router.use(authenticate, authorize(UserRole.ADMIN));

router.post("/reconcile", uploadXlsx.single("statement"), ReconciliationController.reconcile);
router.get("/entries", ReconciliationController.listEntries);
router.delete("/entries", ReconciliationController.deleteEntries);

export default router;
