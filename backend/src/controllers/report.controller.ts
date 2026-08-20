import { Request, Response, NextFunction } from "express";
import { AppDataSource } from "../config/data-source";
import { Payment, PaymentStatus } from "../models/Payment";
import { Charge, ChargeStatus } from "../models/Charge";
import { HttpError } from "../middlewares/error.middleware";
import * as xlsx from "xlsx";

export const ReportController = {
  // GET /api/reports/collected
  async exportCollectedPayments(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        throw new HttpError(400, "Debe proporcionar startDate y endDate");
      }

      const paymentRepo = AppDataSource.getRepository(Payment);

      const payments = await paymentRepo.createQueryBuilder("payment")
        .leftJoinAndSelect("payment.property", "property")
        .leftJoinAndSelect("property.tower", "tower")
        .leftJoinAndSelect("payment.submittedBy", "user")
        .leftJoinAndSelect("payment.charge", "charge")
        .where("payment.status = :status", { status: PaymentStatus.CONFIRMED })
        .andWhere("payment.paymentDate >= :startDate", { startDate })
        .andWhere("payment.paymentDate <= :endDate", { endDate })
        .orderBy("payment.paymentDate", "ASC")
        .getMany();

      const data = payments.map(p => ({
        "Fecha de Pago": p.paymentDate,
        "Propiedad": p.property ? `${p.property.tower?.name || ''} - ${p.property.code}` : "N/A",
        "Propietario": p.submittedBy ? p.submittedBy.fullName : "N/A",
        "Monto (Base)": p.amount,
        "Moneda": p.currency,
        "Monto (Bs)": p.amountBs || "",
        "Tasa Usada": p.exchangeRate || "",
        "Banco": p.bank,
        "Referencia": p.reference,
        "Cuota": p.charge ? `${p.charge.description} (${p.charge.period})` : "N/A",
      }));

      const ws = xlsx.utils.json_to_sheet(data);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, "Cobros");

      const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="reporte_cobros_${startDate}_al_${endDate}.xlsx"`);
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  },

  // GET /api/reports/debt
  async exportOwedCharges(req: Request, res: Response, next: NextFunction) {
    try {
      const chargeRepo = AppDataSource.getRepository(Charge);

      const charges = await chargeRepo.createQueryBuilder("charge")
        .leftJoinAndSelect("charge.property", "property")
        .leftJoinAndSelect("property.tower", "tower")
        .leftJoinAndSelect("property.owner", "owner")
        .where("charge.status IN (:...statuses)", { statuses: [ChargeStatus.PENDING, ChargeStatus.PARTIAL] })
        .orderBy("property.id", "ASC")
        .addOrderBy("charge.period", "ASC")
        .getMany();
      const data = charges.map(c => {
        const amountOwed = Number(c.amount) + Number(c.moraAmount) - Number(c.amountPaid);
        const isPastDue = new Date(c.dueDate) < new Date();
        let translatedStatus = "";
        if (isPastDue) {
          translatedStatus = "Vencida";
        } else if (c.status === ChargeStatus.PARTIAL) {
          translatedStatus = "Parcial";
        } else {
          translatedStatus = "Pendiente";
        }

        return {
          "Propiedad": c.property ? `${c.property.tower?.name || ''} - ${c.property.code}` : "N/A",
          "Propietario": c.property && c.property.owner ? c.property.owner.fullName : "N/A",
          "Periodo": c.period,
          "Descripción": c.description,
          "Tipo": c.type,
          "Monto Base (EUR)": Number(c.amount),
          "Mora (EUR)": Number(c.moraAmount),
          "Total Cuota (EUR)": Number(c.amount) + Number(c.moraAmount),
          "Pagado (EUR)": Number(c.amountPaid),
          "Adeudado (EUR)": amountOwed,
          "Estado": translatedStatus,
          "Vencimiento": c.dueDate,
        };
      });

      const ws = xlsx.utils.json_to_sheet(data);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, "Deudas");

      const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="reporte_deudas.xlsx"`);
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  },

  // GET /api/reports/statement
  async exportAccountStatement(req: Request, res: Response, next: NextFunction) {
    try {
      const { ChargeService } = await import("../services/charge.service");
      const { PropertyService } = await import("../services/property.service");
      const { User } = await import("../models/User");
      const { generateAccountStatementPdf } = await import("../services/statement-pdf.service");
      
      const { UserRole } = await import("../models/User");
      
      const userId = (req.query.userId as string) || req.user!.sub;
      if (userId !== req.user!.sub && req.user!.role !== UserRole.ADMIN) {
        throw new HttpError(403, "No autorizado para ver el estado de cuenta de otro usuario");
      }
      
      const user = await AppDataSource.getRepository(User).findOneBy({ id: userId });
      if (!user) throw new HttpError(404, "Usuario no encontrado");

      const [charges, balance, properties] = await Promise.all([
        ChargeService.listForUser(userId),
        ChargeService.balanceForUser(userId),
        PropertyService.listForUser(userId),
      ]);

      const creditBalance = Number(user.creditBalance ?? 0);

      const { SettingsService } = await import("../services/settings.service");
      const [condoName, condoCity, condoAddress, condoRif, condoPhone] = await Promise.all([
        SettingsService.get("condo_name"),
        SettingsService.get("condo_city"),
        SettingsService.get("condo_address"),
        SettingsService.get("condo_rif"),
        SettingsService.get("condo_phone"),
      ]);

      const pdfBuffer = await generateAccountStatementPdf(
        user,
        properties,
        charges,
        balance,
        creditBalance,
        { condoName, condoCity, condoAddress, condoRif, condoPhone }
      );

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="estado_de_cuenta_${user.cedula}.pdf"`);
      res.send(pdfBuffer);
    } catch (err) {
      next(err);
    }
  }
};
