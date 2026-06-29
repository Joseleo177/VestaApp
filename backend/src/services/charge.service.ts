import { AppDataSource } from "../config/data-source";
import { Charge, ChargeStatus, ChargeType } from "../models/Charge";
import { Property } from "../models/Property";
import { PaymentCurrency } from "../models/Payment";
import { HttpError } from "../middlewares/error.middleware";
import { applyCreditBalance } from "./payment.service";

const repo = () => AppDataSource.getRepository(Charge);

export function isOverdue(charge: Charge, asOfDate?: string): boolean {
  const ref = asOfDate
    ? new Date(asOfDate).setHours(0, 0, 0, 0)
    : new Date().setHours(0, 0, 0, 0);
  return new Date(charge.dueDate).getTime() < ref;
}

/**
 * Monto pendiente de pago de una cuota:
 * - PARTIAL: saldo restante (base − amountPaid), sin mora
 * - PENDING: base + mora si estaba vencida en la fecha de pago (asOfDate) y no es DIVISAS
 */
export function amountDue(charge: Charge, currency?: PaymentCurrency, asOfDate?: string): number {
  if (charge.status === ChargeStatus.PAID || charge.status === ChargeStatus.EXONERATED) {
    return 0;
  }
  if (charge.status === ChargeStatus.PARTIAL) {
    return Math.max(
      0,
      Math.round((Number(charge.amount) - Number(charge.amountPaid ?? 0)) * 100) / 100
    );
  }
  const base = Number(charge.amount);
  const mora = Number(charge.moraAmount);
  const moraApplies =
    isOverdue(charge, asOfDate) && currency !== PaymentCurrency.DIVISAS && mora > 0;
  return Math.round((base + (moraApplies ? mora : 0)) * 100) / 100;
}

export const ChargeService = {
  async listForOwner(ownerId: string): Promise<Charge[]> {
    return repo().find({
      where: { property: { owner: { id: ownerId } } },
      order: { period: "DESC" },
      relations: { payments: { submittedBy: true } },
    });
  },

  /** Saldo pendiente en EUR: PENDING (con mora) + PARTIAL (saldo restante). */
  async balanceForOwner(ownerId: string): Promise<number> {
    const charges = await repo().find({
      where: [
        { property: { owner: { id: ownerId } }, status: ChargeStatus.PENDING },
        { property: { owner: { id: ownerId } }, status: ChargeStatus.PARTIAL },
      ],
    });
    return charges.reduce((sum, c) => sum + amountDue(c), 0);
  },

  async listPeriods(): Promise<
    { period: string; count: number; total: number; hasSpecial: boolean }[]
  > {
    const rows = await repo()
      .createQueryBuilder("charge")
      .select("charge.period", "period")
      .addSelect("COUNT(*)", "count")
      .addSelect("COALESCE(SUM(charge.amount), 0)", "total")
      .addSelect(
        `BOOL_OR(charge.type::text = '${ChargeType.SPECIAL}')`,
        "hasSpecial"
      )
      .groupBy("charge.period")
      .orderBy("charge.period", "DESC")
      .getRawMany<{ period: string; count: string; total: string; hasSpecial: boolean }>();

    return rows.map((r) => ({
      period: r.period,
      count: Number(r.count),
      total: Number(r.total),
      hasSpecial: Boolean(r.hasSpecial),
    }));
  },

  listForPeriod(period: string): Promise<Charge[]> {
    return repo().find({
      where: { period },
      order: { property: { code: "ASC" } },
      relations: { payments: { submittedBy: true } },
    });
  },

  listForProperty(propertyId: string): Promise<Charge[]> {
    return repo().find({
      where: { property: { id: propertyId } },
      order: { period: "DESC" },
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
    moraAmount: number;
    dueDate: string;
    type: ChargeType;
    towerIds?: string[];
    description?: string;
  }): Promise<{ created: number }> {
    const { period, amount, moraAmount, dueDate, type, towerIds, description } = input;
    const filterByTowers = towerIds && towerIds.length > 0;

    const propRepo = AppDataSource.getRepository(Property);
    let propQuery = propRepo
      .createQueryBuilder("property")
      .leftJoinAndSelect("property.tower", "tower")
      .leftJoinAndSelect("property.owner", "owner");

    if (filterByTowers) {
      propQuery = propQuery.where("tower.id IN (:...towerIds)", { towerIds });
    }

    const properties = await propQuery.getMany();
    if (properties.length === 0) {
      throw new HttpError(400, "No hay departamentos en las torres seleccionadas");
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
        const scope = filterByTowers ? " en las torres seleccionadas" : "";
        throw new HttpError(
          409,
          `Ya existe una cuota regular para ${period}${scope}`
        );
      }
    }

    const desc =
      description?.trim() ||
      (type === ChargeType.REGULAR
        ? `Cuota de condominio ${period}`
        : `Cuota especial ${period}`);

    const effectiveMora = type === ChargeType.SPECIAL ? 0 : moraAmount;

    const charges = properties.map((property) =>
      repo().create({
        property: { id: property.id } as Property,
        period,
        description: desc,
        type,
        amount,
        moraAmount: effectiveMora,
        dueDate,
        status: ChargeStatus.PENDING,
        amountPaid: 0,
      })
    );

    await repo().save(charges);

    // Auto-aplicar saldo a favor de propietarios con crédito acumulado
    const ownerIds = [...new Set(
      properties.map((p) => (p as Property & { owner?: { id: string } }).owner?.id).filter(Boolean) as string[]
    )];
    if (ownerIds.length > 0) {
      // Cargar propietarios solo si la query incluyó owner
      const allOwnerIds = ownerIds.length > 0 ? ownerIds : [];
      await AppDataSource.transaction(async (manager) => {
        for (const ownerId of allOwnerIds) {
          await applyCreditBalance(manager, ownerId);
        }
      });
    }

    return { created: charges.length };
  },

  async setExonerated(id: string, exonerated: boolean): Promise<Charge> {
    const charge = await this.getById(id);
    if (charge.status === ChargeStatus.PAID) {
      throw new HttpError(409, "La cuota ya fue pagada");
    }
    charge.status = exonerated ? ChargeStatus.EXONERATED : ChargeStatus.PENDING;
    return repo().save(charge);
  },
};
