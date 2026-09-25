import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ChargeType, RateCurrency } from "@/types/domain";
import { formatBs } from "@/lib/format";
import { ApiError } from "@/services/api";
import { useExchangeRate } from "@/features/exchange-rate/hooks/useExchangeRate";
import { useTowers } from "@/features/towers/hooks/useTowers";
import { useUnits } from "@/features/units/hooks/useUnits";
import { SearchSelect } from "@/components/ui/SearchSelect";
import { X } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { billingService } from "../services/billing.service";
import { generateChargesSchema, GenerateChargesValues } from "../schema";

interface GenerateChargesFormProps {
  onGenerated: () => void;
}

export function GenerateChargesForm({ onGenerated }: GenerateChargesFormProps) {
  const { data: rates, rateOf } = useExchangeRate();
  const { towers } = useTowers();
  const { units } = useUnits();
  const thisMonth = new Date().toISOString().slice(0, 7);

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
  const type = watch("type");
  const towerIds = watch("towerIds");
  const isSpecial = type === ChargeType.SPECIAL;
  const filteringTowers = towerIds.length > 0;

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
    <Card>
      <CardHeader>
        <h2 className="text-base font-semibold text-ios-label">Emitir cuota</h2>
        <p className="text-sm text-ios-secondary">
          Regular: cuota mensual fija. Especial: mantenimiento o cargo puntual.
        </p>
      </CardHeader>
      <CardBody>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Tipo */}
          <div className="flex gap-3">
            {([ChargeType.REGULAR, ChargeType.SPECIAL] as const).map((t) => (
              <label
                key={t}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                  type === t
                    ? "border-brand-600 bg-brand-50 text-brand-700"
                    : "border-ios-separator text-ios-label hover:border-ios-separator"
                }`}
              >
                <input
                  type="radio"
                  className="hidden"
                  value={t}
                  {...register("type")}
                />
                {t === ChargeType.REGULAR ? "Regular (mensual)" : "Especial (mantenimiento)"}
              </label>
            ))}
          </div>

          {/* Tasa de cobro: solo se elige si hay más de una activa */}
          {activeCurrencies.length > 1 ? (
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-ios-label">Tasa de cobro en Bs</p>
              <div className="flex gap-3">
                {activeCurrencies.map((c) => (
                  <label
                    key={c}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                      currency === c
                        ? "border-brand-600 bg-brand-50 text-brand-700"
                        : "border-ios-separator text-ios-label hover:border-ios-separator"
                    }`}
                  >
                    <input type="radio" className="hidden" value={c} {...register("currency")} />
                    {c === RateCurrency.USD ? "BCV Dólar ($)" : "BCV Euro (€)"}
                    {c === rates?.primary && (
                      <span className="text-xs font-normal text-ios-secondary">principal</span>
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              id="period"
              type="month"
              label="Período"
              error={errors.period?.message}
              {...register("period")}
            />
            <Input
              id="amount"
              type="number"
              step="0.01"
              label="Cuota (REF)"
              placeholder="25.00"
              error={errors.amount?.message}
              {...register("amount")}
            />
            {!isSpecial && (
              <Input
                id="moraAmount"
                type="number"
                step="0.01"
                label="Mora (REF)"
                placeholder="5.00"
                error={errors.moraAmount?.message}
                {...register("moraAmount")}
              />
            )}
            <Input
              id="dueDate"
              type="date"
              label="Vencimiento"
              error={errors.dueDate?.message}
              {...register("dueDate")}
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
            <div className="flex items-center gap-4">
              <p className="text-sm font-medium text-ios-label">Destino de la cuota:</p>
              <div className="flex gap-2">
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="targetType"
                    checked={targetType === "TOWERS"}
                    onChange={() => setTargetType("TOWERS")}
                    className="text-brand-600 focus:ring-brand-600"
                  />
                  <span>Torres</span>
                </label>
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="targetType"
                    checked={targetType === "PROPERTIES"}
                    onChange={() => setTargetType("PROPERTIES")}
                    className="text-brand-600 focus:ring-brand-600"
                  />
                  <span>Departamentos</span>
                </label>
              </div>
            </div>

            {targetType === "TOWERS" && towers.length > 0 && (
              <div className="rounded-xl border border-ios-separator p-4">
                <p className="mb-2 text-sm font-medium text-ios-label">
                  Torres destino{" "}
                  <span className="font-normal text-ios-secondary">
                    (sin selección = todas las torres)
                  </span>
                </p>
                <Controller
                  name="towerIds"
                  control={control}
                  render={({ field }) => (
                    <div className="flex flex-wrap gap-3">
                      {towers.map((tower) => {
                        const checked = field.value.includes(tower.id);
                        return (
                          <label
                            key={tower.id}
                            className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                              checked
                                ? "border-brand-600 bg-brand-50 text-brand-700"
                                : "border-ios-separator text-ios-label hover:border-ios-separator"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-ios-separator text-brand-600"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  field.onChange([...field.value, tower.id]);
                                } else {
                                  field.onChange(field.value.filter((id) => id !== tower.id));
                                }
                              }}
                            />
                            {tower.name}
                          </label>
                        );
                      })}
                    </div>
                  )}
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
                        placeholder="Buscar departamento..."
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

          {amount > 0 && rate && (
            <p className="rounded-xl bg-ios-fill px-3 py-2 text-sm text-ios-label">
              La cuota equivale a{" "}
              <span className="font-semibold text-ios-label">
                {formatBs(amount, rate.rate)}
              </span>{" "}
              a la tasa BCV {currency === RateCurrency.USD ? "dólar" : "euro"} de hoy.
            </p>
          )}

          <div className="flex justify-end">
            <Button type="submit" loading={isSubmitting}>
              Emitir cuotas
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
