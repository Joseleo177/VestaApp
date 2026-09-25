import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Clock, Building2 } from "lucide-react";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Charge, ChargeStatus, Payment, PaymentCurrency, PaymentStatus, RateCurrency } from "@/types/domain";
import { chargeLabel } from "../coveredCharges";
import { formatCurrency, formatDate, rateUnit } from "@/lib/format";
import { ExchangeRate, exchangeRateService } from "@/features/exchange-rate/services/exchange-rate.service";
import { paymentService } from "../services/payment.service";
import { MODALIDADES_BS, MODALIDADES_DIVISAS, paymentSchema, PaymentFormValues } from "../schema";
import { ApiError, api } from "@/services/api";

interface BankInfo {
  bank_name: string;
  bank_beneficiary: string;
  bank_account: string;
  bank_usd_name: string;
  bank_usd_beneficiary: string;
  bank_usd_account: string;
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
  // Tasa de cada moneda presente en las cuotas elegidas, a la fecha del pago.
  const [dateRates, setDateRates] = useState<Partial<Record<RateCurrency, ExchangeRate>>>({});
  const [result, setResult] = useState<Payment | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [bankInfo, setBankInfo] = useState<BankInfo | null>(null);

  useEffect(() => {
    api.get<BankInfo>("/settings").then(({ data }) => setBankInfo(data)).catch(() => { });
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
      chargeIds: [defaultChargeId ?? charges[0]?.id].filter((id): id is string => !!id),
      currency: PaymentCurrency.BS,
      modalidad: "Transferencia",
      paymentDate: today,
    },
  });

  const chargeIds = watch("chargeIds") ?? [];
  const currency = watch("currency");
  const modalidad = watch("modalidad");
  const amountBsInput = watch("amountBs");
  const paymentDateInput = watch("paymentDate");

  const isBS = currency === PaymentCurrency.BS;
  const isEfectivo = modalidad === "Efectivo";

  // Cuando cambia la moneda, resetear la modalidad al primer valor válido
  useEffect(() => {
    const opts = isBS ? MODALIDADES_BS : MODALIDADES_DIVISAS;
    setValue("modalidad", opts[0]);
  }, [currency, isBS, setValue]);

  // Cuotas que se pueden sumar a este pago (p. ej. las de otro departamento que
  // gestiona): las que no tienen ya un pago en revisión, de la más vieja a la
  // más nueva, que es el orden en que se saldan.
  const selectable = useMemo(
    () =>
      charges
        .filter((c) => !c.pendingPayment || c.id === defaultChargeId)
        .sort(
          (a, b) =>
            a.dueDate.localeCompare(b.dueDate) ||
            a.period.localeCompare(b.period) ||
            a.description.localeCompare(b.description)
        ),
    [charges, defaultChargeId]
  );
  const selectedCharges = useMemo(
    () => selectable.filter((c) => chargeIds.includes(c.id)),
    [selectable, chargeIds]
  );
  const multi = selectedCharges.length > 1;
  const selected = selectedCharges[0];

  const toggleCharge = (id: string) => {
    const next = chargeIds.includes(id) ? chargeIds.filter((x) => x !== id) : [...chargeIds, id];
    if (next.length === 0) return; // siempre queda al menos una
    setValue("chargeIds", next, { shouldValidate: true });
  };

  // La tasa de cada cuota es la de SU moneda, en la fecha del pago.
  const neededCurrencies = [...new Set(selectedCharges.map((c) => c.currency))].sort().join(",");
  useEffect(() => {
    if (!paymentDateInput || !neededCurrencies) return;
    let cancelled = false;
    setDateRates({});
    for (const cur of neededCurrencies.split(",") as RateCurrency[]) {
      exchangeRateService.getForDate(paymentDateInput, cur).then((r) => {
        if (!cancelled) setDateRates((prev) => ({ ...prev, [cur]: r }));
      }).catch(() => { });
    }
    return () => { cancelled = true; };
  }, [paymentDateInput, neededCurrencies]);
  const dateRate = selected ? dateRates[selected.currency] ?? null : null;

  const overdueAt = (c: Charge) => {
    const payDate = paymentDateInput ? new Date(paymentDateInput) : new Date();
    const dueDate = new Date(c.dueDate);
    payDate.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    return payDate.getTime() > dueDate.getTime();
  };
  /** Lo que resta de la cuota sin la mora que depende de la moneda. */
  const baseDue = (c: Charge) =>
    c.status === ChargeStatus.PARTIAL
      ? (c.amountDueDivisas ?? Math.max(0, c.amount - (c.amountPaid ?? 0)))
      : (c.amountDueDivisas ?? c.amount);
  /** Lo que se paga por la cuota: en Bs lleva la mora si ya venció; en divisas se anula. */
  const dueFor = (c: Charge) =>
    baseDue(c) +
    (isBS && c.status !== ChargeStatus.PARTIAL && overdueAt(c) ? (c.moraAmount ?? 0) : 0);

  const isPartial = selected?.status === ChargeStatus.PARTIAL;
  const overdueAtPaymentDate = selected ? overdueAt(selected) : false;
  const amountEurRef = selected ? baseDue(selected) : 0;
  const moraAnnulled = !isBS && overdueAtPaymentDate && (selected?.moraAmount ?? 0) > 0;
  // Para el cálculo en Bs incluimos la mora cuando hay vencimiento y no se anula (pago en Bs)
  const amountEurForBs = selected ? dueFor(selected) : 0;

  // Varias cuotas: total en REF y en Bs (cada una a la tasa de su moneda).
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const multiTotal = round2(selectedCharges.reduce((sum, c) => sum + dueFor(c), 0));
  const multiBs =
    isBS && selectedCharges.every((c) => dateRates[c.currency])
      ? round2(selectedCharges.reduce((sum, c) => sum + dueFor(c) * dateRates[c.currency]!.rate, 0))
      : null;
  const multiMoraAnnulled =
    !isBS && selectedCharges.some((c) => overdueAt(c) && (c.moraAmount ?? 0) > 0);

  const eurFromBs =
    !multi && isBS && amountBsInput && dateRate
      ? Math.round((amountBsInput / dateRate.rate) * 100) / 100
      : null;

  // Monto en Bs que corresponde a lo seleccionado, con la tasa de la fecha.
  const suggestedBs = multi
    ? multiBs
    : isBS && dateRate && amountEurForBs > 0
      ? Math.round(amountEurForBs * dateRate.rate * 100) / 100
      : null;

  /**
   * Se precarga el monto sugerido para no obligar al vecino a transcribirlo,
   * pero se deja de tocar en cuanto él escribe: si transfirió otra cifra, manda
   * la suya (el backend recalcula los euros desde los bolívares reales).
   */
  const [amountTouched, setAmountTouched] = useState(false);
  useEffect(() => {
    if (amountTouched || suggestedBs === null) return;
    setValue("amountBs", suggestedBs, { shouldValidate: false });
  }, [suggestedBs, amountTouched, setValue]);

  const amountBsField = register("amountBs");

  const onSubmit = async (values: PaymentFormValues) => {
    setSubmitError(null);
    try {
      const payment = await paymentService.create(values);
      setResult(payment);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "No se pudo registrar el pago");
    }
  };

  const onValidationError = (errs: object) => {
    const msgs = Object.entries(errs).map(([f, e]: [string, any]) => `${f}: ${e?.message}`).join(" | ");
    setSubmitError(`Error de validación: ${msgs}`);
  };

  if (result) {
    const confirmed = result.status === PaymentStatus.CONFIRMED;
    return (
      <div className="flex flex-col items-center gap-5 py-4 text-center">
        <div className={`flex h-16 w-16 items-center justify-center rounded-full ${confirmed ? "bg-ios-green/10" : "bg-ios-orange/10"}`}>
          {confirmed
            ? <CheckCircle2 className="h-8 w-8 text-ios-green" />
            : <Clock className="h-8 w-8 text-ios-orange" />}
        </div>
        <div>
          <h3 className="text-lg font-semibold text-ios-label">
            {confirmed ? "¡Pago verificado!" : "Pago en revisión"}
          </h3>
          <p className="mt-1.5 text-sm text-ios-secondary max-w-xs">
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

  const bank = bankInfo
    ? isBS
      ? { name: bankInfo.bank_name, beneficiary: bankInfo.bank_beneficiary, account: bankInfo.bank_account }
      : { name: bankInfo.bank_usd_name, beneficiary: bankInfo.bank_usd_beneficiary, account: bankInfo.bank_usd_account }
    : null;

  return (
    <form onSubmit={handleSubmit(onSubmit, onValidationError)} className="space-y-4">
      {/* Moneda + Modalidad en fila */}
      <div className="grid grid-cols-2 gap-3">
        <Select id="currency" label="Moneda" error={errors.currency?.message} {...register("currency")}>
          <option value={PaymentCurrency.BS}>Bolívares</option>
          <option value={PaymentCurrency.DIVISAS}>Divisas ($)</option>
        </Select>
        <Select id="modalidad" label="Modalidad" error={errors.modalidad?.message} {...register("modalidad")}>
          {modalidadOpts.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </Select>
      </div>

      {/* Cuotas a pagar: se pueden juntar varias en un solo pago */}
      {selectable.length > 1 && (
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-ios-label">Cuotas a pagar</p>
          <div className="max-h-52 divide-y divide-ios-separator overflow-y-auto rounded-2xl border border-ios-separator">
            {selectable.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  className="rounded border-ios-separator"
                  checked={chargeIds.includes(c.id)}
                  onChange={() => toggleCharge(c.id)}
                />
                <span className="min-w-0 flex-1">
                  <span className="font-medium text-ios-label">{chargeLabel(c)}</span>
                  <span className="block truncate text-xs text-ios-secondary">{c.description}</span>
                </span>
                <span className="shrink-0 font-medium text-ios-label">{formatCurrency(dueFor(c))}</span>
              </label>
            ))}
          </div>
          {errors.chargeIds && (
            <p className="text-xs text-ios-red">{errors.chargeIds.message}</p>
          )}
        </div>
      )}

      {multi && (
        <div className="rounded-2xl bg-ios-fill p-4 text-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-ios-label">
              Total a pagar ({selectedCharges.length} cuotas)
            </span>
            <span className="text-lg font-bold text-ios-label">{formatCurrency(multiTotal)}</span>
          </div>
          {multiMoraAnnulled && (
            <p className="mt-2 rounded-lg bg-ios-green/10 px-2.5 py-1.5 text-xs text-ios-green">
              Pagando en divisas se anula la mora.
            </p>
          )}
          {isBS && (
            <div className="mt-2 rounded-lg bg-ios-blue/10 px-3 py-2.5 text-xs text-ios-blue space-y-1">
              {(neededCurrencies.split(",") as RateCurrency[]).map((cur) => {
                const r = dateRates[cur];
                return (
                  <div key={cur} className="flex items-center justify-between">
                    <span>Tasa BCV {cur === "USD" ? "dólar" : "euro"} {r ? formatDate(r.updatedAt) : ""}</span>
                    <span className="font-medium">
                      {r ? `${r.rate.toLocaleString("es-VE", { minimumFractionDigits: 2 })} ${rateUnit(cur)}` : "…"}
                    </span>
                  </div>
                );
              })}
              <div className="flex items-center justify-between border-t border-ios-blue/30 pt-1.5">
                <span className="font-semibold">Debes transferir</span>
                <span className="text-base font-bold text-ios-blue">
                  {multiBs !== null
                    ? `Bs. ${multiBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : "…"}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Resumen del monto (una sola cuota) */}
      {selected && !multi && (
        <div className="rounded-2xl bg-ios-fill p-4 text-sm space-y-1">
          {isPartial ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-ios-secondary"> Monto Cuota</span>
                <span className="text-ios-secondary">{formatCurrency(selected.amount)}</span>
              </div>
              {overdueAtPaymentDate && (selected.moraAmount ?? 0) > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-ios-secondary">Mora (vencida)</span>
                  <span className="font-medium text-ios-red">{formatCurrency(selected.moraAmount ?? 0)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-ios-secondary">Ya pagado</span>
                <span className="text-ios-green">– {formatCurrency(selected.amountPaid ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-ios-separator pt-2 mt-1">
                <span className="font-semibold text-ios-label">Pendiente</span>
                <span className="text-lg font-bold text-ios-label">{formatCurrency(amountEurRef)}</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-ios-secondary">Monto Cuota</span>
                <span className="font-medium text-ios-label">{formatCurrency(selected.amount)}</span>
              </div>
              {overdueAtPaymentDate && (selected.moraAmount ?? 0) > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-ios-secondary">Mora (vencida)</span>
                  <span className={moraAnnulled ? "text-ios-green line-through" : "font-medium text-ios-red"}>
                    {formatCurrency(selected.moraAmount ?? 0)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-ios-separator pt-2 mt-1">
                <span className="font-semibold text-ios-label">Total a pagar</span>
                <span className="text-lg font-bold text-ios-label">
                  {formatCurrency(isBS ? amountEurForBs : amountEurRef)}
                </span>
              </div>
              {moraAnnulled && (
                <p className="mt-2 rounded-lg bg-ios-green/10 px-2.5 py-1.5 text-xs text-ios-green">
                  Pagando en divisas se anula la mora.
                </p>
              )}
            </>
          )}
          {isBS && dateRate && (
            <div className="mt-2 rounded-lg bg-ios-blue/10 px-3 py-2.5 text-xs text-ios-blue space-y-1">
              <div className="flex items-center justify-between">
                <span>Tasa BCV {dateRate.currency === "USD" ? "dólar" : "euro"} {formatDate(dateRate.updatedAt)}</span>
                <span className="font-medium">{dateRate.rate.toLocaleString("es-VE", { minimumFractionDigits: 2 })} {rateUnit(dateRate.currency)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-ios-blue/30 pt-1.5">
                <span className="font-semibold">Debes transferir</span>
                <span className="text-base font-bold text-ios-blue">
                  Bs. {(amountEurForBs * dateRate.rate).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Datos bancarios para transferencia: la cuenta en Bs o la de divisas */}
      {!isEfectivo && bank && (bank.name || bank.account) && (
        <div className="rounded-xl border border-ios-blue/30 bg-ios-blue/10 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="h-4 w-4 text-ios-blue shrink-0" />
            <span className="text-xs font-semibold text-ios-blue uppercase tracking-wide">
              {isBS ? "Datos para transferencia" : "Datos para transferencia en divisas"}
            </span>
          </div>
          <div className="space-y-1 text-sm">
            {bank.name && (
              <div className="flex justify-between">
                <span className="text-ios-blue">Banco</span>
                <span className="font-semibold text-ios-blue">{bank.name}</span>
              </div>
            )}
            {bank.beneficiary && (
              <div className="flex justify-between gap-4">
                <span className="text-ios-blue shrink-0">Beneficiario</span>
                <span className="font-medium text-ios-blue text-right">{bank.beneficiary}</span>
              </div>
            )}
            {bankInfo?.condo_rif && (
              <div className="flex justify-between">
                <span className="text-ios-blue">RIF</span>
                <span className="font-medium text-ios-blue">{bankInfo.condo_rif}</span>
              </div>
            )}
            {bank.account && (
              <div className="flex justify-between gap-4">
                <span className="text-ios-blue shrink-0">Cuenta</span>
                <span className="font-bold text-ios-blue tracking-wide text-right break-all">{bank.account}</span>
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
            error={errors.amountBs?.message}
            {...amountBsField}
            onChange={(e) => {
              setAmountTouched(true);
              void amountBsField.onChange(e);
            }}
          />
          {eurFromBs !== null && (
            <p className="mt-1 text-xs text-ios-secondary">
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
        <p className="rounded-lg bg-ios-red/10 px-3 py-2 text-sm text-ios-red">{submitError}</p>
      )}

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end sm:gap-3">
        <Button type="button" variant="outline" onClick={onCancel} className="w-full sm:w-auto justify-center">Cancelar</Button>
        <Button type="submit" loading={isSubmitting} disabled={charges.length === 0} className="w-full sm:w-auto justify-center">
          {isSubmitting ? "Verificando..." : "Registrar pago"}
        </Button>
      </div>
    </form>
  );
}
