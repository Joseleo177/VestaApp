import { ReactNode, useMemo, useState } from "react";
import { AlertCircle, Download, FileSpreadsheet, FileText, Receipt } from "lucide-react";
import { toast } from "sonner";
import { UserRole } from "@/types/domain";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { Page } from "@/components/ui/Page";
import { SearchSelect } from "@/components/ui/SearchSelect";
import { StatusMark } from "@/components/ui/StatusMark";
import { formatCurrency, formatDocumentId } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ReportService } from "@/services/report.service";
import { useClients } from "@/features/users/hooks/useClients";
import { DEBT_EPSILON, isActiveClient, ROLE_LABELS } from "@/features/users/types";
import { toISODate } from "@/components/ui/DatePicker";
import { DateRange, describeRange, PRESETS, RangePicker, RangePreset, resolveRange } from "../components/RangePicker";

interface ReportCardProps {
  icon: ReactNode;
  tone: string;
  title: string;
  format: "Excel" | "PDF";
  description: string;
  /** Qué columnas o secciones trae: así se sabe qué se va a descargar. */
  includes: string[];
  children: ReactNode;
  className?: string;
}

/** Tarjeta de reporte: qué es, qué trae, cómo se configura y el botón de descarga. */
function ReportCard({ icon, tone, title, format, description, includes, children, className }: ReportCardProps) {
  return (
    <Card className={cn("flex flex-col p-5", className)}>
      <div className="flex items-start gap-3">
        <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", tone)}>{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[17px] font-semibold text-ios-label">{title}</h2>
            <span
              className={cn(
                "rounded-md px-1.5 py-0.5 text-[11px] font-bold",
                format === "Excel"
                  ? "bg-emerald-500/[0.12] text-emerald-700 dark:text-emerald-400"
                  : "bg-red-500/[0.1] text-red-600 dark:text-red-400"
              )}
            >
              {format}
            </span>
          </div>
          <p className="mt-0.5 text-[13px] text-ios-secondary">{description}</p>
        </div>
      </div>
      <p className="mt-3 text-[12px] text-ios-secondary">
        <span className="font-medium text-ios-label">Incluye:</span> {includes.join(" · ")}
      </p>
      <div className="mt-4 flex flex-1 flex-col gap-4 border-t border-ios-separator pt-4">{children}</div>
    </Card>
  );
}

/** Frase que confirma qué se va a descargar, encima del botón. */
function Summary({ children, warn }: { children: ReactNode; warn?: boolean }) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-[13px]",
        warn ? "bg-amber-500/[0.08] text-amber-800 dark:text-amber-300" : "bg-ios-fill/60 text-ios-label"
      )}
    >
      {warn && <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
      <span>{children}</span>
    </p>
  );
}

const COLLECTED_PRESETS: RangePreset[] = [
  { key: "thisMonth", label: "Este mes", range: PRESETS.thisMonth },
  { key: "lastMonth", label: "Mes pasado", range: PRESETS.lastMonth },
  { key: "thisYear", label: "Este año", range: PRESETS.thisYear },
  { key: "custom", label: "Personalizado", range: null },
];

const DEBT_PRESETS: RangePreset[] = [
  { key: "all", label: "Toda la deuda", range: () => ({ from: "", to: "" }) },
  { key: "overdue", label: "Ya vencida", range: () => ({ from: "", to: toISODate(new Date()) }) },
  { key: "thisMonth", label: "Vence este mes", range: PRESETS.thisMonth },
  { key: "custom", label: "Personalizado", range: null },
];

/** Reportes para la junta y la asamblea: cobros, deuda y estado de cuenta por vecino. */
export function ReportsPage() {
  // ── Cobros ──
  const [collectedPreset, setCollectedPreset] = useState("thisMonth");
  const [collectedCustom, setCollectedCustom] = useState<DateRange>({ from: "", to: "" });
  const collected = resolveRange(COLLECTED_PRESETS, collectedPreset, collectedCustom);
  const collectedInvalid = !collected.from || !collected.to || collected.from > collected.to;
  const [loadingCollected, setLoadingCollected] = useState(false);

  // ── Deuda ──
  const [debtPreset, setDebtPreset] = useState("all");
  const [debtCustom, setDebtCustom] = useState<DateRange>({ from: "", to: "" });
  const debt = resolveRange(DEBT_PRESETS, debtPreset, debtCustom);
  const debtInvalid = !!debt.from && !!debt.to && debt.from > debt.to;
  const [loadingDebt, setLoadingDebt] = useState(false);

  // ── Estado de cuenta ──
  const { clients, loading: loadingClients } = useClients();
  const [clientId, setClientId] = useState("");
  const [loadingStatement, setLoadingStatement] = useState(false);
  const residents = useMemo(
    () =>
      clients
        .filter((c) => c.role !== UserRole.ADMIN && isActiveClient(c))
        .sort((a, b) => a.fullName.localeCompare(b.fullName, "es")),
    [clients]
  );
  const client = residents.find((c) => c.id === clientId);

  const download = async (run: () => Promise<void>, setBusy: (v: boolean) => void, ok: string) => {
    setBusy(true);
    try {
      await run();
      toast.success(ok);
    } catch {
      toast.error("No se pudo generar el reporte");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page
      module="Finanzas y ajustes"
      title="Reportes"
      subheader={<p className="text-[14px] text-ios-secondary">Descarga la información de la asociación para la junta, la asamblea o un vecino.</p>}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── Cobros ── */}
        <ReportCard
          icon={<FileSpreadsheet className="h-5 w-5" />}
          tone="bg-emerald-500/[0.12] text-emerald-600 dark:text-emerald-400"
          title="Cobros"
          format="Excel"
          description="Lo que entró: los pagos confirmados en un período."
          includes={["Fecha de pago", "Departamento y titular", "Monto en REF y Bs con su tasa", "Banco y referencia", "Cuota", "Quién lo registró"]}
        >
          <RangePicker
            presets={COLLECTED_PRESETS}
            preset={collectedPreset}
            onPreset={setCollectedPreset}
            custom={collectedCustom}
            onCustom={setCollectedCustom}
          />
          <div className="mt-auto space-y-3">
            <Summary warn={collectedInvalid}>
              {collectedInvalid
                ? !collected.from || !collected.to
                  ? "Elige la fecha de inicio y la de fin."
                  : "La fecha de inicio es posterior a la de fin."
                : `Pagos confirmados ${describeRange(collected)}.`}
            </Summary>
            <Button
              className="w-full"
              loading={loadingCollected}
              disabled={collectedInvalid}
              onClick={() =>
                download(() => ReportService.downloadCollectedPayments(collected.from, collected.to), setLoadingCollected, "Reporte de cobros descargado")
              }
            >
              {!loadingCollected && <Download className="h-4 w-4" />}
              {loadingCollected ? "Generando…" : "Descargar Excel"}
            </Button>
          </div>
        </ReportCard>

        {/* ── Deuda ── */}
        <ReportCard
          icon={<Receipt className="h-5 w-5" />}
          tone="bg-red-500/[0.1] text-red-600 dark:text-red-400"
          title="Deuda"
          format="Excel"
          description="Lo que falta por cobrar: cuotas pendientes y abonadas en parte."
          includes={["Departamento y titular", "Período y concepto", "Monto, mora y lo pagado", "Saldo adeudado", "Vencimiento"]}
        >
          <RangePicker
            presets={DEBT_PRESETS}
            preset={debtPreset}
            onPreset={setDebtPreset}
            custom={debtCustom}
            onCustom={setDebtCustom}
          />
          <div className="mt-auto space-y-3">
            <Summary warn={debtInvalid}>
              {debtInvalid
                ? "La fecha de inicio es posterior a la de fin."
                : describeRange(debt)
                  ? `Cuotas por cobrar con vencimiento ${describeRange(debt)}.`
                  : "Todas las cuotas por cobrar, sin importar su vencimiento."}
            </Summary>
            <Button
              className="w-full"
              loading={loadingDebt}
              disabled={debtInvalid}
              onClick={() =>
                download(
                  () => ReportService.downloadOwedCharges(debt.from || undefined, debt.to || undefined),
                  setLoadingDebt,
                  "Reporte de deuda descargado"
                )
              }
            >
              {!loadingDebt && <Download className="h-4 w-4" />}
              {loadingDebt ? "Generando…" : "Descargar Excel"}
            </Button>
          </div>
        </ReportCard>

        {/* ── Estado de cuenta ── */}
        <ReportCard
          className="lg:col-span-2"
          icon={<FileText className="h-5 w-5" />}
          tone="bg-sky-500/[0.12] text-sky-600 dark:text-sky-400"
          title="Estado de cuenta de un vecino"
          format="PDF"
          description="Un documento formal para entregar o enviar al vecino."
          includes={["Deuda total y saldo a favor", "Detalle de cuotas con su estado", "Cuotas condonadas"]}
        >
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-3">
              <SearchSelect
                label="Vecino"
                value={clientId}
                onChange={setClientId}
                options={residents.map((c) => ({
                  value: c.id,
                  label: c.fullName,
                  hint: [formatDocumentId(c.cedulaTipo, c.cedula), c.units.map((u) => u.property.code).join(", ")]
                    .filter(Boolean)
                    .join(" · "),
                }))}
                placeholder={loadingClients ? "Cargando vecinos…" : "Elige un vecino"}
                searchPlaceholder="Nombre, cédula o departamento…"
                disabled={loadingClients}
              />
              <Button
                className="w-full"
                loading={loadingStatement}
                disabled={!client}
                onClick={() =>
                  client &&
                  download(
                    () => ReportService.downloadAccountStatement(client.id),
                    setLoadingStatement,
                    `Estado de cuenta de ${client.fullName} descargado`
                  )
                }
              >
                {!loadingStatement && <Download className="h-4 w-4" />}
                {loadingStatement ? "Generando…" : "Descargar PDF"}
              </Button>
            </div>

            {/* Vista previa: a quién y qué se va a descargar. */}
            {client ? (
              <div className="rounded-2xl border border-ios-separator p-4">
                <div className="flex items-center gap-3">
                  <Avatar name={client.fullName} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ios-label">{client.fullName}</p>
                    <p className="truncate text-[12px] text-ios-secondary">
                      {ROLE_LABELS[client.role]} · {formatDocumentId(client.cedulaTipo, client.cedula)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-ios-separator pt-3">
                  <div className="flex flex-wrap gap-1">
                    {client.units.length ? (
                      client.units.map((u) => (
                        <span key={u.property.id} className="rounded-md bg-ios-fill px-2 py-0.5 text-[12px] font-medium tabular-nums text-ios-label">
                          {u.property.code}
                        </span>
                      ))
                    ) : (
                      <span className="text-[12px] text-amber-700 dark:text-amber-400">Sin departamento asignado</span>
                    )}
                  </div>
                  {client.debt > DEBT_EPSILON ? (
                    <span className="text-right text-[12px] text-ios-secondary">
                      Debe <Money value={formatCurrency(client.debt)} className="font-semibold text-red-600 dark:text-red-400" />
                    </span>
                  ) : (
                    <StatusMark label="Al día" tone="success" quiet="check" />
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[104px] items-center justify-center rounded-2xl border-2 border-dashed border-ios-separator px-4 text-center text-[13px] text-ios-secondary">
                Elige un vecino para ver de quién es el estado de cuenta antes de descargarlo.
              </div>
            )}
          </div>
        </ReportCard>
      </div>
    </Page>
  );
}
