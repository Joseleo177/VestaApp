import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Ban, Building, CalendarClock, Download, HandCoins, RotateCcw, Trash2, Undo2, Wallet } from "lucide-react";
import { Modal, ModalIcon } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyBlock, RowIcon } from "@/components/ui/Ledger";
import { Money } from "@/components/ui/Money";
import { RowMenu, RowMenuItem } from "@/components/ui/RowMenu";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusDef, StatusMark } from "@/components/ui/StatusMark";
import { Charge, ChargeStatus, ChargeType } from "@/types/domain";
import { formatCurrency, formatDate, formatPeriod } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ApiError } from "@/services/api";
import { billingService } from "@/features/billing/services/billing.service";
import { paymentService } from "@/features/payments/services/payment.service";
import { PropertyWithBalance } from "@/features/admin-panel/types";
import { PaymentForm } from "@/features/payments/components/PaymentForm";
import { WriteOffDialog } from "@/features/billing/components/WriteOffDialog";
import { DueDateDialog, mergeDue } from "@/features/billing/components/DueDateDialog";

interface PropertyChargesModalProps {
  property: PropertyWithBalance | null;
  open: boolean;
  onClose: () => void;
}

type Filter = "OPEN" | "PAID" | "ALL";

const isOpen = (c: Charge) => c.status === ChargeStatus.PENDING || c.status === ChargeStatus.PARTIAL;
const due = (c: Charge) => Number(c.amountDue ?? c.amount);

// Pagada es lo normal (gris con visto); solo lo vencido va en rojo.
function statusOf(c: Charge): StatusDef {
  switch (c.status) {
    case ChargeStatus.PAID:
      return { label: "Pagada", tone: "success", quiet: "check" };
    case ChargeStatus.EXONERATED:
      return { label: "Exonerada", tone: "violet" };
    case ChargeStatus.PARTIAL:
      return { label: "Abonada en parte", tone: "warning" };
    default:
      return c.overdue ? { label: "Vencida", tone: "danger" } : { label: "Pendiente", tone: "warning" };
  }
}

/** Qué entró a la cuota, en una línea: los pagos que abonaron (o el confirmado, en los viejos). */
function paymentLine(c: Charge): string | null {
  const apps = c.applications ?? [];
  const receipt = c.confirmedPayment?.receiptNumber;
  const parts =
    apps.length > 0
      ? apps.map((a) =>
          [a.paymentDate && formatDate(a.paymentDate), a.reference && `Ref. ${a.reference}`, apps.length > 1 && formatCurrency(a.amount)]
            .filter(Boolean)
            .join(" · ")
        )
      : c.confirmedPayment
        ? [[formatDate(c.confirmedPayment.paymentDate), c.confirmedPayment.reference && `Ref. ${c.confirmedPayment.reference}`].filter(Boolean).join(" · ")]
        : [];
  if (parts.length === 0) return null;
  return `Pagada el ${parts.join(" + ")}${receipt ? ` · Recibo ${receipt}` : ""}`;
}

/**
 * Las cuotas de un departamento: cuánto debe, qué pagó y qué hacer con cada una.
 * Cada fila deja a la vista solo su acción principal (registrar el pago o bajar
 * el recibo); exonerar, condonar o eliminar van en el menú "⋯".
 */
export function PropertyChargesModal({ property, open, onClose }: PropertyChargesModalProps) {
  const [charges, setCharges] = useState<Charge[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Charge | null>(null);
  const [payIds, setPayIds] = useState<string[] | null>(null);
  const [writeOffTarget, setWriteOffTarget] = useState<Charge | null>(null);
  const [revertTarget, setRevertTarget] = useState<Charge | null>(null);
  const [dueTarget, setDueTarget] = useState<Charge | null>(null);
  const [chosen, setChosen] = useState<Filter | null>(null);

  const load = () => {
    if (!property) return;
    setLoading(true);
    billingService
      .listForProperty(property.id)
      .then(setCharges)
      .catch(() => toast.error("No se pudieron cargar las cuotas"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!open || !property) return;
    setChosen(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, property]);

  const replaceCharge = (updated: Charge) => setCharges((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));

  const open_ = useMemo(() => charges.filter(isOpen), [charges]);
  const payable = open_.filter((c) => !c.pendingPayment);
  const debt = open_.reduce((s, c) => s + due(c), 0);
  const overdue = open_.filter((c) => c.overdue).length;
  const paidCount = charges.filter((c) => c.status === ChargeStatus.PAID).length;

  // Sin elección, abre en lo que importa: lo que falta por cobrar, si hay.
  const filter: Filter = chosen ?? (open_.length ? "OPEN" : "ALL");
  const list = useMemo(() => {
    const byDue = (a: Charge, b: Charge) => b.dueDate.localeCompare(a.dueDate);
    if (filter === "OPEN") return [...open_].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    if (filter === "PAID") return charges.filter((c) => c.status === ChargeStatus.PAID).sort(byDue);
    return [...charges].sort(byDue);
  }, [filter, charges, open_]);

  const run = async (charge: Charge, fn: () => Promise<void>) => {
    setBusyId(charge.id);
    try {
      await fn();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo completar la acción");
    } finally {
      setBusyId(null);
    }
  };

  const toggleExonerated = (c: Charge) =>
    run(c, async () => {
      const exonerate = c.status !== ChargeStatus.EXONERATED;
      replaceCharge(await billingService.setExonerated(c.id, exonerate));
      toast.success(exonerate ? `${formatPeriod(c.period)} exonerada` : "Cuota reactivada");
    });

  /** El recibo se pide por su número: es el que cubre esta cuota concreta. */
  const download = (c: Charge) =>
    run(c, async () => {
      const cp = c.confirmedPayment;
      if (cp?.id && cp.receiptNumber) await paymentService.downloadReceipt(cp.id, cp.receiptNumber);
    });

  const handleDelete = async () => {
    const target = deleteTarget;
    if (!target) return;
    setDeleteTarget(null);
    await run(target, async () => {
      await billingService.deleteCharge(target.id);
      setCharges((prev) => prev.filter((c) => c.id !== target.id));
      toast.success("Cuota eliminada");
    });
  };

  const handleRevert = async () => {
    const target = revertTarget;
    if (!target) return;
    await run(target, async () => {
      replaceCharge(await billingService.revertWriteOff(target.id));
      toast.success("Condonación revertida: la cuota vuelve a quedar abonada en parte");
      setRevertTarget(null);
    });
  };

  const menuFor = (c: Charge): RowMenuItem[] => {
    const items: RowMenuItem[] = [];
    if (c.status === ChargeStatus.PARTIAL)
      items.push({
        label: "Condonar el saldo",
        icon: HandCoins,
        onClick: () => setWriteOffTarget(c),
        disabled: !!c.pendingPayment,
        hint: c.pendingPayment ? "Tiene un pago en revisión" : "Perdonar lo que falta",
      });
    if (c.writeOff) items.push({ label: "Revertir condonación", icon: Undo2, onClick: () => setRevertTarget(c) });
    // Un vencimiento mal cargado hace que el pago con mora no cuadre: se corrige aquí.
    if (c.status !== ChargeStatus.PAID)
      items.push({ label: "Cambiar vencimiento", icon: CalendarClock, onClick: () => setDueTarget(c), hint: `Hoy vence el ${formatDate(c.dueDate)}` });
    if (c.status === ChargeStatus.PENDING) items.push({ label: "Exonerar", icon: Ban, onClick: () => toggleExonerated(c) });
    if (c.status === ChargeStatus.EXONERATED) items.push({ label: "Reactivar", icon: RotateCcw, onClick: () => toggleExonerated(c) });
    if (c.status === ChargeStatus.PENDING || c.status === ChargeStatus.EXONERATED)
      items.push({ label: "Eliminar cuota", icon: Trash2, tone: "danger", onClick: () => setDeleteTarget(c) });
    return items;
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        className="sm:max-w-2xl"
        title={property ? `Cuotas de ${property.code}` : "Cuotas"}
        description={[property?.tower?.name, property?.owner?.fullName].filter(Boolean).join(" · ") || undefined}
        icon={
          <ModalIcon tone="bg-amber-500/[0.12] text-amber-600 dark:text-amber-400">
            <Building className="h-5 w-5" />
          </ModalIcon>
        }
      >
        {/* ── Cuánto debe ── */}
        {loading ? (
          <Skeleton className="mb-4 h-[76px] w-full !rounded-2xl" />
        ) : (
          charges.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-ios-fill/60 p-4">
              <div>
                <p className="text-[12px] text-ios-secondary">{debt > 0.005 ? "Debe" : "Estado"}</p>
                {debt > 0.005 ? (
                  <>
                    <Money
                      value={formatCurrency(debt)}
                      className={cn("block text-[26px] font-bold leading-tight", overdue ? "text-red-600 dark:text-red-400" : "text-ios-label")}
                    />
                    <p className="text-[12px] text-ios-secondary">
                      {open_.length} {open_.length === 1 ? "cuota abierta" : "cuotas abiertas"}
                      {overdue > 0 && ` · ${overdue} vencida${overdue === 1 ? "" : "s"}`}
                    </p>
                  </>
                ) : (
                  <p className="text-[20px] font-bold leading-tight text-ios-label">Al día</p>
                )}
              </div>
              {payable.length > 0 && (
                <Button size="sm" onClick={() => setPayIds(payable.map((c) => c.id))}>
                  <Wallet className="h-4 w-4" />
                  Registrar pago
                </Button>
              )}
            </div>
          )
        )}

        {charges.length > 0 && !loading && (
          <Segmented<Filter>
            aria-label="Filtrar cuotas"
            value={filter}
            onChange={setChosen}
            className="mb-3"
            options={[
              { key: "OPEN", label: "Por cobrar", count: open_.length },
              { key: "PAID", label: "Pagadas", count: paidCount },
              { key: "ALL", label: "Todas", count: charges.length },
            ]}
          />
        )}

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full !rounded-xl" />
            ))}
          </div>
        ) : charges.length === 0 ? (
          <EmptyBlock title="Sin cuotas" hint="A este departamento todavía no se le ha emitido ninguna cuota." />
        ) : list.length === 0 ? (
          <EmptyBlock title="Nada por aquí" hint={filter === "OPEN" ? "No tiene cuotas por cobrar." : "Aún no tiene cuotas pagadas."} />
        ) : (
          <ul className="divide-y divide-ios-separator overflow-hidden rounded-xl border border-ios-separator">
            {list.map((c) => {
              const busy = busyId === c.id;
              const paid = Number(c.amountPaid ?? 0);
              const line = paymentLine(c);
              const receipt = c.confirmedPayment?.receiptNumber;
              return (
                <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-[14px] font-semibold text-ios-label">{formatPeriod(c.period)}</span>
                      {c.type === ChargeType.SPECIAL && (
                        <span className="rounded-md bg-violet-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-violet-700 dark:text-violet-300">
                          Especial
                        </span>
                      )}
                      <StatusMark {...statusOf(c)} />
                    </div>
                    <p className="mt-0.5 truncate text-[12px] text-ios-secondary">
                      {[
                        c.description,
                        isOpen(c) && `Vence ${formatDate(c.dueDate)}`,
                        c.status === ChargeStatus.PARTIAL && paid > 0 && `Abonó ${formatCurrency(paid)}`,
                        c.pendingPayment && "Pago en revisión",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {line && <p className="truncate text-[12px] text-ios-secondary">{line}</p>}
                    {c.writeOff && (
                      <p className="truncate text-[12px] text-violet-700 dark:text-violet-300">
                        Condonado {formatCurrency(c.writeOff.amount)}: {c.writeOff.reason}
                      </p>
                    )}
                    {c.status === ChargeStatus.PAID && !line && !c.writeOff && (
                      <p className="text-[12px] text-amber-700 dark:text-amber-400">Pagada sin ningún pago asociado</p>
                    )}
                  </div>

                  <div className="shrink-0 text-right">
                    <Money
                      value={formatCurrency(c.status === ChargeStatus.PAID ? c.amountPaid ?? c.amount : due(c))}
                      className="text-[14px] font-semibold text-ios-label"
                    />
                    {c.overdue && c.status === ChargeStatus.PENDING && (
                      <p className="text-[11px] text-red-600 dark:text-red-400">con mora</p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-0.5">
                    {isOpen(c) && !c.pendingPayment ? (
                      <Button size="sm" variant="outline" className="!h-8 !px-3" onClick={() => setPayIds([c.id])}>
                        Pagar
                      </Button>
                    ) : receipt ? (
                      <RowIcon icon={Download} title={`Descargar recibo ${receipt}`} busy={busy} onClick={() => download(c)} />
                    ) : null}
                    <RowMenu items={menuFor(c)} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Modal>

      <DueDateDialog
        target={dueTarget ? { kind: "charge", charge: dueTarget } : null}
        onClose={() => setDueTarget(null)}
        onDone={(updated) => {
          if (updated && dueTarget) replaceCharge(mergeDue(dueTarget, updated));
          setDueTarget(null);
        }}
      />

      <WriteOffDialog
        charge={writeOffTarget}
        onClose={() => setWriteOffTarget(null)}
        onDone={(updated) => {
          replaceCharge(updated);
          setWriteOffTarget(null);
        }}
      />

      <ConfirmDialog
        open={revertTarget !== null}
        onClose={() => setRevertTarget(null)}
        onConfirm={() => void handleRevert()}
        title="Revertir condonación"
        description={`La cuota de ${revertTarget ? formatPeriod(revertTarget.period) : ""} vuelve a quedar con ${revertTarget?.writeOff ? formatCurrency(revertTarget.writeOff.amount) : ""} pendiente, y se anula el recibo emitido al condonar.`}
        confirmLabel="Revertir"
        loading={busyId === revertTarget?.id}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        title={`¿Eliminar la cuota de ${deleteTarget ? formatPeriod(deleteTarget.period) : ""}?`}
        description="Desaparece del estado de cuenta del departamento. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        loading={busyId === deleteTarget?.id}
      />

      <Modal
        open={payIds !== null}
        onClose={() => setPayIds(null)}
        title="Registrar un pago"
        description={property ? `${property.code}${property.owner ? ` · ${property.owner.fullName}` : ""}` : undefined}
        icon={
          <ModalIcon tone="bg-fuchsia-500/[0.12] text-fuchsia-600 dark:text-fuchsia-400">
            <Wallet className="h-5 w-5" />
          </ModalIcon>
        }
      >
        {payIds && (
          <PaymentForm
            key={payIds.join(",")}
            charges={open_}
            defaultChargeIds={payIds}
            onSuccess={() => {
              setPayIds(null);
              load();
            }}
            onCancel={() => setPayIds(null)}
          />
        )}
      </Modal>
    </>
  );
}
