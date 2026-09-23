import { EntityManager, In } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { Payment, PaymentStatus, PaymentCurrency } from "../models/Payment";
import { Charge, ChargeStatus } from "../models/Charge";
import { PaymentApplication } from "../models/PaymentApplication";
import { Receipt } from "../models/Receipt";
import { BankEntry } from "../models/BankEntry";
import { User } from "../models/User";
import { HttpError } from "../middlewares/error.middleware";
import { amountDue } from "./charge.service";
import { PropertyService } from "./property.service";
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
  /**
   * Monto real en EUR (solo pagos en divisas). El formulario nunca lo envía —
   * ahí cada pago salda una cuota completa — pero la carga en lote sí, porque
   * un histórico puede traer un pago en efectivo que cubrió varios meses.
   */
  amountEur?: number;
}

type TxManager = EntityManager;

/** Lo mínimo que necesita `computeApplication`: sirve para una cuota real o simulada. */
export interface ChargeLike {
  amount: number | string;
  moraAmount: number | string;
  amountPaid?: number | string | null;
  dueDate: string;
  status: ChargeStatus;
}

export interface ChargeApplication {
  /** EUR que efectivamente absorbe la cuota. */
  applied: number;
  /** EUR sobrantes, que van a la cascada o al saldo a favor. */
  excess: number;
  amountPaid: number;
  status: ChargeStatus;
}

/**
 * Aritmética pura de aplicar un pago a una cuota. No toca la base de datos, así
 * que la vista previa del import en lote puede simular exactamente lo mismo que
 * hará la confirmación real sin arriesgarse a divergir.
 */
export function computeApplication(
  charge: ChargeLike,
  paidAmount: number,
  currency: PaymentCurrency,
  paymentDate?: string
): ChargeApplication {
  const alreadyPaid = Number(charge.amountPaid ?? 0);

  if (charge.status === ChargeStatus.EXONERATED) {
    return {
      applied: 0,
      excess: paidAmount,
      amountPaid: alreadyPaid,
      status: ChargeStatus.EXONERATED,
    };
  }

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

  const stillOwed = Math.max(0, Math.round((totalExpected - alreadyPaid) * 100) / 100);
  const applied = Math.min(paidAmount, stillOwed);
  const excess = Math.round(Math.max(0, paidAmount - applied) * 100) / 100;
  const amountPaid = Math.round((alreadyPaid + applied) * 100) / 100;

  return {
    applied,
    excess,
    amountPaid,
    status:
      amountPaid >= totalExpected - 0.01 ? ChargeStatus.PAID : ChargeStatus.PARTIAL,
  };
}

/**
 * Aplica hasta `paidAmount` EUR a la cuota, respetando lo que realmente se debe.
 * Retorna el excedente (> 0 si el pago supera la deuda de esta cuota).
 *
 * `payment` es opcional porque aplicar el saldo a favor no proviene de un pago
 * concreto; cuando viene, se deja constancia de cuánto aportó a esta cuota para
 * poder revertirlo con exactitud si el pago se borra.
 */
async function applyPaymentToCharge(
  manager: TxManager,
  charge: Charge,
  paidAmount: number,
  currency: PaymentCurrency,
  paymentDate?: string,
  payment?: Payment
): Promise<number> {
  const result = computeApplication(charge, paidAmount, currency, paymentDate);
  if (charge.status === ChargeStatus.EXONERATED) return result.excess;

  charge.amountPaid = result.amountPaid;
  charge.status = result.status;
  await manager.save(Charge, charge);

  if (payment && result.applied > 0) {
    await manager.save(
      PaymentApplication,
      manager.create(PaymentApplication, { payment, charge, amount: result.applied })
    );
  }
  return result.excess;
}

export const CREDIT_MIN = 0.10; // excedente menor a esto se absorbe sin guardar

/**
 * Aplica un excedente a otras cuotas del propietario (por vencimiento ASC).
 * Si sobra más de EUR 0,10 y no hay más cuotas, lo acumula en creditBalance.
 * Devuelve la lista de cuotas que quedaron PAID durante esta cascada.
 */
async function cascadeExcess(
  manager: TxManager,
  ownerId: string,
  excess: number,
  currency: PaymentCurrency,
  paymentDate: string | undefined,
  excludeChargeId: string,
  payment?: Payment
): Promise<Charge[]> {
  if (excess <= CREDIT_MIN) return [];

  const others = await manager.find(Charge, {
    where: [
      { property: { owner: { id: ownerId } }, status: ChargeStatus.PENDING },
      { property: { owner: { id: ownerId } }, status: ChargeStatus.PARTIAL },
    ],
    // Los desempates hacen falta: un mismo período puede traer varias cuotas
    // (asociación, luz, agua…) y sin orden definido la cascada cerraría unas u
    // otras según el humor de Postgres.
    order: { dueDate: "ASC", period: "ASC", description: "ASC" },
    relations: { property: { owner: true } },
  });

  let remaining = excess;
  const cascadePaid: Charge[] = [];
  for (const charge of others) {
    if (charge.id === excludeChargeId) continue;
    if (remaining <= CREDIT_MIN) break;
    remaining = await applyPaymentToCharge(manager, charge, remaining, currency, paymentDate, payment);
    if (charge.status === ChargeStatus.PAID) {
      cascadePaid.push(charge);
    }
  }

  // Si queda más de EUR 0,10 sin cuotas donde aplicarlo → saldo a favor
  if (remaining > CREDIT_MIN) {
    const user = await manager.findOneBy(User, { id: ownerId });
    if (user) {
      user.creditBalance = Math.round((Number(user.creditBalance ?? 0) + remaining) * 100) / 100;
      await manager.save(User, user);
    }
  }

  return cascadePaid;
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

import { UserRole } from "../models/User";

export const PaymentService = {
  async create(userId: string, input: CreatePaymentInput, userRole?: UserRole): Promise<Payment> {
    const charge = await chargeRepo().findOne({
      where: { id: input.chargeId },
      relations: { property: { owner: true, authorized: true } },
    });
    if (!charge) throw new HttpError(404, "Cuota no encontrada");

    // Puede pagar el titular o el autorizado del departamento, o un administrador
    const canPay =
      userRole === UserRole.ADMIN ||
      charge.property.owner?.id === userId ||
      charge.property.authorized?.id === userId;
    if (!canPay) {
      throw new HttpError(403, "No puedes pagar la cuota de otra propiedad");
    }
    if (charge.status === ChargeStatus.PAID) {
      throw new HttpError(409, "Esta cuota ya está pagada");
    }
    if (charge.status === ChargeStatus.EXONERATED) {
      throw new HttpError(409, "Esta cuota fue exonerada");
    }

    // Evitar registro duplicado: misma referencia bancaria ya existe (PENDING o CONFIRMED).
    // Se omite para pagos en efectivo (referencia vacía).
    if (input.reference && input.reference.trim().length > 0) {
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
    } else if (input.amountEur && input.amountEur > 0) {
      amount = Math.round(input.amountEur * 100) / 100;
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

  /**
   * Historial de las unidades que el usuario gestiona (como titular o como
   * autorizado), no solo de los pagos que él mismo registró: titular y
   * autorizado ven el mismo movimiento del departamento.
   */
  async listForUser(userId: string): Promise<Payment[]> {
    const propertyIds = await PropertyService.accessiblePropertyIds(userId);
    if (propertyIds.length === 0) return [];
    return paymentRepo().find({
      where: { property: { id: In(propertyIds) } },
      order: { createdAt: "DESC" },
      relations: { receipts: true },
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
      // La cuota de cada recibo revela todas las cuotas que saldó el pago,
      // incluidas las cerradas en cascada con el excedente.
      relations: { receipts: { charge: true } },
    });
  },

  async getById(id: string): Promise<Payment> {
    const payment = await paymentRepo().findOne({
      where: { id },
      relations: { receipts: true },
    });
    if (!payment) throw new HttpError(404, "Pago no encontrado");
    return payment;
  },

  /** Confirma un pago usando el monto registrado por el cliente. */
  async confirm(paymentId: string, adminId: string | null): Promise<Receipt> {
    const receipt = await AppDataSource.transaction(async (manager) => {
      const payment = await manager.findOne(Payment, {
        where: { id: paymentId },
        relations: { receipts: true, charge: true, property: { owner: true } },
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

      let cascadePaid: Charge[] = [];
      if (payment.charge) {
        const excess = await applyPaymentToCharge(manager, payment.charge, Number(payment.amount), payment.currency, payment.paymentDate, payment);
        if (excess > 0.01 && payment.property?.owner?.id) {
          cascadePaid = await cascadeExcess(manager, payment.property.owner.id, excess, payment.currency, payment.paymentDate, payment.charge.id, payment);
        }
      }

      // Marcar la entrada bancaria como casada con este pago (sufijo o exacta).
      const ref = normalizeRef(payment.reference);
      const bankEntry = await manager.getRepository(BankEntry)
        .createQueryBuilder("be")
        .where("be.matched = false")
        .andWhere("(be.referencia = :ref OR be.referencia LIKE :suffix)", {
          ref,
          suffix: `%${ref}`,
        })
        .getOne();
      if (bankEntry) {
        bankEntry.matched = true;
        await manager.save(BankEntry, bankEntry);
      }

      // Recibo solo cuando la cuota queda completamente PAGADA
      if (!payment.charge || payment.charge.status !== ChargeStatus.PAID) {
        return null as unknown as Receipt;
      }

      const prefix = await SettingsService.get("receipt_prefix");

      // Recibo principal (cuota directa del pago)
      const mainNum = await SettingsService.nextReceiptNumber();
      const mainReceipt = manager.create(Receipt, {
        payment,
        charge: payment.charge,
        receiptNumber: `${prefix}-${String(mainNum).padStart(8, "0")}`,
        issuedBy: { id: adminId } as User,
      });
      const savedMain = await manager.save(mainReceipt);
      payment.charge.coveringReceipt = savedMain;
      await manager.save(Charge, payment.charge);

      // Recibo individual para cada cuota cerrada por cascada
      for (const cc of cascadePaid) {
        const cascNum = await SettingsService.nextReceiptNumber();
        const cascReceipt = manager.create(Receipt, {
          payment,
          charge: cc,
          receiptNumber: `${prefix}-${String(cascNum).padStart(8, "0")}`,
          issuedBy: { id: adminId } as User,
        });
        const savedCasc = await manager.save(cascReceipt);
        cc.coveringReceipt = savedCasc;
        await manager.save(Charge, cc);
      }

      return savedMain;
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
        relations: { receipts: true, charge: true, property: { owner: true } },
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

      // Marcar entrada bancaria como casada (sufijo o exacta).
      const refP = normalizeRef(payment.reference);
      const bankEntryP = await manager.getRepository(BankEntry)
        .createQueryBuilder("be")
        .where("be.matched = false")
        .andWhere("(be.referencia = :ref OR be.referencia LIKE :suffix)", {
          ref: refP,
          suffix: `%${refP}`,
        })
        .getOne();
      if (bankEntryP) {
        bankEntryP.matched = true;
        await manager.save(BankEntry, bankEntryP);
      }

      let cascadePaid: Charge[] = [];
      if (payment.charge) {
        const excess = await applyPaymentToCharge(manager, payment.charge, eurAmount, payment.currency, payment.paymentDate, payment);
        if (excess > 0.01 && payment.property?.owner?.id) {
          cascadePaid = await cascadeExcess(manager, payment.property.owner.id, excess, payment.currency, payment.paymentDate, payment.charge.id, payment);
        }
      }

      if (!payment.charge || payment.charge.status !== ChargeStatus.PAID) {
        return null as unknown as Receipt;
      }

      const prefix = await SettingsService.get("receipt_prefix");

      // Recibo principal (cuota directa)
      const mainNum = await SettingsService.nextReceiptNumber();
      const mainReceipt = manager.create(Receipt, {
        payment,
        charge: payment.charge,
        receiptNumber: `${prefix}-${String(mainNum).padStart(8, "0")}`,
        issuedBy: { id: adminId } as User,
      });
      const savedMain = await manager.save(mainReceipt);
      payment.charge.coveringReceipt = savedMain;
      await manager.save(Charge, payment.charge);

      // Recibo individual por cada cuota cerrada en cascada
      for (const cc of cascadePaid) {
        const cascNum = await SettingsService.nextReceiptNumber();
        const cascReceipt = manager.create(Receipt, {
          payment,
          charge: cc,
          receiptNumber: `${prefix}-${String(cascNum).padStart(8, "0")}`,
          issuedBy: { id: adminId } as User,
        });
        const savedCasc = await manager.save(cascReceipt);
        cc.coveringReceipt = savedCasc;
        await manager.save(Charge, cc);
      }

      return savedMain;
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

  /**
   * Elimina un pago. Si estaba confirmado, devuelve a cada cuota exactamente lo
   * que este pago le había aportado (ver `PaymentApplication`) y ajusta el saldo
   * a favor con el remanente.
   */
  async delete(paymentId: string): Promise<void> {
    return AppDataSource.transaction(async (manager) => {
      const payment = await manager.findOne(Payment, {
        where: { id: paymentId },
        relations: { charge: true, receipts: { charge: true }, property: { owner: true } },
      });
      if (!payment) throw new HttpError(404, "Pago no encontrado");

      // Nullear coveringReceipt en las cuotas ANTES de revertir estados
      // (evita FK violation al borrar los recibos más adelante)
      if (payment.receipts?.length) {
        const receiptIds = payment.receipts.map((r) => r.id);
        await manager
          .createQueryBuilder()
          .update(Charge)
          .set({ coveringReceipt: null })
          .where("receipt_id IN (:...receiptIds)", { receiptIds })
          .execute();
      }

      if (payment.status === PaymentStatus.CONFIRMED) {
        // Se devuelve SOLO lo que este pago aportó a cada cuota, según el
        // registro de aplicaciones. Antes se recorrían todas las cuotas del
        // titular restando a ojo, y el borrado le quitaba el dinero a cuotas
        // que había saldado otro pago distinto.
        const applications = await manager.find(PaymentApplication, {
          where: { payment: { id: payment.id } },
          relations: { charge: true },
        });

        let reverted = 0;

        if (applications.length > 0) {
          for (const app of applications) {
            const charge = app.charge;
            const amount = Number(app.amount);
            charge.amountPaid = Math.max(
              0,
              Math.round((Number(charge.amountPaid) - amount) * 100) / 100
            );
            charge.status =
              charge.amountPaid > CREDIT_MIN ? ChargeStatus.PARTIAL : ChargeStatus.PENDING;
            await manager.save(Charge, charge);
            reverted = Math.round((reverted + amount) * 100) / 100;
          }
        } else if (payment.charge) {
          // Pagos confirmados antes de que existiera el registro: se revierte la
          // cuota directa y, de la cascada, solo las cuotas que este pago cerró
          // (las que tienen recibo suyo). Puede quedarse corto con abonos
          // parciales antiguos, pero nunca toca cuotas de otro pago.
          const charge = payment.charge;
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

          const directApplied = Math.min(Number(payment.amount), totalExpected);
          charge.amountPaid = Math.max(
            0,
            Math.round((Number(charge.amountPaid) - directApplied) * 100) / 100
          );
          charge.status =
            charge.amountPaid > CREDIT_MIN ? ChargeStatus.PARTIAL : ChargeStatus.PENDING;
          await manager.save(Charge, charge);
          reverted = directApplied;

          let remaining = Math.round(Math.max(0, Number(payment.amount) - directApplied) * 100) / 100;
          for (const receipt of payment.receipts ?? []) {
            if (remaining <= CREDIT_MIN) break;
            const cc = await manager.findOne(Charge, { where: { id: receipt.charge?.id } });
            if (!cc || cc.id === charge.id) continue;
            const toReverse = Math.min(remaining, Number(cc.amountPaid));
            if (toReverse <= CREDIT_MIN) continue;
            cc.amountPaid = Math.round((Number(cc.amountPaid) - toReverse) * 100) / 100;
            cc.status = cc.amountPaid > CREDIT_MIN ? ChargeStatus.PARTIAL : ChargeStatus.PENDING;
            await manager.save(Charge, cc);
            remaining = Math.round((remaining - toReverse) * 100) / 100;
            reverted = Math.round((reverted + toReverse) * 100) / 100;
          }
        }

        // Lo que el pago no dejó en ninguna cuota había ido al saldo a favor.
        // Se descuenta con tope en cero: si el titular ya lo gastó en cuotas
        // nuevas, preferimos quedarnos cortos antes que dejarle saldo negativo.
        const toCredit = Math.round((Number(payment.amount) - reverted) * 100) / 100;
        if (toCredit > CREDIT_MIN && payment.property?.owner?.id) {
          const user = await manager.findOneBy(User, { id: payment.property.owner.id });
          if (user) {
            user.creditBalance = Math.max(
              0,
              Math.round((Number(user.creditBalance) - toCredit) * 100) / 100
            );
            await manager.save(User, user);
          }
        }
      }

      // Liberar la entrada bancaria que estaba casada con este pago
      if (payment.status === PaymentStatus.CONFIRMED) {
        const refR = normalizeRef(payment.reference);
        const bankEntry = await manager.getRepository(BankEntry)
          .createQueryBuilder("be")
          .where("be.matched = true")
          .andWhere("(be.referencia = :ref OR be.referencia LIKE :suffix)", {
            ref: refR,
            suffix: `%${refR}`,
          })
          .getOne();
        if (bankEntry) {
          bankEntry.matched = false;
          await manager.save(BankEntry, bankEntry);
        }
      }

      if (payment.receipts?.length) {
        await manager.remove(Receipt, payment.receipts);
      }

      await manager.remove(Payment, payment);
    });
  },

  async getReceipt(paymentId: string, requesterId: string, isAdmin: boolean, receiptNumber?: string) {
    // Si se pasa receiptNumber, buscar por número único (más preciso para recibos cascade)
    const where = receiptNumber
      ? { receiptNumber }
      : { payment: { id: paymentId } };
    const receipt = await receiptRepo().findOne({
      where,
      relations: {
        payment: {
          submittedBy: true,
          property: { tower: true, owner: true, authorized: true },
          charge: true,
        },
        charge: { property: { tower: true } },
      },
    });
    if (!receipt) throw new HttpError(404, "Recibo no disponible aún");
    // Lo descarga quien registró el pago, el titular o el autorizado de la unidad.
    const property = receipt.payment.property;
    const allowed =
      receipt.payment.submittedBy?.id === requesterId ||
      property?.owner?.id === requesterId ||
      property?.authorized?.id === requesterId;
    if (!isAdmin && !allowed) {
      throw new HttpError(403, "No autorizado");
    }
    return receipt;
  },
};
