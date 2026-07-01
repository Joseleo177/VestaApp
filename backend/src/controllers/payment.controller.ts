import { Request, Response, NextFunction } from "express";
import { PaymentService } from "../services/payment.service";
import { generateReceiptPdf } from "../services/pdf.service";
import { UserRole } from "../models/User";
import { PaymentCurrency, PaymentStatus } from "../models/Payment";
import { HttpError } from "../middlewares/error.middleware";

export const PaymentController = {
  // POST /api/payments  (copropietario)
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { chargeId, currency, bank, reference, paymentDate, amountBs } = req.body;
      if (!chargeId || !currency || !bank || !paymentDate) {
        throw new HttpError(400, "Faltan campos obligatorios del pago");
      }
      if (currency !== PaymentCurrency.DIVISAS && currency !== PaymentCurrency.BS) {
        throw new HttpError(400, "Tipo de pago inválido");
      }

      const payment = await PaymentService.create(req.user!.sub, {
        chargeId,
        currency,
        bank,
        reference,
        paymentDate,
        amountBs: amountBs ? Number(amountBs) : undefined,
      });

      res.status(201).json(payment);
    } catch (err) {
      next(err);
    }
  },

  // GET /api/payments/me  (copropietario) — su historial
  async listMine(req: Request, res: Response, next: NextFunction) {
    try {
      const payments = await PaymentService.listForOwner(req.user!.sub);
      res.json(payments);
    } catch (err) {
      next(err);
    }
  },

  // GET /api/payments/pending  (admin) — cola de validación
  async listPending(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await PaymentService.listPending());
    } catch (err) {
      next(err);
    }
  },

  // GET /api/payments  (admin) — todos con filtro opcional ?status=
  async listAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { status } = req.query;
      const payments = await PaymentService.listAll(
        status as PaymentStatus | undefined
      );
      res.json(payments);
    } catch (err) {
      next(err);
    }
  },

  // POST /api/payments/:id/confirm  (admin)
  async confirm(req: Request, res: Response, next: NextFunction) {
    try {
      const receipt = await PaymentService.confirm(req.params.id, req.user!.sub);
      res.json({
        message: "Pago confirmado y recibo generado",
        receiptNumber: receipt.receiptNumber,
        receiptId: receipt.id,
      });
    } catch (err) {
      next(err);
    }
  },

  // POST /api/payments/:id/confirm-partial  (admin) — confirma con monto real del banco
  async confirmPartial(req: Request, res: Response, next: NextFunction) {
    try {
      const { amount } = req.body;
      if (amount == null || isNaN(Number(amount)) || Number(amount) <= 0) {
        throw new HttpError(400, "El monto del banco es requerido y debe ser positivo");
      }
      const receipt = await PaymentService.confirmPartial(
        req.params.id,
        Number(amount),
        req.user!.sub
      );
      res.json({
        message: "Pago confirmado parcialmente y recibo generado",
        receiptNumber: receipt.receiptNumber,
        receiptId: receipt.id,
      });
    } catch (err) {
      next(err);
    }
  },

  // POST /api/payments/:id/reject  (admin)
  async reject(req: Request, res: Response, next: NextFunction) {
    try {
      const { reason } = req.body;
      if (!reason) throw new HttpError(400, "El motivo de rechazo es requerido");
      const payment = await PaymentService.reject(req.params.id, req.user!.sub, reason);
      res.json({ message: "Pago rechazado", status: payment.status });
    } catch (err) {
      next(err);
    }
  },

  // DELETE /api/payments/:id  (admin)
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await PaymentService.delete(req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  // GET /api/payments/:id/receipt — genera el PDF en memoria y lo envía al cliente
  async downloadReceipt(req: Request, res: Response, next: NextFunction) {
    try {
      const isAdmin = req.user!.role === UserRole.ADMIN;
      const rn = req.query.rn as string | undefined;
      const receipt = await PaymentService.getReceipt(
        req.params.id,
        req.user!.sub,
        isAdmin,
        rn
      );
      const { SettingsService } = await import("../services/settings.service");
      const [condoName, condoCity, condoRif, condoPhone] = await Promise.all([
        SettingsService.get("condo_name"),
        SettingsService.get("condo_city"),
        SettingsService.get("condo_rif"),
        SettingsService.get("condo_phone"),
      ]);
      // receipt.charge: cuota específica (cascade) o null → fallback a payment.charge
      const pdfBuffer = await generateReceiptPdf(
        receipt.payment,
        receipt.receiptNumber,
        { condoName, condoCity, condoRif, condoPhone, issuedAt: receipt.issuedAt },
        receipt.charge
      );
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${receipt.receiptNumber}.pdf"`);
      res.setHeader("Content-Length", pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (err) {
      next(err);
    }
  },
};
