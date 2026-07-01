import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Clock, Building2 } from "lucide-react";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Charge, ChargeStatus, Payment, PaymentCurrency, PaymentStatus } from "@/types/domain";
import { formatCurrency, formatDate } from "@/lib/format";
import { ExchangeRate, exchangeRateService } from "@/features/exchange-rate/services/exchange-rate.service";
import { paymentService } from "../services/payment.service";
import { MODALIDADES_BS, MODALIDADES_DIVISAS, paymentSchema, PaymentFormValues } from "../schema";
import { ApiError, api } from "@/services/api";

interface BankInfo {
  bank_name: string;
  bank_beneficiary: string;
  bank_account: string;
  condo_rif: string;
}

interface PaymentFormProps {
  charges: Charge[];
  defaultChargeId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function PaymentForm({ charges, defaultChargeId, onSuccess, onCancel }: PaymentFormProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [dateRate, setDateRate]   = useState<ExchangeRate | null>(null);
  const [result, setResult]       = useState<Payment | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [bankInfo, setBankInfo]   = useState<BankInfo | null>(null);

  useEffect(() => {
    api.get<BankInfo>("/settings").then(({ data }) => setBankInfo(data)).catch(() => {});
  }, []);

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
    if (!selected?.dueDate) return false;
    const payDate = paymentDateInput ? new Date(paymentDateInput) : new Date();
    const dueDate = new Date(selected.dueDate);
    payDate.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    return payDate.getTime() > dueDate.getTime();
  }, [selected, paymentDateInput]);

  const amountEurRef = selected
    ? isPartial
      ? (selected.amountDueDivisas ?? Math.max(0, selected.amount - (selected.amountPaid ?? 0)))
      : (selected.amountDueDivisas ?? selected.amount)
    : 0;

  const moraAnnulled = !isBS && overdueAtPaymentDate && (selected?.moraAmount ?? 0) > 0;

  // Para el cálculo en Bs incluimos la mora cuando hay vencimiento y no se anula (pago en Bs)
  const amountEurForBs = amountEurRef + (!isPartial && overdueAtPaymentDate && !moraAnnulled ? (selected?.moraAmount ?? 0) : 0);

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
                <span className="text-slate-500">Cuota base</span>
                <span className="text-slate-400">{formatCurrency(selected.amount)}</span>
              </div>
              {overdueAtPaymentDate && (selected.moraAmount ?? 0) > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Mora (vencida)</span>
                  <span className="font-medium text-rose-500">{formatCurrency(selected.moraAmount ?? 0)}</span>
                </div>
              )}
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
              <div className="flex items-center justify-between border-t border-slate-200 pt-2 mt-1">
                <span className="font-semibold text-slate-700">Total a pagar</span>
                <span className="text-lg font-bold text-slate-900">
                  {formatCurrency(isBS ? amountEurForBs : amountEurRef)}
                </span>
              </div>
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
                <span>Tasa EURO {formatDate(dateRate.updatedAt)}</span>
                <span className="font-medium">Bs. {dateRate.rate.toLocaleString("es-VE", { minimumFractionDigits: 2 })}/EUR</span>
              </div>
              <div className="flex items-center justify-between border-t border-blue-200 pt-1.5">
                <span className="font-semibold">Debes transferir</span>
                <span className="text-base font-bold text-blue-900">
                  Bs. {(amountEurForBs * dateRate.rate).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Datos bancarios para transferencia */}
      {!isEfectivo && bankInfo && (bankInfo.bank_name || bankInfo.bank_account) && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="h-4 w-4 text-blue-600 shrink-0" />
            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Datos para transferencia</span>
          </div>
          <div className="space-y-1 text-sm">
            {bankInfo.bank_name && (
              <div className="flex justify-between">
                <span className="text-blue-600">Banco</span>
                <span className="font-semibold text-blue-900">{bankInfo.bank_name}</span>
              </div>
            )}
            {bankInfo.bank_beneficiary && (
              <div className="flex justify-between gap-4">
                <span className="text-blue-600 shrink-0">Beneficiario</span>
                <span className="font-medium text-blue-900 text-right">{bankInfo.bank_beneficiary}</span>
              </div>
            )}
            {bankInfo.condo_rif && (
              <div className="flex justify-between">
                <span className="text-blue-600">RIF</span>
                <span className="font-medium text-blue-900">{bankInfo.condo_rif}</span>
              </div>
            )}
            {bankInfo.bank_account && (
              <div className="flex justify-between">
                <span className="text-blue-600">Cuenta</span>
                <span className="font-bold text-blue-900 tracking-wide">{bankInfo.bank_account}</span>
              </div>
            )}
          </div>
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
