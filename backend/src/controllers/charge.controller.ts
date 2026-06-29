import { Request, Response, NextFunction } from "express";
import { AppDataSource } from "../config/data-source";
import { ChargeService, amountDue, isOverdue } from "../services/charge.service";
import { Charge, ChargeStatus, ChargeType } from "../models/Charge";
import { PaymentStatus } from "../models/Payment";
import { HttpError } from "../middlewares/error.middleware";

function serializeCharge(charge: import("../models/Charge").Charge) {
  const prop = charge.property;
  const isPartial = charge.status === ChargeStatus.PARTIAL;
  const remaining = isPartial
    ? Math.max(0, Number(charge.amount) - Number(charge.amountPaid ?? 0))
    : null;

  const confirmed = charge.payments?.find((p) => p.status === PaymentStatus.CONFIRMED) ?? null;

  return {
    id: charge.id,
    period: charge.period,
    description: charge.description,
    type: charge.type,
    amount: Number(charge.amount),
    amountPaid: Number(charge.amountPaid ?? 0),
    moraAmount: Number(charge.moraAmount),
    dueDate: charge.dueDate,
    status: charge.status,
    overdue: isOverdue(charge),
    amountDue: amountDue(charge),
    amountDueDivisas: remaining !== null ? remaining : Number(charge.amount),
    confirmedPayment: confirmed
      ? {
          id: confirmed.id,
          reference: confirmed.reference,
          bank: confirmed.bank,
          paymentDate: confirmed.paymentDate,
          amount: Number(confirmed.amount),
          amountBs: confirmed.amountBs ? Number(confirmed.amountBs) : null,
          currency: confirmed.currency,
          ownerName: confirmed.submittedBy?.fullName ?? null,
          receiptNumber: confirmed.receipt?.receiptNumber ?? null,
        }
      : null,
    property: prop
      ? {
          id: prop.id,
          code: prop.code,
          tower: prop.tower ? { id: prop.tower.id, name: prop.tower.name } : null,
        }
      : undefined,
  };
}

export const ChargeController = {
  // GET /api/charges/me
  async listMine(req: Request, res: Response, next: NextFunction) {
    try {
      const { AppDataSource } = await import("../config/data-source");
      const { User } = await import("../models/User");
      const [charges, balance, user] = await Promise.all([
        ChargeService.listForOwner(req.user!.sub),
        ChargeService.balanceForOwner(req.user!.sub),
        AppDataSource.getRepository(User).findOneBy({ id: req.user!.sub }),
      ]);
      res.json({
        balance,
        creditBalance: Number(user?.creditBalance ?? 0),
        charges: charges.map(serializeCharge),
      });
    } catch (err) {
      next(err);
    }
  },

  // POST /api/charges/generate  (admin)
  async generate(req: Request, res: Response, next: NextFunction) {
    try {
      const { period, amount, moraAmount, dueDate, type, towerIds, description } = req.body;
      if (!period || !amount || !dueDate) {
        throw new HttpError(400, "period, amount y dueDate son requeridos");
      }
      const chargeType =
        type === ChargeType.SPECIAL ? ChargeType.SPECIAL : ChargeType.REGULAR;
      const result = await ChargeService.generateForPeriod({
        period,
        amount: Number(amount),
        moraAmount: Number(moraAmount ?? 0),
        dueDate,
        type: chargeType,
        towerIds: Array.isArray(towerIds) ? towerIds : undefined,
        description,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },

  // GET /api/charges/periods  (admin)
  async listPeriods(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await ChargeService.listPeriods());
    } catch (err) {
      next(err);
    }
  },

  // GET /api/charges/period/:period  (admin)
  async listForPeriod(req: Request, res: Response, next: NextFunction) {
    try {
      const charges = await ChargeService.listForPeriod(req.params.period);
      res.json(charges.map(serializeCharge));
    } catch (err) {
      next(err);
    }
  },

  // GET /api/charges/property/:propertyId  (admin)
  async listForProperty(req: Request, res: Response, next: NextFunction) {
    try {
      const charges = await ChargeService.listForProperty(req.params.propertyId);
      res.json(charges.map(serializeCharge));
    } catch (err) {
      next(err);
    }
  },

  // DELETE /api/charges/period/:period  (admin)
  async deletePeriod(req: Request, res: Response, next: NextFunction) {
    try {
      const { period } = req.params;
      const result = await AppDataSource.getRepository(Charge)
        .createQueryBuilder()
        .delete()
        .where("period = :period", { period })
        .execute();
      res.json({ deleted: result.affected ?? 0 });
    } catch (err) {
      next(err);
    }
  },

  // DELETE /api/charges/:id  (admin) — solo si no tiene pagos confirmados
  async deleteOne(req: Request, res: Response, next: NextFunction) {
    try {
      const charge = await ChargeService.getById(req.params.id);
      if (charge.status === ChargeStatus.PAID || charge.status === ChargeStatus.PARTIAL) {
        throw new HttpError(409, "No se puede eliminar una cuota con pagos confirmados. Elimina primero los pagos.");
      }
      await AppDataSource.getRepository(Charge).remove(charge);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  // PATCH /api/charges/:id/exonerate  (admin)
  async setExonerated(req: Request, res: Response, next: NextFunction) {
    try {
      const { exonerated } = req.body;
      if (typeof exonerated !== "boolean") {
        throw new HttpError(400, "exonerated (boolean) es requerido");
      }
      const charge = await ChargeService.setExonerated(req.params.id, exonerated);
      res.json(serializeCharge(charge));
    } catch (err) {
      next(err);
    }
  },
};
