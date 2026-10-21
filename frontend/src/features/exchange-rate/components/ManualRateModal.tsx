import { useEffect, useState } from "react";
import { toast } from "sonner";
import { TrendingUp } from "lucide-react";
import { RateCurrency } from "@/types/domain";
import { Button } from "@/components/ui/Button";
import { DatePicker, toISODate } from "@/components/ui/DatePicker";
import { Input } from "@/components/ui/Input";
import { Modal, ModalIcon } from "@/components/ui/Modal";
import { Segmented } from "@/components/ui/Segmented";
import { formatDate, formatRate } from "@/lib/format";
import { ApiError } from "@/services/api";
import { exchangeRateService } from "../services/exchange-rate.service";
import { CURRENCY_NAME } from "./RateCard";

interface Props {
  open: boolean;
  onClose: () => void;
  currencies: RateCurrency[];
  defaultCurrency: RateCurrency;
  onSaved: (date: string) => void;
}

/**
 * Tasa a mano: para un día en que el BCV no respondió, o para cargar una fecha
 * pasada. La vista previa dice exactamente qué se va a guardar.
 */
export function ManualRateModal({ open, onClose, currencies, defaultCurrency, onSaved }: Props) {
  const today = toISODate(new Date());
  const [currency, setCurrency] = useState(defaultCurrency);
  const [date, setDate] = useState(today);
  const [rate, setRate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCurrency(defaultCurrency);
      setDate(today);
      setRate("");
    }
  }, [open, defaultCurrency, today]);

  const value = parseFloat(rate.replace(",", "."));
  const valid = value > 0;
  const future = date > today;

  const save = async () => {
    if (!valid || future) return;
    setSaving(true);
    try {
      await exchangeRateService.save(value, currency, date);
      toast.success(`Tasa del ${formatDate(date)} guardada: ${formatRate(value)} Bs/${currency}`);
      onSaved(date);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo guardar la tasa");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Registrar tasa a mano"
      description="Para un día sin respuesta del BCV o una fecha pasada."
      icon={
        <ModalIcon tone="bg-lime-500/[0.14] text-lime-700 dark:text-lime-400">
          <TrendingUp className="h-5 w-5" />
        </ModalIcon>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {currencies.length > 1 && (
          <div className="space-y-1.5">
            <p className="text-[13px] font-medium text-ios-secondary">Moneda</p>
            <Segmented
              aria-label="Moneda"
              value={currency}
              onChange={setCurrency}
              className="w-full [&>button]:flex-1 [&>button]:justify-center"
              options={currencies.map((c) => ({ key: c, label: `${CURRENCY_NAME[c]} (${c})` }))}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <DatePicker
            label="Fecha"
            value={date}
            onChange={setDate}
            error={future ? "No puede ser una fecha futura" : undefined}
          />
          <Input
            id="manualRate"
            label={`Tasa (Bs/${currency})`}
            inputMode="decimal"
            placeholder="Ej. 993,1760"
            value={rate}
            autoFocus
            onChange={(e) => setRate(e.target.value)}
          />
        </div>

        <div className="rounded-2xl bg-ios-fill/60 px-4 py-3">
          <p className="text-[12px] text-ios-secondary">Se guardará</p>
          <p className="text-[18px] font-bold tabular-nums text-ios-label">
            1 {currency} = {valid ? `Bs. ${formatRate(value)}` : "Bs. —"}
          </p>
          <p className="text-[12px] text-ios-secondary">
            para el {formatDate(date)}
            {date === today && " (hoy: pasa a ser la tasa vigente)"}. Si ya había una tasa ese día, se reemplaza.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving} disabled={!valid || future}>
            Guardar tasa
          </Button>
        </div>
      </form>
    </Modal>
  );
}
