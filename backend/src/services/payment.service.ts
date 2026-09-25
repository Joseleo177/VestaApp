import { EntityManager, In } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { Payment, PaymentStatus, PaymentCurrency } from "../models/Payment";
import { Charge, ChargeStatus } from "../models/Charge";
import { PaymentApplication } from "../models/PaymentApplication";
import { PaymentTarget } from "../models/PaymentTarget";
import { Receipt } from "../models/Receipt";
import { BankEntry } from "../models/BankEntry";
import { User } from "../models/User";
import { HttpError } from "../middlewares/error.middleware";
import { amountDue, clearWriteOff } from "./charge.service";
import { PropertyService } from "./property.service";
import { getRateConfig, getRateForDate } from "./exchange-rate.service";
import { RateCurrency } from "../models/ExchangeRateRecord";
import { ReconciliationService } from "./reconciliation.service";
import { SettingsService } from "./settings.service";

function normalizeRef(s: string): string {
  return s.trim().replace(/^'+/, "").toLowerCase();
}

const paymentRepo = () => AppDataSource.getRepository(Payment);
const chargeRepo = () => AppDataSource.getRepository(Charge);
const receiptRepo = () => AppDataSource.getRepository(Receipt);

export interface CreatePaymentInput {
  /** Una sola cuota (formulario viejo, import en lote). */
  chargeId?: string;
  /** Varias cuotas pagadas con un mismo pago, p. ej. las de dos departamentos. */
  chargeIds?: string[];
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
 * Aplica hasta `paidAmount` divisas a la cuota, respetando lo que realmente se
 * debe. Retorna el excedente (> 0 si el pago supera la deuda de esta cuota).
 * Solo lo usa el saldo a favor, que no proviene de un pago concreto.
 */
async function applyCreditToCharge(
  manager: TxManager,
  charge: Charge,
  paidAmount: number
): Promise<number> {
  const result = computeApplication(charge, paidAmount, PaymentCurrency.DIVISAS);
  if (charge.status === ChargeStatus.EXONERATED) return result.excess;

  charge.amountPaid = result.amountPaid;
  charge.status = result.status;
  await manager.save(Charge, charge);
  return result.excess;
}

export const CREDIT_MIN = 0.10; // excedente menor a esto se absorbe sin guardar

/** Moneda de tasa de una cuota; las creadas antes del multimoneda son EUR. */
export function chargeRateCurrency(charge: { currency?: RateCurrency | null }): RateCurrency {
  return charge.currency ?? RateCurrency.EUR;
}

export interface PaymentAmounts {
  currency: PaymentCurrency;
  /** Divisas del pago (en Bs: equivalente a la tasa de la cuota destino). */
  amount: number;
  amountBs: number | null;
  paymentDate?: string;
}

export interface Allocation<C> {
  /** Cuotas tocadas, en orden: primero la destino y luego la cascada. */
  steps: { charge: C; app: ChargeApplication }[];
  /** Divisas sobrantes que van al saldo a favor (0 si no supera CREDIT_MIN). */
  credit: number;
}

/**
 * Reparte un pago entre las cuotas que el vecino eligió (`targets`, en orden) y,
 * con el excedente, las demás cuotas abiertas del titular (`others`, ya
 * ordenadas por vencimiento). No toca la base de datos: la confirmación real y
 * la vista previa del import usan la misma aritmética.
 *
 * Un pago en divisas se reparte en divisas, 1 a 1. Un pago en Bs se reparte en
 * bolívares: cada cuota convierte con la tasa de SU moneda (`rates`), porque el
 * excedente de un pago que salda una cuota a tasa $ vale otra cantidad de
 * divisas en una cuota a tasa €. Lo que sobra se valora a la tasa principal.
 */
export function allocatePayment<C extends ChargeLike & { id: string; currency?: RateCurrency | null }>(
  targets: C[],
  others: C[],
  pay: PaymentAmounts,
  rates: Partial<Record<RateCurrency, number>>,
  primary: RateCurrency
): Allocation<C> {
  const steps: Allocation<C>["steps"] = [];
  const targetIds = new Set(targets.map((t) => t.id));
  const queue = [...targets, ...others.filter((c) => !targetIds.has(c.id))];
  const isTarget = (c: C) => targets.includes(c);
  const isOpen = (c: C) =>
    isTarget(c) || c.status === ChargeStatus.PENDING || c.status === ChargeStatus.PARTIAL;
  const round2 = (n: number) => Math.round(n * 100) / 100;
  // La primera cuota elegida siempre se procesa (como con una sola cuota). Las
  // demás elegidas reciben lo que quede, por poco que sea; en la cascada no se
  // reparten migajas por debajo de CREDIT_MIN.
  const exhausted = (c: C, available: number) =>
    c !== targets[0] && available <= (isTarget(c) ? 0.005 : CREDIT_MIN);

  const inBs = pay.currency === PaymentCurrency.BS && Number(pay.amountBs) > 0;

  if (!inBs) {
    let remaining = pay.amount;
    for (const charge of queue) {
      if (!isOpen(charge)) continue;
      if (exhausted(charge, remaining)) break;
      const app = computeApplication(charge, remaining, pay.currency, pay.paymentDate);
      steps.push({ charge, app });
      remaining = app.excess;
    }
    return { steps, credit: remaining > CREDIT_MIN ? round2(remaining) : 0 };
  }

  const rateOf = (currency: RateCurrency): number => {
    const r = rates[currency];
    if (!r || r <= 0) throw new HttpError(502, `Falta la tasa ${currency} del ${pay.paymentDate}`);
    return r;
  };

  let remainingBs = Number(pay.amountBs);
  for (const charge of queue) {
    if (!isOpen(charge)) continue;
    const rate = rateOf(chargeRateCurrency(charge));
    // Redondeado a céntimos: es lo que se guarda en la cuota y en el registro de
    // aplicaciones, y así ambos cuadran al revertir un borrado.
    const available = round2(remainingBs / rate);
    if (exhausted(charge, available)) break;
    const app = computeApplication(charge, available, pay.currency, pay.paymentDate);
    steps.push({ charge, app });
    remainingBs = Math.max(0, remainingBs - app.applied * rate);
  }

  const credit = remainingBs > 0 ? round2(remainingBs / rateOf(primary)) : 0;
  return { steps, credit: credit > CREDIT_MIN ? credit : 0 };
}

/**
 * Tasas para repartir un pago en Bs. La de la moneda con que se registró el pago
 * es la congelada en él; la otra se busca para la fecha del pago, y solo si
 * hay cuotas a esa tasa o es la principal (donde se valora el sobrante).
 */
async function ratesForPayment(
  payment: { exchangeRate?: number | null; rateCurrency?: RateCurrency | null; paymentDate: string },
  charges: { currency?: RateCurrency | null }[],
  primary: RateCurrency
): Promise<Partial<Record<RateCurrency, number>>> {
  const frozenCurrency = payment.rateCurrency ?? RateCurrency.EUR;
  const rates: Partial<Record<RateCurrency, number>> = {};
  if (Number(payment.exchangeRate) > 0) rates[frozenCurrency] = Number(payment.exchangeRate);

  const needed = new Set<RateCurrency>([primary, ...charges.map(chargeRateCurrency)]);
  for (const currency of needed) {
    if (rates[currency]) continue;
    rates[currency] = (await getRateForDate(payment.paymentDate, currency)).rate;
  }
  return rates;
}

/** Cuotas elegidas de un pago, en orden. Los pagos sin `targets` tienen solo `charge`. */
function paymentTargets(payment: Payment): Charge[] {
  if (payment.targets?.length) {
    return [...payment.targets]
      .sort((a, b) => a.position - b.position)
      .map((t) => t.charge)
      .filter((c): c is Charge => !!c);
  }
  return payment.charge ? [payment.charge] : [];
}

/**
 * Aplica un pago confirmado: salda las cuotas elegidas, reparte el excedente en
 * cascada sobre las demás cuotas abiertas del titular y deja el sobrante como
 * saldo a favor. Registra cuánto aportó a cada cuota (`PaymentApplication`) y
 * al saldo a favor (`creditAmount`) para poder revertirlo exacto.
 * Devuelve las cuotas que este pago dejó PAID (elegidas y de cascada), en orden.
 * Requiere `payment.targets.charge`, `payment.charge` y `payment.property.owner`.
 */
async function settlePayment(manager: TxManager, payment: Payment): Promise<Charge[]> {
  const targets = paymentTargets(payment);
  if (targets.length === 0) return [];
  const ownerId = payment.property?.owner?.id;

  const others = ownerId
    ? await manager.find(Charge, {
        where: [
          { property: { owner: { id: ownerId } }, status: ChargeStatus.PENDING },
          { property: { owner: { id: ownerId } }, status: ChargeStatus.PARTIAL },
        ],
        // Los desempates hacen falta: un mismo período puede traer varias cuotas
        // (asociación, luz, agua…) y sin orden definido la cascada cerraría unas u
        // otras según el humor de Postgres.
        order: { dueDate: "ASC", period: "ASC", description: "ASC" },
      })
    : [];

  const { primary } = await getRateConfig();
  const rates =
    payment.currency === PaymentCurrency.BS
      ? await ratesForPayment(payment, [...targets, ...others], primary)
      : {};

  const { steps, credit } = allocatePayment(
    targets,
    others,
    {
      currency: payment.currency,
      amount: Number(payment.amount),
      amountBs: payment.amountBs != null ? Number(payment.amountBs) : null,
      paymentDate: payment.paymentDate,
    },
    rates,
    primary
  );

  const settled: Charge[] = [];
  for (const { charge, app } of steps) {
    if (charge.status === ChargeStatus.EXONERATED) continue;
    const wasPaid = charge.status === ChargeStatus.PAID;
    charge.amountPaid = app.amountPaid;
    charge.status = app.status;
    await manager.save(Charge, charge);
    if (app.applied > 0) {
      await manager.save(
        PaymentApplication,
        manager.create(PaymentApplication, { payment, charge, amount: app.applied })
      );
    }
    if (!wasPaid && charge.status === ChargeStatus.PAID) settled.push(charge);
  }

  // Sin titular no hay a quién abonar el sobrante: se pierde, como antes.
  payment.creditAmount = ownerId ? credit : 0;
  if (credit > 0 && ownerId) {
    const user = await manager.findOneBy(User, { id: ownerId });
    if (user) {
      user.creditBalance = Math.round((Number(user.creditBalance ?? 0) + credit) * 100) / 100;
      await manager.save(User, user);
    }
  }
  await manager.save(Payment, payment);

  return settled;
}

/**
 * Un pago emite UN recibo con todas las cuotas que dejó saldadas (las elegidas
 * y las que cerró en cascada), aunque sean de departamentos distintos. Un pago
 * que no salda ninguna —un abono parcial— no emite recibo, como siempre.
 */
async function issueReceipt(
  manager: TxManager,
  payment: Payment,
  settled: Charge[],
  adminId: string | null
): Promise<Receipt | null> {
  if (settled.length === 0) return null;
  const prefix = await SettingsService.get("receipt_prefix");
  const num = await SettingsService.nextReceiptNumber();
  const receipt = await manager.save(
    manager.create(Receipt, {
      payment,
      charge: settled[0],
      receiptNumber: `${prefix}-${String(num).padStart(8, "0")}`,
      issuedBy: { id: adminId } as User,
    })
  );
  for (const charge of settled) {
    charge.coveringReceipt = receipt;
    await manager.save(Charge, charge);
  }
  return receipt;
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
    // Crédito en divisas sin mora (ya se pagó antes)
    credit = await applyCreditToCharge(manager, charge, credit);
  }

  user.creditBalance = Math.round(Math.max(0, credit) * 100) / 100;
  await manager.save(User, user);
}

import { UserRole } from "../models/User";

/** Tope de cuotas por pago: sobra para dos departamentos con meses atrasados. */
const MAX_CHARGES_PER_PAYMENT = 36;

export const PaymentService = {
  async create(userId: string, input: CreatePaymentInput, userRole?: UserRole): Promise<Payment> {
    const ids = [...new Set(input.chargeIds?.length ? input.chargeIds : input.chargeId ? [input.chargeId] : [])];
    if (ids.length === 0) throw new HttpError(400, "Selecciona al menos una cuota");
    if (ids.length > MAX_CHARGES_PER_PAYMENT) {
      throw new HttpError(400, `Un pago puede cubrir hasta ${MAX_CHARGES_PER_PAYMENT} cuotas`);
    }

    const found = await chargeRepo().find({
      where: { id: In(ids) },
      relations: { property: { owner: true, authorized: true } },
    });
    if (found.length !== ids.length) throw new HttpError(404, "Cuota no encontrada");

    // Se saldan de la más antigua a la más nueva, con el mismo orden que la
    // cascada: si el monto no alcanza, queda abierta la más reciente.
    const charges = found.sort(
      (a, b) =>
        String(a.dueDate).localeCompare(String(b.dueDate)) ||
        a.period.localeCompare(b.period) ||
        a.description.localeCompare(b.description)
    );

    for (const charge of charges) {
      // Puede pagar el titular o el autorizado del departamento, o un administrador
      const canPay =
        userRole === UserRole.ADMIN ||
        charge.property.owner?.id === userId ||
        charge.property.authorized?.id === userId;
      if (!canPay) {
        throw new HttpError(403, "No puedes pagar la cuota de otra propiedad");
      }
      const label = charges.length > 1 ? ` (${charge.property.code} · ${charge.period})` : "";
      if (charge.status === ChargeStatus.PAID) {
        throw new HttpError(409, `Esta cuota ya está pagada${label}`);
      }
      if (charge.status === ChargeStatus.EXONERATED) {
        throw new HttpError(409, `Esta cuota fue exonerada${label}`);
      }
    }
    const charge = charges[0];

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
    const dues = charges.map((c) => amountDue(c, input.currency, input.paymentDate));
    const round2 = (n: number) => Math.round(n * 100) / 100;
    let amount = round2(dues.reduce((a, b) => a + b, 0));

    let exchangeRate: number | null = null;
    let rateCurrency: RateCurrency | null = null;
    let amountBs: number | null = null;
    if (input.currency === PaymentCurrency.BS) {
      // Cada cuota se convierte con la tasa de SU moneda en la fecha del pago.
      // La que se congela en el pago es la de la primera cuota.
      const rates = new Map<RateCurrency, number>();
      for (const c of charges) {
        const cur = chargeRateCurrency(c);
        if (!rates.has(cur)) rates.set(cur, (await getRateForDate(input.paymentDate, cur)).rate);
      }
      const rateOf = (c: Charge) => rates.get(chargeRateCurrency(c))!;
      rateCurrency = chargeRateCurrency(charge);
      exchangeRate = rateOf(charge);

      if (input.amountBs && input.amountBs > 0) {
        // Usar el monto real que el cliente transfirió; recalcular divisas desde Bs
        // cuota por cuota, y lo que sobre a la tasa de la primera.
        amountBs = round2(input.amountBs);
        let remainingBs = amountBs;
        let divisas = 0;
        charges.forEach((c, i) => {
          const covered = Math.min(dues[i], remainingBs / rateOf(c));
          divisas += covered;
          remainingBs = Math.max(0, remainingBs - covered * rateOf(c));
        });
        amount = round2(divisas + remainingBs / exchangeRate);
      } else {
        amountBs = round2(charges.reduce((sum, c, i) => sum + dues[i] * rateOf(c), 0));
      }
    } else if (input.amountEur && input.amountEur > 0) {
      amount = round2(input.amountEur);
    }

    const payment = paymentRepo().create({
      property: charge.property,
      submittedBy: { id: userId } as User,
      charge,
      amount,
      currency: input.currency,
      exchangeRate,
      rateCurrency,
      amountBs,
      bank: input.bank,
      reference: input.reference,
      paymentDate: input.paymentDate,
      status: PaymentStatus.PENDING,
      // Con una sola cuota no hace falta: `charge` ya la dice.
      targets:
        charges.length > 1
          ? charges.map((c, position) => ({ charge: c, position }) as PaymentTarget)
          : [],
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
      relations: { receipts: true, targets: { charge: true }, applications: { charge: true } },
    });
  },

  async listPending(): Promise<Payment[]> {
    return paymentRepo().find({
      where: { status: PaymentStatus.PENDING },
      order: { createdAt: "ASC" },
      // El admin ve todas las cuotas que el vecino eligió pagar.
      relations: { targets: { charge: true } },
    });
  },

  async listAll(status?: PaymentStatus): Promise<Payment[]> {
    return paymentRepo().find({
      where: status ? { status } : undefined,
      order: { createdAt: "DESC" },
      // La cuota de cada recibo revela todas las cuotas que saldó el pago,
      // incluidas las cerradas en cascada con el excedente.
      relations: {
        receipts: { charge: true },
        targets: { charge: true },
        applications: { charge: true },
      },
    });
  },

  async getById(id: string): Promise<Payment> {
    const payment = await paymentRepo().findOne({
      where: { id },
      relations: { receipts: true, targets: { charge: true } },
    });
    if (!payment) throw new HttpError(404, "Pago no encontrado");
    return payment;
  },

  /** Confirma un pago usando el monto registrado por el cliente. */
  async confirm(paymentId: string, adminId: string | null): Promise<Receipt> {
    const receipt = await AppDataSource.transaction(async (manager) => {
      const payment = await manager.findOne(Payment, {
        where: { id: paymentId },
        relations: { receipts: true, charge: true, targets: { charge: true }, property: { owner: true } },
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

      const settled = await settlePayment(manager, payment);

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

      return issueReceipt(manager, payment, settled, adminId) as Promise<Receipt>;
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
        relations: { receipts: true, charge: true, targets: { charge: true }, property: { owner: true } },
      });
      if (!payment) throw new HttpError(404, "Pago no encontrado");
      if (payment.status === PaymentStatus.CONFIRMED) {
        throw new HttpError(409, "El pago ya fue confirmado");
      }

      // Convertir monto banco (Bs) a divisas usando la tasa que tenía el pago.
      // Si el pago era en divisas, el monto se trata directamente como divisas.
      let divisasAmount: number;
      if (payment.currency === PaymentCurrency.BS && Number(payment.exchangeRate) > 0) {
        divisasAmount = Math.round((bankAmountBs / Number(payment.exchangeRate)) * 100) / 100;
        payment.amountBs = Math.round(bankAmountBs * 100) / 100;
      } else {
        divisasAmount = Math.round(bankAmountBs * 100) / 100;
      }
      payment.amount = divisasAmount;
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

      const settled = await settlePayment(manager, payment);

      return issueReceipt(manager, payment, settled, adminId) as Promise<Receipt>;
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
        const writeOffCleared: string[] = [];

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
            // La condonación se decidió sobre este abono: sin él ya no aplica.
            if (Number(charge.writeOffAmount) > 0) { clearWriteOff(charge); writeOffCleared.push(charge.id); }
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
          if (Number(charge.writeOffAmount) > 0) { clearWriteOff(charge); writeOffCleared.push(charge.id); }
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
            if (Number(cc.writeOffAmount) > 0) { clearWriteOff(cc); writeOffCleared.push(cc.id); }
            await manager.save(Charge, cc);
            remaining = Math.round((remaining - toReverse) * 100) / 100;
            reverted = Math.round((reverted + toReverse) * 100) / 100;
          }
        }

        // Una cuota condonada que este borrado reabrió aún apunta al recibo de
        // la condonación si lo emitió otro pago: ese recibo ya no ampara nada.
        const ownReceipts = new Set((payment.receipts ?? []).map((r) => r.id));
        for (const chargeId of writeOffCleared) {
          const c = await manager.findOne(Charge, {
            where: { id: chargeId },
            relations: { coveringReceipt: true },
          });
          const stale = c?.coveringReceipt;
          if (!c || !stale || ownReceipts.has(stale.id)) continue;
          c.coveringReceipt = null;
          await manager.save(Charge, c);
          await manager.remove(Receipt, stale);
        }

        // Lo que el pago no dejó en ninguna cuota había ido al saldo a favor.
        // Los pagos nuevos lo registran; en los anteriores se deduce del monto
        // (entonces todo iba a una sola tasa). Se descuenta con tope en cero: si
        // el titular ya lo gastó en cuotas nuevas, preferimos quedarnos cortos
        // antes que dejarle saldo negativo.
        const toCredit =
          payment.creditAmount != null
            ? Number(payment.creditAmount)
            : Math.round((Number(payment.amount) - reverted) * 100) / 100;
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

    // Cuotas que ampara el recibo: todas las que el pago saldó. Los recibos
    // anteriores al cambio amparan una sola (la suya).
    const covered = await chargeRepo().find({
      where: { coveringReceipt: { id: receipt.id } },
      relations: { property: { tower: true, owner: true, authorized: true } },
      order: { dueDate: "ASC", period: "ASC", description: "ASC" },
    });
    const charges = covered.length
      ? covered
      : [receipt.charge ?? receipt.payment.charge].filter((c): c is Charge => !!c);

    // Lo descarga quien registró el pago, o el titular o el autorizado de
    // cualquiera de los departamentos que ampara.
    const properties = [receipt.payment.property, ...charges.map((c) => c.property)];
    const allowed =
      receipt.payment.submittedBy?.id === requesterId ||
      properties.some((p) => p?.owner?.id === requesterId || p?.authorized?.id === requesterId);
    if (!isAdmin && !allowed) {
      throw new HttpError(403, "No autorizado");
    }

    // En pagos en Bs cada cuota se valora a la tasa de su moneda: la congelada
    // en el pago o, para la otra moneda, la de la fecha del pago.
    const p = receipt.payment;
    const rates = new Map<RateCurrency, number>();
    if (p.currency === PaymentCurrency.BS && Number(p.exchangeRate) > 0) {
      rates.set(p.rateCurrency ?? RateCurrency.EUR, Number(p.exchangeRate));
    }
    const lines: { charge: Charge; bsRate: number | null }[] = [];
    for (const charge of charges) {
      let bsRate: number | null = null;
      if (p.currency === PaymentCurrency.BS) {
        const cur = chargeRateCurrency(charge);
        if (!rates.has(cur)) rates.set(cur, (await getRateForDate(p.paymentDate, cur)).rate);
        bsRate = rates.get(cur)!;
      }
      lines.push({ charge, bsRate });
    }
    return { receipt, lines };
  },
};
