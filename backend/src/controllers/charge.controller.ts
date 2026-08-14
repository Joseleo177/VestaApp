import { Request, Response, NextFunction } from "express";
import { In } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { ChargeService, amountDue, isOverdue } from "../services/charge.service";
import { PropertyService } from "../services/property.service";
import { User } from "../models/User";
import { Charge, ChargeStatus, ChargeType } from "../models/Charge";
import { PaymentCurrency, PaymentStatus } from "../models/Payment";
import { HttpError } from "../middlewares/error.middleware";

function serializeCharge(charge: import("../models/Charge").Charge) {
  const prop = charge.property;
  const isPartial = charge.status === ChargeStatus.PARTIAL;
  const remaining = isPartial
    ? amountDue(charge, PaymentCurrency.BS) // incluye mora si está vencida
    : null;

  // Pago confirmado (para mostrar referencia/banco/fecha en la tabla)
  const confirmed =
    charge.payments?.find((p) => p.status === PaymentStatus.CONFIRMED) ?? null;

  // Pago registrado por el vecino y aún sin revisar por el administrador.
  const pending =
    charge.payments?.find((p) => p.status === PaymentStatus.PENDING) ?? null;

  // Recibo que cubre esta cuota (directo o cascade) — fuente de verdad para el PDF
  const cr = charge.coveringReceipt ?? null;

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
    confirmedPayment: cr
      ? {
          id: cr.payment?.id ?? confirmed?.id ?? null,
          reference: cr.payment?.reference ?? confirmed?.reference ?? null,
          bank: cr.payment?.bank ?? confirmed?.bank ?? null,
          paymentDate: cr.payment?.paymentDate ?? confirmed?.paymentDate ?? null,
          amount: Number(charge.amountPaid ?? 0),
          amountBs: cr.payment?.amountBs ? Number(cr.payment.amountBs) : null,
          currency: cr.payment?.currency ?? confirmed?.currency ?? null,
          ownerName: cr.payment?.submittedBy?.fullName ?? null,
          receiptNumber: cr.receiptNumber,
        }
      : confirmed
      ? {
          id: confirmed.id,
          reference: confirmed.reference,
          bank: confirmed.bank,
          paymentDate: confirmed.paymentDate,
          amount: Number(confirmed.amount),
          amountBs: confirmed.amountBs ? Number(confirmed.amountBs) : null,
          currency: confirmed.currency,
          ownerName: confirmed.submittedBy?.fullName ?? null,
          receiptNumber: null,
        }
      : null,
    pendingPayment: pending
      ? {
          id: pending.id,
          amount: Number(pending.amount),
          amountBs: pending.amountBs ? Number(pending.amountBs) : null,
          currency: pending.currency,
          reference: pending.reference,
          bank: pending.bank,
          paymentDate: pending.paymentDate,
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
  // GET /api/charges/me — cuotas de las unidades propias y de las autorizadas
  async listMine(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.sub;
      const [charges, balance, self, properties] = await Promise.all([
        ChargeService.listForUser(userId),
        ChargeService.balanceForUser(userId),
        AppDataSource.getRepository(User).findOneBy({ id: userId }),
        PropertyService.listForUser(userId),
      ]);

      // El saldo a favor vive en el titular de cada unidad. Un autorizado que no
      // es el titular ve el crédito del titular de las unidades que gestiona.
      let creditBalance = Number(self?.creditBalance ?? 0);
      const otherOwnerIds = [
        ...new Set(
          properties
            .map((p) => p.owner?.id)
            .filter((id): id is string => !!id && id !== userId)
        ),
      ];
      if (otherOwnerIds.length > 0) {
        const owners = await AppDataSource.getRepository(User).findBy({
          id: In(otherOwnerIds),
        });
        creditBalance += owners.reduce(
          (sum, o) => sum + Number(o.creditBalance ?? 0),
          0
        );
      }

      res.json({
        balance,
        creditBalance: Math.round(creditBalance * 100) / 100,
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
