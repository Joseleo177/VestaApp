import { EntityManager } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { Payment, PaymentStatus, PaymentCurrency } from "../models/Payment";
import { Charge, ChargeStatus } from "../models/Charge";
import { Receipt } from "../models/Receipt";
import { BankEntry } from "../models/BankEntry";
import { User } from "../models/User";
import { HttpError } from "../middlewares/error.middleware";
import { amountDue } from "./charge.service";
import { getRateForDate } from "./exchange-rate.service";
import { ReconciliationService } from "./reconciliation.service";
import { SettingsService } from "./settings.service";

function normalizeRef(s: string): string {
  return s.trim().replace(/^'+/, "").toLowerCase();
}

const paymentRepo = () => AppDataSource.getRepository(Payment);
const chargeRepo = () => AppDataSource.getRepository(Charge);
const receiptRepo = () => AppDataSource.getRepository(Receipt);

export interface CreatePaymentInput {
  chargeId: string;
  currency: PaymentCurrency;
  bank: string;
  reference: string;
  paymentDate: string;
  /** Monto real en Bs que el cliente transfirió (para pagos BS). */
  amountBs?: number;
}

type TxManager = EntityManager;

/**
 * Aplica hasta `paidAmount` EUR a la cuota, respetando lo que realmente se debe.
 * Retorna el excedente (> 0 si el pago supera la deuda de esta cuota).
 */
async function applyPaymentToCharge(
  manager: TxManager,
  charge: Charge,
  paidAmount: number,
  currency: PaymentCurrency,
  paymentDate?: string
): Promise<number> {
  if (charge.status === ChargeStatus.EXONERATED) return paidAmount;

  const ref = paymentDate
    ? new Date(paymentDate).setHours(0, 0, 0, 0)
    : new Date().setHours(0, 0, 0, 0);
  const overdueAtPayment = new Date(charge.dueDate).getTime() < ref;
  const moraApplies =
    overdueAtPayment &&
    currency !== PaymentCurrency.DIVISAS &&
    Number(charge.moraAmount) > 0;
  const totalExpected =
    Number(charge.amount) + (moraApplies ? Number(charge.moraAmount) : 0);

  const alreadyPaid = Number(charge.amountPaid ?? 0);
  const stillOwed = Math.max(0, Math.round((totalExpected - alreadyPaid) * 100) / 100);
  const applied = Math.min(paidAmount, stillOwed);
  const excess = Math.round(Math.max(0, paidAmount - applied) * 100) / 100;

  charge.amountPaid = Math.round((alreadyPaid + applied) * 100) / 100;
  charge.status =
    charge.amountPaid >= totalExpected - 0.01
      ? ChargeStatus.PAID
      : ChargeStatus.PARTIAL;
  await manager.save(Charge, charge);
  return excess;
}

const CREDIT_MIN = 0.10; // excedente menor a esto se absorbe sin guardar

/**
 * Aplica un excedente a otras cuotas del propietario (por vencimiento ASC).
 * Si sobra más de EUR 0,10 y no hay más cuotas, lo acumula en creditBalance.
 */
async function cascadeExcess(
  manager: TxManager,
  ownerId: string,
  excess: number,
  currency: PaymentCurrency,
  paymentDate: string | undefined,
  excludeChargeId: string
): Promise<void> {
  if (excess <= CREDIT_MIN) return;

  const others = await manager.find(Charge, {
    where: [
      { property: { owner: { id: ownerId } }, status: ChargeStatus.PENDING },
      { property: { owner: { id: ownerId } }, status: ChargeStatus.PARTIAL },
    ],
    order: { dueDate: "ASC" },
    relations: { property: { owner: true } },
  });

  let remaining = excess;
  for (const charge of others) {
    if (charge.id === excludeChargeId) continue;
    if (remaining <= CREDIT_MIN) break;
    remaining = await applyPaymentToCharge(manager, charge, remaining, currency, paymentDate);
  }

  // Si queda más de EUR 0,10 sin cuotas donde aplicarlo → saldo a favor
  if (remaining > CREDIT_MIN) {
    const user = await manager.findOneBy(User, { id: ownerId });
    if (user) {
      user.creditBalance = Math.round((Number(user.creditBalance ?? 0) + remaining) * 100) / 100;
      await manager.save(User, user);
    }
  }
}

/**
 * Aplica el saldo a favor del propietario a sus cuotas pendientes (por vencimiento ASC).
 * Llamado automáticamente al generar nuevas cuotas.
 */
export async function applyCreditBalance(manager: TxManager, ownerId: string): Promise<void> {
  const user = await manager.findOneBy(User, { id: ownerId });
  if (!user || Number(user.creditBalance) <= CREDIT_MIN) return;

  const pending = await manager.find(Charge, {
    where: [
      { property: { owner: { id: ownerId } }, status: ChargeStatus.PENDING },
      { property: { owner: { id: ownerId } }, status: ChargeStatus.PARTIAL },
    ],
    order: { dueDate: "ASC" },
    relations: { property: { owner: true } },
  });

  let credit = Number(user.creditBalance);
  for (const charge of pending) {
    if (credit <= CREDIT_MIN) break;
    // Crédito en EUR sin mora (ya se pagó antes)
    credit = await applyPaymentToCharge(manager, charge, credit, PaymentCurrency.DIVISAS, undefined);
  }

  user.creditBalance = Math.round(Math.max(0, credit) * 100) / 100;
  await manager.save(User, user);
}

export const PaymentService = {
  async create(userId: string, input: CreatePaymentInput): Promise<Payment> {
    const charge = await chargeRepo().findOne({
      where: { id: input.chargeId },
      relations: { property: { owner: true } },
    });
    if (!charge) throw new HttpError(404, "Cuota no encontrada");

    if (charge.property.owner.id !== userId) {
      throw new HttpError(403, "No puedes pagar la cuota de otra propiedad");
    }
    if (charge.status === ChargeStatus.PAID) {
      throw new HttpError(409, "Esta cuota ya está pagada");
    }
    if (charge.status === ChargeStatus.EXONERATED) {
      throw new HttpError(409, "Esta cuota fue exonerada");
    }

    // Evitar registro duplicado: misma referencia bancaria ya existe (PENDING o CONFIRMED).
    const duplicate = await paymentRepo().findOne({
      where: [
        { reference: input.reference, status: PaymentStatus.PENDING },
        { reference: input.reference, status: PaymentStatus.CONFIRMED },
      ],
    });
    if (duplicate) {
      throw new HttpError(
        409,
        "Ya existe un pago registrado con esa referencia bancaria. " +
          "Si crees que es un error, contacta al administrador."
      );
    }

    // Para cuotas PARTIAL, amountDue ya devuelve el saldo restante.
    // Se usa la fecha del pago del cliente para decidir si la mora aplica.
    let amount = amountDue(charge, input.currency, input.paymentDate);

    let exchangeRate: number | null = null;
    let amountBs: number | null = null;
    if (input.currency === PaymentCurrency.BS) {
      const rate = await getRateForDate(input.paymentDate);
      exchangeRate = rate.rate;
      if (input.amountBs && input.amountBs > 0) {
        // Usar el monto real que el cliente transfirió; recalcular EUR desde Bs.
        amountBs = Math.round(input.amountBs * 100) / 100;
        amount = Math.round((amountBs / rate.rate) * 100) / 100;
      } else {
        amountBs = Math.round(amount * rate.rate * 100) / 100;
      }
    }

    const payment = paymentRepo().create({
      property: charge.property,
      submittedBy: { id: userId } as User,
      charge,
      amount,
      currency: input.currency,
      exchangeRate,
      amountBs,
      bank: input.bank,
      reference: input.reference,
      paymentDate: input.paymentDate,
      status: PaymentStatus.PENDING,
    });

    const saved = await paymentRepo().save(payment);
    await ReconciliationService.tryAutoConfirm(saved);
    return PaymentService.getById(saved.id);
  },

  async listForOwner(userId: string): Promise<Payment[]> {
    return paymentRepo().find({
      where: { submittedBy: { id: userId } },
      order: { createdAt: "DESC" },
      relations: { receipt: true },
    });
  },

  async listPending(): Promise<Payment[]> {
    return paymentRepo().find({
      where: { status: PaymentStatus.PENDING },
      order: { createdAt: "ASC" },
    });
  },

  async listAll(status?: PaymentStatus): Promise<Payment[]> {
    return paymentRepo().find({
      where: status ? { status } : undefined,
      order: { createdAt: "DESC" },
      relations: { receipt: true },
    });
  },

  async getById(id: string): Promise<Payment> {
    const payment = await paymentRepo().findOne({
      where: { id },
      relations: { receipt: true },
    });
    if (!payment) throw new HttpError(404, "Pago no encontrado");
    return payment;
  },

  /** Confirma un pago usando el monto registrado por el cliente. */
  async confirm(paymentId: string, adminId: string | null): Promise<Receipt> {
    const receipt = await AppDataSource.transaction(async (manager) => {
      const payment = await manager.findOne(Payment, {
        where: { id: paymentId },
        relations: { receipt: true, charge: true, property: { owner: true } },
      });
      if (!payment) throw new HttpError(404, "Pago no encontrado");
      if (payment.status === PaymentStatus.CONFIRMED) {
        throw new HttpError(409, "El pago ya fue confirmado");
      }

      payment.status = PaymentStatus.CONFIRMED;
      if (adminId) payment.reviewedBy = { id: adminId } as User;
      payment.reviewedAt = new Date();
      payment.rejectReason = undefined;
      await manager.save(payment);

      if (payment.charge) {
        const excess = await applyPaymentToCharge(manager, payment.charge, Number(payment.amount), payment.currency, payment.paymentDate);
        if (excess > 0.01 && payment.property?.owner?.id) {
          await cascadeExcess(manager, payment.property.owner.id, excess, payment.currency, payment.paymentDate, payment.charge.id);
        }
      }

      // Marcar la entrada bancaria como casada con este pago.
      const bankEntry = await AppDataSource.getRepository(BankEntry).findOneBy({
        referencia: normalizeRef(payment.reference),
      });
      if (bankEntry && !bankEntry.matched) {
        bankEntry.matched = true;
        await AppDataSource.getRepository(BankEntry).save(bankEntry);
      }

      // Recibo solo cuando la cuota queda completamente PAGADA
      if (!payment.charge || payment.charge.status !== ChargeStatus.PAID) {
        return null as unknown as Receipt;
      }

      const prefix = await SettingsService.get("receipt_prefix");
      const count  = await manager.count(Receipt);
      const receiptNumber = `${prefix}-${String(count + 1).padStart(4, "0")}`;

      const rec = manager.create(Receipt, {
        payment,
        receiptNumber,
        issuedBy: { id: adminId } as User,
      });

      return manager.save(rec);
    });

    return receipt;
  },

  /**
   * Confirma con el monto real del banco (en Bs). Convierte a EUR usando la
   * tasa almacenada en el pago. Usado cuando referencia coincide pero el
   * monto difiere — el admin acepta el abono como válido (puede quedar PARTIAL).
   */
  async confirmPartial(
    paymentId: string,
    bankAmountBs: number,
    adminId: string | null
  ): Promise<Receipt> {
    return AppDataSource.transaction(async (manager) => {
      const payment = await manager.findOne(Payment, {
        where: { id: paymentId },
        relations: { receipt: true, charge: true, property: { owner: true } },
      });
      if (!payment) throw new HttpError(404, "Pago no encontrado");
      if (payment.status === PaymentStatus.CONFIRMED) {
        throw new HttpError(409, "El pago ya fue confirmado");
      }

      // Convertir monto banco (Bs) a EUR usando la tasa que tenía el pago.
      // Si el pago era en divisas, el bankAmountBs se trata directamente como EUR.
      let eurAmount: number;
      if (payment.currency === PaymentCurrency.BS && Number(payment.exchangeRate) > 0) {
        eurAmount = Math.round((bankAmountBs / Number(payment.exchangeRate)) * 100) / 100;
        payment.amountBs = Math.round(bankAmountBs * 100) / 100;
      } else {
        eurAmount = Math.round(bankAmountBs * 100) / 100;
      }
      payment.amount = eurAmount;
      payment.status = PaymentStatus.CONFIRMED;
      if (adminId) payment.reviewedBy = { id: adminId } as User;
      payment.reviewedAt = new Date();
      payment.rejectReason = undefined;
      await manager.save(payment);

      if (payment.charge) {
        const excess = await applyPaymentToCharge(manager, payment.charge, eurAmount, payment.currency, payment.paymentDate);
        if (excess > 0.01 && payment.property?.owner?.id) {
          await cascadeExcess(manager, payment.property.owner.id, excess, payment.currency, payment.paymentDate, payment.charge.id);
        }
      }

      if (!payment.charge || payment.charge.status !== ChargeStatus.PAID) {
        return null as unknown as Receipt;
      }

      const prefix = await SettingsService.get("receipt_prefix");
      const count  = await manager.count(Receipt);
      const receiptNumber = `${prefix}-${String(count + 1).padStart(4, "0")}`;

      const receipt = manager.create(Receipt, {
        payment,
        receiptNumber,
        issuedBy: { id: adminId } as User,
      });
      return manager.save(receipt);
    });
  },

  async reject(paymentId: string, adminId: string, reason: string): Promise<Payment> {
    const payment = await this.getById(paymentId);
    if (payment.status === PaymentStatus.CONFIRMED) {
      throw new HttpError(409, "No se puede rechazar un pago confirmado");
    }
    payment.status = PaymentStatus.REJECTED;
    payment.reviewedBy = { id: adminId } as User;
    payment.reviewedAt = new Date();
    payment.rejectReason = reason;
    return paymentRepo().save(payment);
  },

  /** Elimina un pago. Si estaba confirmado, revierte la cuota directa y las cascadas. */
  async delete(paymentId: string): Promise<void> {
    return AppDataSource.transaction(async (manager) => {
      const payment = await manager.findOne(Payment, {
        where: { id: paymentId },
        relations: { charge: true, receipt: true, property: { owner: true } },
      });
      if (!payment) throw new HttpError(404, "Pago no encontrado");

      if (payment.status === PaymentStatus.CONFIRMED && payment.charge) {
        const charge = payment.charge;

        // Calcular mora vigente en la fecha del pago original
        const ref = payment.paymentDate
          ? new Date(payment.paymentDate).setHours(0, 0, 0, 0)
          : new Date().setHours(0, 0, 0, 0);
        const overdueAtPayment = new Date(charge.dueDate).getTime() < ref;
        const moraApplies =
          overdueAtPayment &&
          payment.currency !== PaymentCurrency.DIVISAS &&
          Number(charge.moraAmount) > 0;
        const totalExpected =
          Number(charge.amount) + (moraApplies ? Number(charge.moraAmount) : 0);

        // Cuánto fue aplicado a la cuota directa (tope en lo que se debía)
        const directApplied = Math.min(Number(payment.amount), totalExpected);
        const excess = Math.round(Math.max(0, Number(payment.amount) - directApplied) * 100) / 100;

        charge.amountPaid = Math.max(
          0,
          Math.round((Number(charge.amountPaid) - directApplied) * 100) / 100
        );
        charge.status = charge.amountPaid > 0 ? ChargeStatus.PARTIAL : ChargeStatus.PENDING;
        await manager.save(Charge, charge);

        // Revertir las cuotas que recibieron crédito en cascada
        if (excess > CREDIT_MIN && payment.property?.owner?.id) {
          const ownerId = payment.property.owner.id;
          const cascaded = await manager.find(Charge, {
            where: [
              { property: { owner: { id: ownerId } }, status: ChargeStatus.PARTIAL },
              { property: { owner: { id: ownerId } }, status: ChargeStatus.PENDING },
              { property: { owner: { id: ownerId } }, status: ChargeStatus.PAID },
            ],
            order: { dueDate: "ASC" },
            relations: { property: { owner: true } },
          });

          let remaining = excess;
          for (const cc of cascaded) {
            if (cc.id === charge.id || remaining <= CREDIT_MIN) continue;
            const toReverse = Math.min(remaining, Number(cc.amountPaid));
            if (toReverse <= CREDIT_MIN) continue;
            cc.amountPaid = Math.round((Number(cc.amountPaid) - toReverse) * 100) / 100;
            cc.status = cc.amountPaid > CREDIT_MIN ? ChargeStatus.PARTIAL : ChargeStatus.PENDING;
            await manager.save(Charge, cc);
            remaining = Math.round((remaining - toReverse) * 100) / 100;
          }

          // Si queda por revertir, descontar del creditBalance
          if (remaining > CREDIT_MIN) {
            const user = await manager.findOneBy(User, { id: ownerId });
            if (user) {
              user.creditBalance = Math.max(0, Math.round((Number(user.creditBalance) - remaining) * 100) / 100);
              await manager.save(User, user);
            }
          }
        }
      }

      // Liberar la entrada bancaria que estaba casada con este pago
      if (payment.status === PaymentStatus.CONFIRMED) {
        const bankEntry = await AppDataSource.getRepository(BankEntry).findOneBy({
          referencia: normalizeRef(payment.reference),
        });
        if (bankEntry?.matched) {
          bankEntry.matched = false;
          await AppDataSource.getRepository(BankEntry).save(bankEntry);
        }
      }

      if (payment.receipt) {
        await manager.remove(Receipt, payment.receipt);
      }

      await manager.remove(Payment, payment);
    });
  },

  async getReceipt(paymentId: string, requesterId: string, isAdmin: boolean) {
    const receipt = await receiptRepo().findOne({
      where: { payment: { id: paymentId } },
      relations: { payment: { submittedBy: true, property: true, charge: true } },
    });
    if (!receipt) throw new HttpError(404, "Recibo no disponible aún");
    if (!isAdmin && receipt.payment.submittedBy.id !== requesterId) {
      throw new HttpError(403, "No autorizado");
    }
    return receipt;
  },
};
