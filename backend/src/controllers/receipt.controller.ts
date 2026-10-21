import { Request, Response, NextFunction } from "express";
import { In } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { Receipt } from "../models/Receipt";
import { Charge } from "../models/Charge";

export const ReceiptController = {
  /**
   * GET /api/receipts  (admin) — todos los recibos emitidos, del más nuevo al más
   * viejo, con su pago, el departamento y su titular, y las cuotas que ampara.
   *
   * Una consulta para los recibos (solo los campos que la pantalla usa) y otra para
   * sus cuotas: un recibo nuevo ampara todas las que dejó saldadas su pago (vía
   * `charges.receipt_id`); uno viejo, la suya (`receipts.charge_id`).
   */
  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      const receipts = await AppDataSource.getRepository(Receipt)
        .createQueryBuilder("r")
        .leftJoin("r.payment", "p")
        .leftJoin("p.property", "prop")
        .leftJoin("prop.tower", "tw")
        .leftJoin("prop.owner", "ow")
        .leftJoin("r.charge", "rc")
        .leftJoin("r.issuedBy", "ib")
        .select([
          "r.id", "r.receiptNumber", "r.issuedAt", "r.voidedAt", "r.voidReason",
          "p.id", "p.amount", "p.currency", "p.amountBs", "p.paymentDate", "p.bank", "p.reference",
          "prop.id", "prop.code", "tw.id", "tw.name", "ow.id", "ow.fullName",
          "rc.id", "rc.period", "rc.description",
          "ib.id", "ib.fullName",
        ])
        .orderBy("r.issuedAt", "DESC")
        .getMany();

      const ids = receipts.map((r) => r.id);
      const covered = ids.length
        ? await AppDataSource.getRepository(Charge).find({
            where: { coveringReceipt: { id: In(ids) } },
            relations: { coveringReceipt: true },
            select: { id: true, period: true, description: true, coveringReceipt: { id: true } },
            order: { period: "ASC" },
          })
        : [];
      const byReceipt = new Map<string, { id: string; period: string; description: string }[]>();
      for (const c of covered) {
        const key = c.coveringReceipt!.id;
        byReceipt.set(key, [...(byReceipt.get(key) ?? []), { id: c.id, period: c.period, description: c.description }]);
      }

      res.json(
        receipts.map((r) => {
          const charges = byReceipt.get(r.id) ?? (r.charge ? [{ id: r.charge.id, period: r.charge.period, description: r.charge.description }] : []);
          return {
            id: r.id,
            receiptNumber: r.receiptNumber,
            issuedAt: r.issuedAt,
            issuedBy: r.issuedBy?.fullName ?? null,
            voidedAt: r.voidedAt ?? null,
            voidReason: r.voidReason ?? null,
            payment: r.payment
              ? {
                  id: r.payment.id,
                  amount: Number(r.payment.amount),
                  currency: r.payment.currency,
                  amountBs: r.payment.amountBs !== null && r.payment.amountBs !== undefined ? Number(r.payment.amountBs) : null,
                  paymentDate: r.payment.paymentDate,
                  bank: r.payment.bank,
                  reference: r.payment.reference,
                }
              : null,
            property: r.payment?.property
              ? {
                  id: r.payment.property.id,
                  code: r.payment.property.code,
                  tower: r.payment.property.tower?.name ?? null,
                  owner: r.payment.property.owner?.fullName ?? null,
                }
              : null,
            charges,
          };
        })
      );
    } catch (err) {
      next(err);
    }
  },
};
