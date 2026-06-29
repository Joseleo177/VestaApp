import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Clock } from "lucide-react";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Charge, ChargeStatus, Payment, PaymentCurrency, PaymentStatus } from "@/types/domain";
import { formatCurrency, formatDate, formatPeriod } from "@/lib/format";
import { ExchangeRate, exchangeRateService } from "@/features/exchange-rate/services/exchange-rate.service";
import { paymentService } from "../services/payment.service";
import { MODALIDADES_BS, MODALIDADES_DIVISAS, paymentSchema, PaymentFormValues } from "../schema";
import { ApiError } from "@/services/api";

interface PaymentFormProps {
  charges: Charge[];
  defaultChargeId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function PaymentForm({ charges, defaultChargeId, onSuccess, onCancel }: PaymentFormProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [dateRate, setDateRate] = useState<ExchangeRate | null>(null);
  const [result, setResult]     = useState<Payment | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    mode: "onChange",
    defaultValues: {
      chargeId:    defaultChargeId ?? charges[0]?.id ?? "",
      currency:    PaymentCurrency.BS,
      modalidad:   "Transferencia",
      paymentDate: today,
    },
  });

  const chargeId        = watch("chargeId");
  const currency        = watch("currency");
  const modalidad       = watch("modalidad");
  const amountBsInput   = watch("amountBs");
  const paymentDateInput = watch("paymentDate");

  const isBS      = currency === PaymentCurrency.BS;
  const isEfectivo = modalidad === "Efectivo";

  // Cuando cambia la moneda, resetear la modalidad al primer valor válido
  useEffect(() => {
    const opts = isBS ? MODALIDADES_BS : MODALIDADES_DIVISAS;
    setValue("modalidad", opts[0]);
  }, [currency, isBS, setValue]);

  useEffect(() => {
    if (!paymentDateInput) return;
    let cancelled = false;
    exchangeRateService.getForDate(paymentDateInput).then((r) => {
      if (!cancelled) setDateRate(r);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [paymentDateInput]);

  const selected = useMemo(
    () => charges.find((c) => c.id === chargeId),
    [charges, chargeId]
  );

  const isPartial = selected?.status === ChargeStatus.PARTIAL;

  const overdueAtPaymentDate = useMemo(() => {
    if (!selected?.dueDate || isPartial) return false;
    const payDate = paymentDateInput ? new Date(paymentDateInput) : new Date();
    const dueDate = new Date(selected.dueDate);
    payDate.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    return payDate.getTime() > dueDate.getTime();
  }, [selected, paymentDateInput, isPartial]);

  const amountEurRef = selected
    ? isPartial
      ? (selected.amountDueDivisas ?? Math.max(0, selected.amount - (selected.amountPaid ?? 0)))
      : (selected.amountDueDivisas ?? selected.amount)
    : 0;

  const moraAnnulled = !isBS && overdueAtPaymentDate && (selected?.moraAmount ?? 0) > 0;

  const eurFromBs =
    isBS && amountBsInput && dateRate
      ? Math.round((amountBsInput / dateRate.rate) * 100) / 100
      : null;

  const onSubmit = async (values: PaymentFormValues) => {
    setSubmitError(null);
    try {
      const payment = await paymentService.create(values);
      setResult(payment);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "No se pudo registrar el pago");
    }
  };

  if (result) {
    const confirmed = result.status === PaymentStatus.CONFIRMED;
    return (
      <div className="flex flex-col items-center gap-5 py-4 text-center">
        <div className={`flex h-16 w-16 items-center justify-center rounded-full ${confirmed ? "bg-emerald-50" : "bg-amber-50"}`}>
          {confirmed
            ? <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            : <Clock className="h-8 w-8 text-amber-500" />}
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-800">
            {confirmed ? "¡Pago verificado!" : "Pago en revisión"}
          </h3>
          <p className="mt-1.5 text-sm text-slate-500 max-w-xs">
            {confirmed
              ? "Tu pago coincidió con el extracto bancario y fue confirmado automáticamente. Puedes descargar tu recibo desde el historial."
              : "Tu pago fue registrado. El administrador lo revisará y confirmará en breve."}
          </p>
        </div>
        <Button className="w-full justify-center" onClick={onSuccess}>
          Cerrar
        </Button>
      </div>
    );
  }

  const modalidadOpts = isBS ? MODALIDADES_BS : MODALIDADES_DIVISAS;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Moneda + Modalidad en fila */}
      <div className="grid grid-cols-2 gap-3">
        <Select id="currency" label="Moneda" error={errors.currency?.message} {...register("currency")}>
          <option value={PaymentCurrency.BS}>Bolívares</option>
          <option value={PaymentCurrency.DIVISAS}>Divisas (€)</option>
        </Select>
        <Select id="modalidad" label="Modalidad" error={errors.modalidad?.message} {...register("modalidad")}>
          {modalidadOpts.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </Select>
      </div>

      {/* Resumen del monto */}
      {selected && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm space-y-1">
          {isPartial ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Cuota original</span>
                <span className="text-slate-400">{formatCurrency(selected.amount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Ya pagado</span>
                <span className="text-emerald-600">– {formatCurrency(selected.amountPaid ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-2 mt-1">
                <span className="font-semibold text-slate-700">Pendiente</span>
                <span className="text-lg font-bold text-slate-900">{formatCurrency(amountEurRef)}</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Cuota base</span>
                <span className="font-medium text-slate-700">{formatCurrency(selected.amount)}</span>
              </div>
              {overdueAtPaymentDate && (selected.moraAmount ?? 0) > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Mora (vencida)</span>
                  <span className={moraAnnulled ? "text-emerald-600 line-through" : "font-medium text-rose-600"}>
                    {formatCurrency(selected.moraAmount ?? 0)}
                  </span>
                </div>
              )}
              {!isBS && (
                <div className="flex items-center justify-between border-t border-slate-200 pt-2 mt-1">
                  <span className="font-semibold text-slate-700">Total a pagar</span>
                  <span className="text-lg font-bold text-slate-900">{formatCurrency(amountEurRef)}</span>
                </div>
              )}
              {moraAnnulled && (
                <p className="mt-2 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-700">
                  Pagando en divisas se anula la mora.
                </p>
              )}
            </>
          )}
          {isBS && dateRate && (
            <div className="mt-2 rounded-lg bg-blue-50 px-3 py-2.5 text-xs text-blue-700 space-y-1">
              <div className="flex items-center justify-between">
                <span>Tasa BCV {formatDate(dateRate.updatedAt)}</span>
                <span className="font-medium">Bs. {dateRate.rate.toLocaleString("es-VE", { minimumFractionDigits: 2 })}/EUR</span>
              </div>
              <div className="flex items-center justify-between border-t border-blue-200 pt-1.5">
                <span className="font-semibold">Debes transferir</span>
                <span className="text-base font-bold text-blue-900">
                  Bs. {(amountEurRef * dateRate.rate).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Monto en Bs (solo Bolívares) */}
      {isBS && (
        <div>
          <Input
            id="amountBs"
            type="number"
            step="0.01"
            min="0.01"
            label="Monto transferido (Bs)"
            placeholder="Ej. 17.709,75"
            error={errors.amountBs?.message}
            {...register("amountBs")}
          />
          {eurFromBs !== null && (
            <p className="mt-1 text-xs text-slate-500">
              Equivalente estimado: {formatCurrency(eurFromBs)}
            </p>
          )}
        </div>
      )}

      {/* Referencia (oculta para Efectivo) */}
      {!isEfectivo && (
        <Input
          id="reference"
          label="Nº de referencia"
          placeholder="Ej. 000000520107342"
          error={errors.reference?.message}
          {...register("reference")}
        />
      )}

      <Input
        id="paymentDate"
        type="date"
        label="Fecha del pago"
        max={today}
        error={errors.paymentDate?.message}
        {...register("paymentDate")}
      />

      {submitError && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{submitError}</p>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" loading={isSubmitting} disabled={charges.length === 0}>
          {isSubmitting ? "Verificando..." : "Registrar pago"}
        </Button>
      </div>
    </form>
  );
}
