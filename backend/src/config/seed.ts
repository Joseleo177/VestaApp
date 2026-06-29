import bcrypt from "bcryptjs";
import { AppDataSource } from "./data-source";
import { User, UserRole } from "../models/User";
import { Tower } from "../models/Tower";
import { Property } from "../models/Property";
import { Charge, ChargeStatus, ChargeType } from "../models/Charge";

export async function runSeed(): Promise<void> {
  const userRepo = AppDataSource.getRepository(User);

  const adminCedula = "00000000";
  if (await userRepo.findOneBy({ cedula: adminCedula })) {
    return;
  }

  console.log("→ Sembrando datos iniciales...");

  const admin = userRepo.create({
    cedula: adminCedula,
    passwordHash: await bcrypt.hash("admin123", 10),
    fullName: "Administrador del Condominio",
    role: UserRole.ADMIN,
  });
  await userRepo.save(admin);

  const owner = userRepo.create({
    cedula: "12345678",
    passwordHash: await bcrypt.hash("owner123", 10),
    fullName: "Juan Pérez",
    phone: "+58 412 0000000",
    role: UserRole.OWNER,
  });
  await userRepo.save(owner);

  const towerRepo = AppDataSource.getRepository(Tower);
  const towerA = towerRepo.create({ name: "Torre A", description: "Torre principal" });
  await towerRepo.save(towerA);

  const property = AppDataSource.getRepository(Property).create({
    code: "Apt 4B",
    tower: towerA,
    owner,
  });
  await AppDataSource.getRepository(Property).save(property);

  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const charge = AppDataSource.getRepository(Charge).create({
    property,
    period,
    description: `Cuota de condominio ${period}`,
    type: ChargeType.REGULAR,
    amount: 25.0,
    moraAmount: 5.0,
    dueDate: new Date(now.getFullYear(), now.getMonth(), 7).toISOString().slice(0, 10),
    status: ChargeStatus.PENDING,
  });
  await AppDataSource.getRepository(Charge).save(charge);

  console.log("✔ Seed completo. Admin: 00000000 / admin123");
  console.log("                Owner: 12345678 / owner123");
  console.log("                Torre A + Apt 4B creados");
}
