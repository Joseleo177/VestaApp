import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ChargeType } from "@/types/domain";
import { formatBs } from "@/lib/format";
import { ApiError } from "@/services/api";
import { useExchangeRate } from "@/features/exchange-rate/hooks/useExchangeRate";
import { useTowers } from "@/features/towers/hooks/useTowers";
import { billingService } from "../services/billing.service";
import { generateChargesSchema, GenerateChargesValues } from "../schema";

interface GenerateChargesFormProps {
  onGenerated: () => void;
}

export function GenerateChargesForm({ onGenerated }: GenerateChargesFormProps) {
  const { data: rate } = useExchangeRate();
  const { towers } = useTowers();
  const thisMonth = new Date().toISOString().slice(0, 7);

  const {
    register,
    handleSubmit,
    watch,
    control,
    formState: { errors, isSubmitting },
  } = useForm<GenerateChargesValues>({
    resolver: zodResolver(generateChargesSchema),
    defaultValues: {
      period: thisMonth,
      moraAmount: 5,
      type: ChargeType.REGULAR,
      towerIds: [],
    },
  });

  const amount = watch("amount");
  const type = watch("type");
  const towerIds = watch("towerIds");
  const isSpecial = type === ChargeType.SPECIAL;
  const filteringTowers = towerIds.length > 0;

  const onSubmit = async (values: GenerateChargesValues) => {
    try {
      const result = await billingService.generate({
        ...values,
        moraAmount: isSpecial ? 0 : values.moraAmount,
      });
      toast.success(`Emitido: ${result.created} cuotas creadas`);
      onGenerated();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo emitir");
    }
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="text-base font-semibold text-slate-800">Emitir cuota</h2>
        <p className="text-sm text-slate-500">
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
                    : "border-slate-200 text-slate-600 hover:border-slate-300"
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
              label="Cuota (€)"
              placeholder="25.00"
              error={errors.amount?.message}
              {...register("amount")}
            />
            {!isSpecial && (
              <Input
                id="moraAmount"
                type="number"
                step="0.01"
                label="Mora (€)"
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
                : "Ej. Cuota de condominio 2026-06"
            }
            error={errors.description?.message}
            {...register("description")}
          />

          {/* Selección de torres */}
          {towers.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">
                Torres destino{" "}
                <span className="font-normal text-slate-400">
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
                              : "border-slate-200 text-slate-600 hover:border-slate-300"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300 text-brand-600"
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
                <p className="mt-1.5 text-xs text-slate-400">
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

          {amount > 0 && rate && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              La cuota equivale a{" "}
              <span className="font-semibold text-slate-800">
                {formatBs(amount, rate.rate)}
              </span>{" "}
              a la tasa BCV de hoy.
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
