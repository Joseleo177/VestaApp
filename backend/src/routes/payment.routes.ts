import { Router } from "express";
import { PaymentController } from "../controllers/payment.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import { UserRole } from "../models/User";

const router = Router();

router.use(authenticate);

// --- Copropietario ---
router.post("/", PaymentController.create);
router.get("/me", PaymentController.listMine);
router.get("/:id/receipt", PaymentController.downloadReceipt);

// --- Administrador ---
router.get("/", authorize(UserRole.ADMIN), PaymentController.listAll);
router.get("/pending", authorize(UserRole.ADMIN), PaymentController.listPending);
router.delete("/:id", authorize(UserRole.ADMIN), PaymentController.delete);
router.post("/:id/confirm", authorize(UserRole.ADMIN), PaymentController.confirm);
router.post("/:id/confirm-partial", authorize(UserRole.ADMIN), PaymentController.confirmPartial);
router.post("/:id/reject", authorize(UserRole.ADMIN), PaymentController.reject);

export default router;
