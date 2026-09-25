import { Request, Response, NextFunction } from "express";
import { In } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { ChargeService, amountDue, isOverdue } from "../services/charge.service";
import { PropertyService } from "../services/property.service";
import { User } from "../models/User";
import { Charge, ChargeStatus, ChargeType } from "../models/Charge";
import { PaymentCurrency, PaymentStatus } from "../models/Payment";
import { HttpError } from "../middlewares/error.middleware";
import { RateCurrency, isRateCurrency } from "../models/ExchangeRateRecord";
import { assertEnabledCurrency, getRateConfig } from "../services/exchange-rate.service";

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
  // También cuenta un pago de varias cuotas que incluye a esta.
  const pending =
    charge.payments?.find((p) => p.status === PaymentStatus.PENDING) ??
    charge.paymentTargets?.map((t) => t.payment).find((p) => p?.status === PaymentStatus.PENDING) ??
    null;

  // Recibo que cubre esta cuota (directo o cascade) — fuente de verdad para el PDF
  const cr = charge.coveringReceipt ?? null;

  return {
    id: charge.id,
    period: charge.period,
    description: charge.description,
    type: charge.type,
    currency: charge.currency ?? RateCurrency.EUR,
    amount: Number(charge.amount),
    amountPaid: Number(charge.amountPaid ?? 0),
    moraAmount: Number(charge.moraAmount),
    dueDate: charge.dueDate,
    status: charge.status,
    overdue: isOverdue(charge),
    amountDue: amountDue(charge),
    amountDueDivisas: remaining !== null ? remaining : Number(charge.amount),
    writeOff:
      Number(charge.writeOffAmount) > 0
        ? {
            amount: Number(charge.writeOffAmount),
            reason: charge.writeOffReason ?? "",
            at: charge.writtenOffAt ?? null,
          }
        : null,
    confirmedPayment: cr
      ? {
          id: cr.payment?.id ?? confirmed?.id ?? null,
          reference: cr.payment?.reference ?? confirmed?.reference ?? null,
          bank: cr.payment?.bank ?? confirmed?.bank ?? null,
          paymentDate: cr.payment?.paymentDate ?? confirmed?.paymentDate ?? null,
          amount: Number(charge.amountPaid ?? 0),
          amountBs: cr.payment?.amountBs ? Number(cr.payment.amountBs) : null,
          exchangeRate: cr.payment?.exchangeRate ? Number(cr.payment.exchangeRate) : null,
          rateCurrency: cr.payment?.rateCurrency ?? null,
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
          exchangeRate: confirmed.exchangeRate ? Number(confirmed.exchangeRate) : null,
          rateCurrency: confirmed.rateCurrency ?? null,
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
          exchangeRate: pending.exchangeRate ? Number(pending.exchangeRate) : null,
          rateCurrency: pending.rateCurrency ?? null,
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
        ChargeService.balanceBreakdownForUser(userId),
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
        balance: balance.total,
        // Para el equivalente en Bs: cada parte se convierte con su tasa.
        balanceByCurrency: balance.byCurrency,
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
      const { period, amount, moraAmount, dueDate, type, currency, towerIds, propertyIds, description } = req.body;
      if (!period || !amount || !dueDate) {
        throw new HttpError(400, "period, amount y dueDate son requeridos");
      }
      const chargeType =
        type === ChargeType.SPECIAL ? ChargeType.SPECIAL : ChargeType.REGULAR;
      // Sin moneda explícita se cobra a la tasa principal.
      const chargeCurrency = await assertEnabledCurrency(
        currency ?? (await getRateConfig()).primary
      );
      const result = await ChargeService.generateForPeriod({
        period,
        amount: Number(amount),
        moraAmount: Number(moraAmount ?? 0),
        dueDate,
        type: chargeType,
        currency: chargeCurrency,
        towerIds: Array.isArray(towerIds) ? towerIds : undefined,
        propertyIds: Array.isArray(propertyIds) ? propertyIds : undefined,
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
      const type = req.query.type as string | undefined;
      const charges = await ChargeService.listForPeriod(req.params.period, type);
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
      const type = req.query.type as string | undefined;
      
      const qb = AppDataSource.getRepository(Charge)
        .createQueryBuilder("charge")
        .where("charge.period = :period", { period });
        
      if (type) {
        qb.andWhere("charge.type = :type", { type });
      }
      
      // Check for associated payments to provide a clear error message
      const paymentsCount =
        (await qb.clone().innerJoin("charge.payments", "payment").getCount()) +
        (await qb.clone().innerJoin("charge.paymentTargets", "target").getCount());
        
      if (paymentsCount > 0) {
        throw new HttpError(409, "No se puede eliminar el lote porque hay cuotas con pagos asociados (pendientes, rechazados o confirmados).");
      }

      const result = await AppDataSource.getRepository(Charge)
        .createQueryBuilder()
        .delete()
        .where("period = :period", { period })
        .andWhere(type ? "type = :type" : "1=1", { type })
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

  // PATCH /api/charges/period/:period/currency?type=  {currency}  (admin)
  async setPeriodCurrency(req: Request, res: Response, next: NextFunction) {
    try {
      // Corregir cuotas viejas es válido aunque la moneda ya esté desactivada.
      const { currency } = req.body;
      if (!isRateCurrency(currency)) throw new HttpError(400, "Moneda inválida (USD o EUR)");
      const type = req.query.type as string | undefined;
      res.json(await ChargeService.setCurrency(currency, { period: req.params.period, type }));
    } catch (err) {
      next(err);
    }
  },

  // PATCH /api/charges/:id/currency  {currency}  (admin)
  async setCurrency(req: Request, res: Response, next: NextFunction) {
    try {
      const { currency } = req.body;
      if (!isRateCurrency(currency)) throw new HttpError(400, "Moneda inválida (USD o EUR)");
      const charge = await ChargeService.getById(req.params.id);
      if (charge.status === ChargeStatus.PAID) {
        throw new HttpError(409, "La cuota ya está pagada: su tasa quedó fijada por el pago");
      }
      await ChargeService.setCurrency(currency, { chargeId: charge.id });
      charge.currency = currency;
      res.json(serializeCharge(charge));
    } catch (err) {
      next(err);
    }
  },

  // POST /api/charges/:id/write-off  {reason}  (admin) — condonar el saldo de una parcial
  async writeOff(req: Request, res: Response, next: NextFunction) {
    try {
      const charge = await ChargeService.writeOff(req.params.id, String(req.body?.reason ?? ""), req.user!.sub);
      res.json(serializeCharge(charge));
    } catch (err) {
      next(err);
    }
  },

  // DELETE /api/charges/:id/write-off  (admin) — revertir la condonación
  async revertWriteOff(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(serializeCharge(await ChargeService.revertWriteOff(req.params.id)));
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
