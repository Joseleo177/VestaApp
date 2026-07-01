import { AppDataSource } from "../config/data-source";
import { Property } from "../models/Property";
import { Tower } from "../models/Tower";
import { Charge, ChargeStatus } from "../models/Charge";
import { User } from "../models/User";
import { HttpError } from "../middlewares/error.middleware";

const repo = () => AppDataSource.getRepository(Property);

export interface CreatePropertyInput {
  code: string;
  towerId?: string;
  ownerId: string;
}

export interface PropertyWithBalance extends Property {
  balance: number;
}

export const PropertyService = {
  listForOwner(ownerId: string): Promise<Property[]> {
    return repo().find({ where: { owner: { id: ownerId } } });
  },

  async listAll(): Promise<PropertyWithBalance[]> {
    const properties = await repo().find({ order: { code: "ASC" } });

    const rows = await AppDataSource.getRepository(Charge)
      .createQueryBuilder("charge")
      .select("charge.property_id", "propertyId")
      .addSelect(
        `COALESCE(SUM(
          CASE charge.status
            WHEN 'PARTIAL' THEN
              (charge.amount - COALESCE(charge.amount_paid, 0)) +
              CASE WHEN charge.due_date < CURRENT_DATE THEN COALESCE(charge.mora_amount, 0) ELSE 0 END
            ELSE
              charge.amount +
              CASE WHEN charge.due_date < CURRENT_DATE THEN COALESCE(charge.mora_amount, 0) ELSE 0 END
          END
        ), 0)`,
        "balance"
      )
      .where("charge.status IN (:...statuses)", {
        statuses: [ChargeStatus.PENDING, ChargeStatus.PARTIAL],
      })
      .groupBy("charge.property_id")
      .getRawMany<{ propertyId: string; balance: string }>();

    const balanceByProperty = new Map(
      rows.map((r) => [r.propertyId, Number(r.balance)])
    );

    return properties.map((p) => ({
      ...p,
      balance: balanceByProperty.get(p.id) ?? 0,
    })) as PropertyWithBalance[];
  },

  async create(input: CreatePropertyInput): Promise<Property> {
    const exists = await repo().findOneBy({ code: input.code });
    if (exists) throw new HttpError(409, "Ya existe una propiedad con ese código");

    const property = repo().create({
      code: input.code,
      tower: input.towerId ? ({ id: input.towerId } as Tower) : null,
      owner: { id: input.ownerId } as User,
    });
    return repo().save(property);
  },

  async update(id: string, input: Partial<CreatePropertyInput>): Promise<Property> {
    const property = await repo().findOne({
      where: { id },
      relations: { owner: true, tower: true },
    });
    if (!property) throw new HttpError(404, "Propiedad no encontrada");

    if (input.code && input.code !== property.code) {
      const exists = await repo().findOneBy({ code: input.code });
      if (exists) throw new HttpError(409, "Ya existe una propiedad con ese código");
      property.code = input.code;
    }
    if (input.towerId !== undefined) {
      property.tower = input.towerId ? ({ id: input.towerId } as Tower) : null;
    }
    if (input.ownerId) property.owner = { id: input.ownerId } as User;

    return repo().save(property);
  },
};
