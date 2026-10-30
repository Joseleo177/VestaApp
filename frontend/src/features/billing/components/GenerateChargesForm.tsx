import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { DatePicker, MonthPicker, toISODate } from "@/components/ui/DatePicker";
import { ChargeType, RateCurrency } from "@/types/domain";
import { formatBs, formatCurrency } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ApiError } from "@/services/api";
import { useExchangeRate } from "@/features/exchange-rate/hooks/useExchangeRate";
import { useTowers } from "@/features/towers/hooks/useTowers";
import { useUnits } from "@/features/units/hooks/useUnits";
import { SearchSelect } from "@/components/ui/SearchSelect";
import { CalendarDays, Check, Wrench, X } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { billingService } from "../services/billing.service";
import { generateChargesSchema, GenerateChargesValues } from "../schema";

interface GenerateChargesFormProps {
  onGenerated: () => void;
  onCancel: () => void;
  /** Períodos ("YYYY-MM") que ya tienen cuota regular: se marcan en el selector de mes. */
  emittedPeriods?: string[];
}

/** Opción grande y seleccionable (tipo de cuota): título y para qué sirve. */
const choice = (on: boolean) =>
  cn(
    "flex flex-1 cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition-colors",
    on ? "border-brand-500/50 bg-brand-50 ring-1 ring-brand-500/30" : "border-ios-separator hover:bg-ios-fill/60"
  );

export function GenerateChargesForm({ onGenerated, onCancel, emittedPeriods = [] }: GenerateChargesFormProps) {
  const { data: rates, rateOf } = useExchangeRate();
  const { towers } = useTowers();
  const { units } = useUnits();
  // En hora local: con toISOString, la noche del último día del mes ya era el mes siguiente.
  const thisMonth = toISODate(new Date()).slice(0, 7);
  const marked = useMemo(
    () => Object.fromEntries(emittedPeriods.map((p) => [p, "Ya emitido"])),
    [emittedPeriods]
  );

  const [targetType, setTargetType] = useState<"TOWERS" | "PROPERTIES">("TOWERS");

  const propertyOptions = useMemo(
    () =>
      units.map((u) => ({
        value: u.id,
        label: `${u.code}${u.tower ? ` - ${u.tower.name}` : ""}`,
        hint: u.owner ? u.owner.fullName : undefined,
      })),
    [units]
  );

  const {
    register,
    handleSubmit,
    watch,
    control,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<GenerateChargesValues>({
    resolver: zodResolver(generateChargesSchema),
    defaultValues: {
      period: thisMonth,
      moraAmount: 5,
      type: ChargeType.REGULAR,
      towerIds: [],
      propertyIds: [],
    },
  });

  // La tasa principal viene preseleccionada en cuanto se conocen las tasas.
  useEffect(() => {
    if (rates && !getValues("currency")) setValue("currency", rates.primary);
  }, [rates, getValues, setValue]);

  const activeCurrencies = rates?.rates.map((r) => r.currency) ?? [];
  const currency = watch("currency");
  const rate = currency ? rateOf(currency) : null;

  const amount = watch("amount");
  // Precio en Bs distinto del de divisas (p. ej. promoción por pagar en divisas).
  const bsPriceRaw = Number(watch("bsPrice"));
  const bsPrice = bsPriceRaw > 0 && bsPriceRaw !== Number(amount) ? bsPriceRaw : null;
  const type = watch("type");
  const towerIds = watch("towerIds");
  const isSpecial = type === ChargeType.SPECIAL;
  const filteringTowers = towerIds.length > 0;
  const propertyIds = watch("propertyIds") ?? [];
  const period = watch("period");

  // Atajos de vencimiento dentro del mes que se emite: lo usual es el 5, el 15 o fin de mes.
  const dueShortcuts = useMemo(() => {
    const [y, m] = (period || thisMonth).split("-").map(Number);
    if (!y || !m) return undefined;
    const last = new Date(y, m, 0).getDate();
    return [
      { label: "Día 5", value: toISODate(new Date(y, m - 1, 5)) },
      { label: "Día 15", value: toISODate(new Date(y, m - 1, 15)) },
      { label: `Fin de mes (${last})`, value: toISODate(new Date(y, m - 1, last)) },
    ];
  }, [period, thisMonth]);

  const unitsByTower = useMemo(() => {
    const map = new Map<string, number>();
    units.forEach((u) => u.tower && map.set(u.tower.id, (map.get(u.tower.id) ?? 0) + 1));
    return map;
  }, [units]);

  // A cuántos departamentos llegará: se dice antes de emitir, no después.
  const targetCount =
    targetType === "PROPERTIES"
      ? propertyIds.length
      : filteringTowers
        ? units.filter((u) => u.tower && towerIds.includes(u.tower.id)).length
        : units.length;

  const onSubmit = async (values: GenerateChargesValues) => {
    try {
      const payload = {
        ...values,
        moraAmount: isSpecial ? 0 : values.moraAmount,
        towerIds: targetType === "TOWERS" ? values.towerIds : [],
        propertyIds: targetType === "PROPERTIES" ? values.propertyIds : [],
      };
      const result = await billingService.generate(payload);
      toast.success(`Emitido: ${result.created} cuotas creadas`);
      onGenerated();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo emitir");
    }
  };

  return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Tipo */}
          <div className="flex flex-col gap-2 sm:flex-row">
            {([ChargeType.REGULAR, ChargeType.SPECIAL] as const).map((t) => {
              const regular = t === ChargeType.REGULAR;
              const Icon = regular ? CalendarDays : Wrench;
              return (
                <label key={t} className={choice(type === t)}>
                  <input type="radio" className="sr-only" value={t} {...register("type")} />
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                      regular
                        ? "bg-emerald-500/[0.12] text-emerald-600 dark:text-emerald-400"
                        : "bg-violet-500/[0.12] text-violet-600 dark:text-violet-400"
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span>
                    <span className="block text-[14px] font-semibold text-ios-label">
                      {regular ? "Cuota regular" : "Cuota especial"}
                    </span>
                    <span className="block text-[12px] text-ios-secondary">
                      {regular ? "La cuota fija del mes, con mora" : "Mantenimiento o cargo puntual"}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>

          {/* Tasa de cobro: solo se elige si hay más de una activa */}
          {activeCurrencies.length > 1 ? (
            <div className="space-y-1.5">
              <p className="text-[13px] font-medium text-ios-secondary">Tasa para cobrar en bolívares</p>
              <div className="flex gap-2">
                {activeCurrencies.map((c) => (
                  <label
                    key={c}
                    className={cn(
                      "flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[14px] font-medium transition-colors",
                      currency === c
                        ? "border-brand-500/50 bg-brand-50 text-brand-700 ring-1 ring-brand-500/30"
                        : "border-ios-separator text-ios-label hover:bg-ios-fill/60"
                    )}
                  >
                    <input type="radio" className="sr-only" value={c} {...register("currency")} />
                    {c === RateCurrency.USD ? "BCV dólar" : "BCV euro"}
                    {c === rates?.primary && (
                      <span className="rounded-md bg-ios-fill px-1.5 py-0.5 text-[11px] font-medium text-ios-secondary">
                        principal
                      </span>
                    )}
                  </label>
                ))}
              </div>
              {errors.currency && (
                <p className="text-xs text-ios-red">{errors.currency.message}</p>
              )}
            </div>
          ) : (
            <input type="hidden" {...register("currency")} />
          )}

          {/* Campos principales */}
          <div className="grid grid-cols-2 gap-4">
            <Controller
              name="period"
              control={control}
              render={({ field }) => (
                <MonthPicker
                  id="period"
                  label="Período"
                  value={field.value}
                  onChange={field.onChange}
                  marked={isSpecial ? undefined : marked}
                  error={errors.period?.message}
                />
              )}
            />
            <Input
              id="amount"
              type="number"
              step="0.01"
              label="Cuota (divisas)"
              placeholder="25.00"
              error={errors.amount?.message}
              {...register("amount")}
            />
            <Input
              id="bsPrice"
              type="number"
              step="0.01"
              label="Si pagan en Bs (opcional)"
              placeholder={amount ? `Igual: ${amount}` : "Igual a la cuota"}
              error={errors.bsPrice?.message}
              {...register("bsPrice")}
            />
            {!isSpecial && (
              <Input
                id="moraAmount"
                type="number"
                step="0.01"
                label="Mora (divisas)"
                placeholder="5.00"
                error={errors.moraAmount?.message}
                {...register("moraAmount")}
              />
            )}
            <Controller
              name="dueDate"
              control={control}
              render={({ field }) => (
                <DatePicker
                  id="dueDate"
                  label="Vencimiento"
                  value={field.value}
                  onChange={field.onChange}
                  shortcuts={dueShortcuts}
                  error={errors.dueDate?.message}
                />
              )}
            />
          </div>

          {/* Descripción (requerida para especial, opcional para regular) */}
          <Input
            id="description"
            label={isSpecial ? "Descripción del cargo *" : "Descripción (opcional)"}
            placeholder={
              isSpecial
                ? "Ej. Reparación bomba de agua Torre A"
                : "Ej. Cuota de asociación 2026-06"
            }
            error={errors.description?.message}
            {...register("description")}
          />

          {/* Destino */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13px] font-medium text-ios-secondary">¿A quién se emite?</p>
              <Segmented
                aria-label="Destino de la cuota"
                value={targetType}
                onChange={setTargetType}
                options={[
                  { key: "TOWERS", label: "Por torre" },
                  { key: "PROPERTIES", label: "Departamentos" },
                ]}
              />
            </div>

            {targetType === "TOWERS" && towers.length > 0 && (
              <div>
                <Controller
                  name="towerIds"
                  control={control}
                  render={({ field }) => {
                    // "Todas" es la ausencia de selección: el backend emite a todas las torres.
                    const all = field.value.length === 0;
                    const chip = (on: boolean) =>
                      cn(
                        "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors",
                        on
                          ? "border-brand-500/50 bg-brand-50 ring-1 ring-brand-500/30"
                          : "border-ios-separator hover:bg-ios-fill/60"
                      );
                    const tick = (on: boolean) => (
                      <span
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-colors",
                          on ? "bg-brand-600 text-white" : "border-[1.5px] border-ios-tertiary"
                        )}
                      >
                        {on && <Check className="h-3.5 w-3.5" strokeWidth={3.5} />}
                      </span>
                    );
                    return (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        <button type="button" aria-pressed={all} onClick={() => field.onChange([])} className={chip(all)}>
                          {tick(all)}
                          <span className="min-w-0">
                            <span className="block text-[14px] font-semibold text-ios-label">Todas</span>
                            <span className="block text-[12px] text-ios-secondary">{units.length} deptos.</span>
                          </span>
                        </button>
                        {towers.map((tower) => {
                          const on = field.value.includes(tower.id);
                          return (
                            <button
                              key={tower.id}
                              type="button"
                              aria-pressed={on}
                              onClick={() =>
                                field.onChange(on ? field.value.filter((id) => id !== tower.id) : [...field.value, tower.id])
                              }
                              className={chip(on)}
                            >
                              {tick(on)}
                              <span className="min-w-0">
                                <span className="block truncate text-[14px] font-semibold text-ios-label">{tower.name}</span>
                                <span className="block text-[12px] text-ios-secondary">
                                  {unitsByTower.get(tower.id) ?? 0} deptos.
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  }}
                />
                {filteringTowers && (
                  <p className="mt-1.5 text-xs text-ios-secondary">
                    Solo se emitirá a los departamentos de{" "}
                    {towers
                      .filter((t) => towerIds.includes(t.id))
                      .map((t) => t.name)
                      .join(", ")}
                    .
                  </p>
                )}
              </div>
            )}

            {targetType === "PROPERTIES" && (
              <div className="rounded-xl border border-ios-separator p-4 space-y-3 overflow-visible">
                <p className="text-sm font-medium text-ios-label">Departamentos seleccionados</p>
                <Controller
                  name="propertyIds"
                  control={control}
                  render={({ field }) => (
                    <>
                      <SearchSelect
                        value=""
                        onChange={(val) => {
                          if (val && !field.value?.includes(val)) {
                            field.onChange([...(field.value || []), val]);
                          }
                        }}
                        options={propertyOptions.filter((o) => !field.value?.includes(o.value))}
                        placeholder="Agregar un departamento…"
                        searchPlaceholder="Código, torre o titular…"
                      />
                      {field.value && field.value.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {field.value.map((id) => {
                            const unit = units.find((u) => u.id === id);
                            if (!unit) return null;
                            return (
                              <span
                                key={id}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-ios-fill px-2.5 py-1 text-sm font-medium text-ios-label"
                              >
                                {unit.code} {unit.tower && `(${unit.tower.name})`}
                                <button
                                  type="button"
                                  className="text-ios-secondary hover:text-ios-label focus:outline-none"
                                  onClick={() => field.onChange(field.value?.filter((v) => v !== id))}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                />
              </div>
            )}
          </div>

          {/* Resumen de lo que va a pasar, en una frase. */}
          {amount > 0 && (
            <div className="rounded-2xl bg-brand-50 px-4 py-3 text-[13px] text-ios-label">
              Se emitirán{" "}
              <span className="font-semibold">
                {targetCount} {targetCount === 1 ? "cuota" : "cuotas"}
              </span>{" "}
              de <span className="font-semibold">{formatCurrency(amount)}</span>
              {bsPrice !== null && (
                <>
                  {" "}
                  (<span className="font-semibold">{formatCurrency(bsPrice)}</span> si pagan en Bs)
                </>
              )}
              {targetCount > 1 && bsPrice === null && (
                <>
                  {" "}
                  (<span className="font-semibold">{formatCurrency(amount * targetCount)}</span> en total)
                </>
              )}
              .
              {rate && (
                <span className="mt-0.5 block text-ios-secondary">
                  Cada una equivale hoy a {formatBs(bsPrice ?? amount, rate.rate)} a la tasa BCV{" "}
                  {currency === RateCurrency.USD ? "dólar" : "euro"}.
                </span>
              )}
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end sm:gap-3">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit" loading={isSubmitting} disabled={targetCount === 0}>
              Emitir {targetCount > 0 ? `${targetCount} ${targetCount === 1 ? "cuota" : "cuotas"}` : "cuotas"}
            </Button>
          </div>
        </form>
  );
}
