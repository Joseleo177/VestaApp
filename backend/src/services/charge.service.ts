import { AppDataSource } from "../config/data-source";
import { Charge, ChargeStatus, ChargeType } from "../models/Charge";
import { Property } from "../models/Property";
import { PaymentCurrency } from "../models/Payment";
import { RateCurrency, isRateCurrency } from "../models/ExchangeRateRecord";
import { HttpError } from "../middlewares/error.middleware";
import { CREDIT_MIN } from "./payment.service";
import { Payment, PaymentStatus } from "../models/Payment";
import { PaymentTarget } from "../models/PaymentTarget";
import { PaymentApplication } from "../models/PaymentApplication";
import { Receipt } from "../models/Receipt";
import { User } from "../models/User";
import { SettingsService } from "./settings.service";

const repo = () => AppDataSource.getRepository(Charge);

export function isOverdue(charge: Charge, asOfDate?: string): boolean {
  const ref = asOfDate
    ? new Date(asOfDate).setHours(0, 0, 0, 0)
    : new Date().setHours(0, 0, 0, 0);
  return new Date(charge.dueDate).getTime() < ref;
}

/**
 * Monto base de la cuota según la moneda del pago. En Bs puede costar otra cosa
 * (`bsPrice`, p. ej. una promoción por pagar en divisas); sin moneda —la deuda
 * que se muestra— se usa el monto en divisas.
 */
export function baseAmount(
  charge: { amount: number | string; bsPrice?: number | string | null },
  currency?: PaymentCurrency
): number {
  const bs = Number(charge.bsPrice ?? 0);
  return currency === PaymentCurrency.BS && bs > 0 ? bs : Number(charge.amount);
}

/**
 * Monto pendiente de pago de una cuota:
 * - PARTIAL: saldo restante (base − amountPaid), sin mora
 * - PENDING: base + mora si estaba vencida en la fecha de pago (asOfDate) y no es DIVISAS
 * La base depende de la moneda (ver `baseAmount`).
 */
export function amountDue(charge: Charge, currency?: PaymentCurrency, asOfDate?: string): number {
  if (charge.status === ChargeStatus.PAID || charge.status === ChargeStatus.EXONERATED) {
    return 0;
  }
  if (charge.status === ChargeStatus.PARTIAL) {
    const base  = baseAmount(charge, currency);
    const paid  = Number(charge.amountPaid ?? 0);
    const mora  = Number(charge.moraAmount ?? 0);
    // Si hay mora y la cuota está vencida, el pendiente incluye lo que falte de mora
    const moraApplies = mora > 0 && isOverdue(charge, asOfDate) && currency !== PaymentCurrency.DIVISAS;
    const total = base + (moraApplies ? mora : 0);
    return Math.max(0, Math.round((total - paid) * 100) / 100);
  }
  const base = baseAmount(charge, currency);
  const mora = Number(charge.moraAmount);
  const moraApplies =
    isOverdue(charge, asOfDate) && currency !== PaymentCurrency.DIVISAS && mora > 0;
  return Math.round((base + (moraApplies ? mora : 0)) * 100) / 100;
}

/**
 * Quita la condonación de una cuota y le devuelve el estado según lo abonado.
 * Lo usan el revertir explícito y el borrado de un pago de esa cuota (la
 * condonación se decidió sobre ese abono; sin él ya no aplica).
 */
export function clearWriteOff(charge: Charge): void {
  charge.writeOffAmount = 0;
  charge.writeOffReason = null;
  charge.writtenOffAt = null;
  charge.writtenOffBy = null;
  charge.status = Number(charge.amountPaid) > CREDIT_MIN ? ChargeStatus.PARTIAL : ChargeStatus.PENDING;
}

export const ChargeService = {
  /** Cuotas de los departamentos donde el usuario es titular o autorizado. */
  async listForUser(userId: string): Promise<Charge[]> {
    return repo().find({
      where: [
        { property: { owner: { id: userId } } },
        { property: { authorized: { id: userId } } },
      ],
      order: { period: "DESC" },
      relations: {
        payments: { submittedBy: true },
        paymentTargets: { payment: { submittedBy: true } },
        coveringReceipt: { payment: { submittedBy: true } },
        applications: { payment: true },
      },
      // Pagos × cuotas elegidas × aplicaciones en un solo JOIN multiplican las
      // filas; por separado son consultas pequeñas.
      relationLoadStrategy: "query",
    });
  },

  /** Saldo pendiente en divisas: PENDING (con mora) + PARTIAL (saldo restante). */
  async balanceForUser(userId: string): Promise<number> {
    const { total } = await this.balanceBreakdownForUser(userId);
    return total;
  },

  /**
   * Saldo pendiente en divisas, total y separado por moneda de tasa: el
   * equivalente en Bs de cada parte se calcula con una tasa distinta.
   */
  async balanceBreakdownForUser(
    userId: string
  ): Promise<{ total: number; byCurrency: Record<RateCurrency, number> }> {
    const charges = await repo().find({
      where: [
        { property: { owner: { id: userId } }, status: ChargeStatus.PENDING },
        { property: { owner: { id: userId } }, status: ChargeStatus.PARTIAL },
        { property: { authorized: { id: userId } }, status: ChargeStatus.PENDING },
        { property: { authorized: { id: userId } }, status: ChargeStatus.PARTIAL },
      ],
    });
    const byCurrency: Record<RateCurrency, number> = { [RateCurrency.USD]: 0, [RateCurrency.EUR]: 0 };
    let total = 0;
    for (const c of charges) {
      const due = amountDue(c);
      total += due;
      byCurrency[c.currency ?? RateCurrency.EUR] += due;
    }
    const round2 = (n: number) => Math.round(n * 100) / 100;
    return {
      total: round2(total),
      byCurrency: { [RateCurrency.USD]: round2(byCurrency.USD), [RateCurrency.EUR]: round2(byCurrency.EUR) },
    };
  },

  async listPeriods(): Promise<
    {
      period: string;
      type: ChargeType;
      count: number;
      total: number;
      hasSpecial: boolean;
      /** Monedas de tasa presentes en el lote (dos si se mezclaron). */
      currencies: RateCurrency[];
      /** Avance de la cobranza del lote (lo exonerado no cuenta: no se cobra). */
      progress: { billable: number; collected: number; paid: number; open: number; overdue: number; exonerated: number };
    }[]
  > {
    // La cobranza de cada lote se agrega aquí mismo. Antes la pantalla de Cobros
    // pedía todas las cuotas de cada período (con sus pagos) solo para sumarlas, y
    // con muchos departamentos y meses tardaba varios segundos en cargar.
    const open = `charge.status IN ('${ChargeStatus.PENDING}', '${ChargeStatus.PARTIAL}')`;
    const rows = await repo()
      .createQueryBuilder("charge")
      .select("charge.period", "period")
      .addSelect("charge.type", "type")
      .addSelect("COUNT(*)", "count")
      .addSelect("COALESCE(SUM(charge.amount), 0)", "total")
      .addSelect("STRING_AGG(DISTINCT charge.currency, ',')", "currencies")
      .addSelect(`COALESCE(SUM(CASE WHEN charge.status <> '${ChargeStatus.EXONERATED}' THEN charge.amount ELSE 0 END), 0)`, "billable")
      .addSelect(
        `COALESCE(SUM(CASE WHEN charge.status = '${ChargeStatus.PAID}' THEN charge.amount
          WHEN charge.status = '${ChargeStatus.PARTIAL}' THEN LEAST(charge.amount, COALESCE(charge.amount_paid, 0))
          ELSE 0 END), 0)`,
        "collected"
      )
      .addSelect(`COUNT(*) FILTER (WHERE charge.status = '${ChargeStatus.PAID}')`, "paid")
      .addSelect(`COUNT(*) FILTER (WHERE ${open})`, "open")
      .addSelect(`COUNT(*) FILTER (WHERE ${open} AND charge.due_date < CURRENT_DATE)`, "overdue")
      .addSelect(`COUNT(*) FILTER (WHERE charge.status = '${ChargeStatus.EXONERATED}')`, "exonerated")
      .groupBy("charge.period, charge.type")
      .orderBy("charge.period", "DESC")
      .addOrderBy("charge.type", "ASC")
      .getRawMany<{
        period: string; type: string; count: string; total: string; currencies: string | null;
        billable: string; collected: string; paid: string; open: string; overdue: string; exonerated: string;
      }>();

    return rows.map((r) => ({
      period: r.period,
      type: r.type as ChargeType,
      count: Number(r.count),
      total: Number(r.total),
      hasSpecial: r.type === ChargeType.SPECIAL,
      currencies: (r.currencies ?? RateCurrency.EUR).split(",").filter(isRateCurrency),
      progress: {
        billable: Number(r.billable),
        collected: Number(r.collected),
        paid: Number(r.paid),
        open: Number(r.open),
        overdue: Number(r.overdue),
        exonerated: Number(r.exonerated),
      },
    }));
  },

  /**
   * Cambia la moneda de tasa de las cuotas no pagadas de un lote (o de una sola
   * cuota con `chargeId`). Las pagadas no se tocan: sus pagos ya congelaron la
   * tasa. Lo abonado se conserva porque el monto de la cuota es en divisas.
   */
  async setCurrency(
    currency: RateCurrency,
    scope: { chargeId: string } | { period: string; type?: string }
  ): Promise<{ updated: number }> {
    const qb = repo()
      .createQueryBuilder()
      .update(Charge)
      .set({ currency })
      .where("status IN (:...statuses)", {
        statuses: [ChargeStatus.PENDING, ChargeStatus.PARTIAL, ChargeStatus.EXONERATED],
      });
    if ("chargeId" in scope) {
      qb.andWhere("id = :id", { id: scope.chargeId });
    } else {
      qb.andWhere("period = :period", { period: scope.period });
      if (scope.type) qb.andWhere("type = :type", { type: scope.type });
    }
    const result = await qb.execute();
    return { updated: result.affected ?? 0 };
  },

  /**
   * Corrige el vencimiento de las cuotas no pagadas de un lote (o de una sola con
   * `chargeId`). La mora se decide al confirmar cada pago comparando su fecha con
   * este vencimiento, así que un vencimiento mal cargado hacía que el pago con
   * mora no cuadrara. Las pagadas no se tocan: su mora ya quedó decidida.
   */
  async setDueDate(
    dueDate: string,
    scope: { chargeId: string } | { period: string; type?: string }
  ): Promise<{ updated: number }> {
    const qb = repo()
      .createQueryBuilder()
      .update(Charge)
      .set({ dueDate })
      .where("status IN (:...statuses)", {
        statuses: [ChargeStatus.PENDING, ChargeStatus.PARTIAL, ChargeStatus.EXONERATED],
      });
    if ("chargeId" in scope) {
      qb.andWhere("id = :id", { id: scope.chargeId });
    } else {
      qb.andWhere("period = :period", { period: scope.period });
      if (scope.type) qb.andWhere("type = :type", { type: scope.type });
    }
    const result = await qb.execute();
    return { updated: result.affected ?? 0 };
  },

  /**
   * Fija la mora por vencimiento de las cuotas regulares no pagadas de un lote
   * (p. ej. se emitió con mora 0). Igual que el vencimiento, se aplica a los pagos
   * que se confirmen después; las pagadas no se tocan.
   */
  async setMora(moraAmount: number, scope: { period: string }): Promise<{ updated: number }> {
    const result = await repo()
      .createQueryBuilder()
      .update(Charge)
      .set({ moraAmount })
      .where("status IN (:...statuses)", {
        statuses: [ChargeStatus.PENDING, ChargeStatus.PARTIAL, ChargeStatus.EXONERATED],
      })
      .andWhere("period = :period", { period: scope.period })
      .andWhere("type = :type", { type: ChargeType.REGULAR })
      .execute();
    return { updated: result.affected ?? 0 };
  },

  listForPeriod(period: string, type?: string): Promise<Charge[]> {
    const where: any = { period };
    if (type) where.type = type;
    return repo().find({
      where,
      order: { property: { code: "ASC" } },
      relations: {
        payments: { submittedBy: true },
        paymentTargets: { payment: { submittedBy: true } },
      },
    });
  },

  listForProperty(propertyId: string): Promise<Charge[]> {
    return repo().find({
      where: { property: { id: propertyId } },
      order: { period: "DESC" },
      // Sin estas relaciones el serializador no puede armar confirmedPayment y
      // el panel se queda sin el número de recibo para descargar el PDF.
      relations: {
        payments: { submittedBy: true },
        paymentTargets: { payment: { submittedBy: true } },
        coveringReceipt: { payment: { submittedBy: true } },
        applications: { payment: true },
      },
      // Pagos × cuotas elegidas × aplicaciones en un solo JOIN multiplican las
      // filas; por separado son consultas pequeñas.
      relationLoadStrategy: "query",
    });
  },

  async getById(id: string): Promise<Charge> {
    const charge = await repo().findOne({
      where: { id },
      relations: { property: { owner: true } },
    });
    if (!charge) throw new HttpError(404, "Cuota no encontrada");
    return charge;
  },

  async generateForPeriod(input: {
    period: string;
    amount: number;
    /** Monto si se paga en Bs; null = el mismo `amount`. */
    bsPrice?: number | null;
    moraAmount: number;
    dueDate: string;
    type: ChargeType;
    currency: RateCurrency;
    towerIds?: string[];
    propertyIds?: string[];
    description?: string;
  }): Promise<{ created: number }> {
    const { period, amount, bsPrice, moraAmount, dueDate, type, currency, towerIds, propertyIds, description } = input;
    const filterByTowers = towerIds && towerIds.length > 0;
    const filterByProperties = propertyIds && propertyIds.length > 0;

    const propRepo = AppDataSource.getRepository(Property);
    let propQuery = propRepo
      .createQueryBuilder("property")
      .leftJoinAndSelect("property.tower", "tower")
      .leftJoinAndSelect("property.owner", "owner");

    if (filterByProperties) {
      propQuery = propQuery.where("property.id IN (:...propertyIds)", { propertyIds });
    } else if (filterByTowers) {
      propQuery = propQuery.where("tower.id IN (:...towerIds)", { towerIds });
    }

    const properties = await propQuery.getMany();
    if (properties.length === 0) {
      throw new HttpError(400, "No hay departamentos seleccionados");
    }

    if (type === ChargeType.REGULAR) {
      const propertyIds = properties.map((p) => p.id);
      const existing = await repo()
        .createQueryBuilder("charge")
        .where("charge.period = :period", { period })
        .andWhere("charge.type = :type", { type: ChargeType.REGULAR })
        .andWhere("charge.property_id IN (:...propertyIds)", { propertyIds })
        .getCount();

      if (existing > 0) {
        let scope = "";
        if (filterByProperties) scope = " en los departamentos seleccionados";
        else if (filterByTowers) scope = " en las torres seleccionadas";
        throw new HttpError(
          409,
          `Ya existe una cuota regular para ${period}${scope}`
        );
      }
    }

    const desc =
      description?.trim() ||
      (type === ChargeType.REGULAR
        ? `Cuota de asociación ${period}`
        : `Cuota especial ${period}`);

    const effectiveMora = type === ChargeType.SPECIAL ? 0 : moraAmount;

    const charges = properties.map((property) =>
      repo().create({
        property: { id: property.id } as Property,
        period,
        description: desc,
        type,
        amount,
        bsPrice: bsPrice ?? null,
        currency,
        moraAmount: effectiveMora,
        dueDate,
        status: ChargeStatus.PENDING,
        amountPaid: 0,
      })
    );

    // El saldo a favor NO se aplica solo a las cuotas nuevas: las saldaba sin
    // pago ni recibo, y si el pago que lo originó resultaba duplicado o se
    // borraba, la cuota quedaba pagada con dinero que no existía.
    await repo().save(charges);

    return { created: charges.length };
  },

  /**
   * Cierra una cuota con abono parcial perdonando el saldo restante (p. ej. el
   * vecino pagó 20 de 25 por un error de tasa). Queda PAID con lo condonado y el
   * motivo registrados, y se emite el recibo ligado al último pago de la cuota.
   */
  async writeOff(id: string, reason: string, adminId: string): Promise<Charge> {
    const motivo = (reason ?? "").trim();
    if (motivo.length < 5) {
      throw new HttpError(400, "Indica el motivo de la condonación (mínimo 5 caracteres)");
    }

    const chargeId = await AppDataSource.transaction(async (manager) => {
      const charge = await manager.findOne(Charge, {
        where: { id },
        relations: { payments: true },
      });
      if (!charge) throw new HttpError(404, "Cuota no encontrada");
      if (charge.status !== ChargeStatus.PARTIAL) {
        throw new HttpError(409, "Solo se condona el saldo de una cuota con abono parcial");
      }
      if (charge.payments?.some((p) => p.status === PaymentStatus.PENDING)) {
        throw new HttpError(
          409,
          "La cuota tiene un pago pendiente de revisión: confírmalo o recházalo antes de condonar"
        );
      }

      // Lo que el panel muestra como pendiente (con mora si ya venció).
      const remaining = amountDue(charge);
      if (remaining <= 0) throw new HttpError(409, "La cuota no tiene saldo pendiente");

      // El recibo va con el último pago que abonó a la cuota. Sin registro de
      // aplicaciones (pagos antiguos) se usa el último pago confirmado.
      const lastApp = await manager.findOne(PaymentApplication, {
        where: { charge: { id: charge.id } },
        order: { createdAt: "DESC" },
        relations: { payment: true },
      });
      const payment =
        lastApp?.payment ??
        [...(charge.payments ?? [])]
          .filter((p) => p.status === PaymentStatus.CONFIRMED)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

      charge.writeOffAmount = remaining;
      charge.writeOffReason = motivo;
      charge.writtenOffAt = new Date();
      charge.writtenOffBy = { id: adminId } as User;
      charge.status = ChargeStatus.PAID;
      await manager.save(Charge, charge);

      // Sin un pago detrás (abonos del saldo a favor automático de antes) no
      // hay dinero que acreditar con un recibo: la cuota se cierra igual y la
      // condonación queda a la vista en el estado de cuenta del vecino.
      if (payment) {
        const prefix = await SettingsService.get("receipt_prefix");
        const num = await SettingsService.nextReceiptNumber();
        const receipt = await manager.save(
          manager.create(Receipt, {
            payment,
            charge,
            receiptNumber: `${prefix}-${String(num).padStart(8, "0")}`,
            issuedBy: { id: adminId } as User,
          })
        );
        charge.coveringReceipt = receipt;
        await manager.save(Charge, charge);
      }
      return charge.id;
    });

    return this.getWithPayments(chargeId);
  },

  /** Deshace una condonación: la cuota vuelve a parcial y se anula su recibo. */
  async revertWriteOff(id: string): Promise<Charge> {
    await AppDataSource.transaction(async (manager) => {
      const charge = await manager.findOne(Charge, {
        where: { id },
        relations: { coveringReceipt: true },
      });
      if (!charge) throw new HttpError(404, "Cuota no encontrada");
      if (!(Number(charge.writeOffAmount) > 0)) {
        throw new HttpError(409, "La cuota no tiene saldo condonado");
      }

      // Una cuota parcial no tiene recibo (solo se emite al quedar pagada), así
      // que el que la cubre ahora es el que emitió la condonación.
      const receipt = charge.coveringReceipt;
      clearWriteOff(charge);
      charge.coveringReceipt = null;
      await manager.save(Charge, charge);
      if (receipt) await manager.remove(Receipt, receipt);
    });
    return this.getWithPayments(id);
  },

  /** Cuota con lo que necesita el serializador (pagos y recibo). */
  async getWithPayments(id: string): Promise<Charge> {
    const charge = await repo().findOne({
      where: { id },
      relations: {
        payments: { submittedBy: true },
        paymentTargets: { payment: { submittedBy: true } },
        coveringReceipt: { payment: { submittedBy: true } },
        applications: { payment: true },
      },
      // Pagos × cuotas elegidas × aplicaciones en un solo JOIN multiplican las
      // filas; por separado son consultas pequeñas.
      relationLoadStrategy: "query",
    });
    if (!charge) throw new HttpError(404, "Cuota no encontrada");
    return charge;
  },

  /**
   * Elimina una cuota que no debió emitirse. Si ya tenía abonos, lo abonado
   * vuelve al saldo a favor del titular y se anota en cada pago como sobrante
   * (`creditAmount`): el pago sigue cuadrando, y si después se elimina, se
   * descuenta del saldo como cualquier sobrante. Devuelve lo acreditado.
   * Una cuota pagada no se elimina: primero se elimina o anula su pago.
   */
  async deleteCharge(id: string): Promise<number> {
    return AppDataSource.transaction(async (manager) => {
      const charge = await manager.findOne(Charge, {
        where: { id },
        relations: { property: { owner: true } },
      });
      if (!charge) throw new HttpError(404, "Cuota no encontrada");
      if (charge.status === ChargeStatus.PAID) {
        throw new HttpError(
          409,
          "La cuota está pagada: elimina o anula primero el pago que la pagó en Pagos."
        );
      }

      // Un pago en revisión o rechazado que la nombra la ata: se avisa con el pago
      // concreto y qué hacer. Los confirmados se sueltan más abajo.
      const linked = await manager
        .createQueryBuilder(Payment, "p")
        .select(["p.id", "p.status", "p.reference", "p.paymentDate"])
        .where("p.status <> :confirmed", { confirmed: PaymentStatus.CONFIRMED })
        .andWhere(
          "(p.charge_id = :id OR p.id IN (SELECT t.payment_id FROM payment_targets t WHERE t.charge_id = :id))",
          { id }
        )
        .orderBy("p.paymentDate", "DESC")
        .getMany();
      if (linked.length > 0) {
        const p = linked.find((x) => x.status === PaymentStatus.PENDING) ?? linked[0];
        const which = `${p.reference ? `ref. ${p.reference}` : "sin referencia"}, del ${p.paymentDate}`;
        const what =
          p.status === PaymentStatus.PENDING
            ? `Tiene un pago en revisión (${which}). Recházalo o elimínalo en Pagos y vuelve a intentarlo.`
            : `Tiene un pago rechazado registrado a esta cuota (${which}). Elimínalo en Pagos › Rechazados y vuelve a intentarlo.`;
        throw new HttpError(409, `No se puede eliminar la cuota. ${what}`);
      }

      // Un recibo (anulado) que la nombra impide borrarla en la base de datos.
      if ((await manager.count(Receipt, { where: { charge: { id } } })) > 0) {
        throw new HttpError(
          409,
          "La cuota figura en un recibo anulado y no se puede eliminar. Exonérala en su lugar."
        );
      }

      const round2 = (n: number) => Math.round(n * 100) / 100;
      const credited = round2(Number(charge.amountPaid ?? 0));
      const ownerId = charge.property?.owner?.id;
      if (credited > 0 && !ownerId) {
        throw new HttpError(409, "La cuota tiene abonos y el departamento no tiene titular a quien devolverlos");
      }

      const applications = await manager.find(PaymentApplication, {
        where: { charge: { id } },
        relations: { payment: true },
      });
      for (const app of applications) {
        // Los pagos anteriores al campo (null) ya deducen el sobrante del monto.
        if (app.payment.creditAmount == null) continue;
        await manager.update(Payment, app.payment.id, {
          creditAmount: round2(Number(app.payment.creditAmount) + Number(app.amount)),
        });
      }
      await manager.delete(PaymentApplication, { charge: { id } });

      if (credited > 0 && ownerId) {
        const owner = await manager.findOne(User, {
          where: { id: ownerId },
          lock: { mode: "pessimistic_write" },
        });
        if (owner) {
          owner.creditBalance = round2(Number(owner.creditBalance ?? 0) + credited);
          await manager.save(User, owner);
        }
      }

      // Un pago confirmado cuya cuota principal era esta pasa a apuntar a la
      // siguiente que eligió, o a ninguna si solo era esta.
      await manager.query(
        `UPDATE payments p
            SET charge_id = (
              SELECT t.charge_id FROM payment_targets t
               WHERE t.payment_id = p.id AND t.charge_id <> $1
               ORDER BY t.position LIMIT 1)
          WHERE p.charge_id = $1`,
        [id]
      );
      await manager.delete(PaymentTarget, { charge: { id } });
      await manager.delete(Charge, { id });
      return credited;
    });
  },

  async setExonerated(id: string, exonerated: boolean): Promise<Charge> {
    const charge = await this.getById(id);
    if (charge.status === ChargeStatus.PAID) {
      throw new HttpError(409, "La cuota ya fue pagada");
    }
    // Exonerar una parcial haría desaparecer lo que el vecino ya abonó; para
    // perdonar solo el resto está la condonación.
    if (charge.status === ChargeStatus.PARTIAL) {
      throw new HttpError(409, "La cuota tiene un abono: usa «Condonar saldo» para perdonar el resto");
    }
    charge.status = exonerated ? ChargeStatus.EXONERATED : ChargeStatus.PENDING;
    return repo().save(charge);
  },
};
