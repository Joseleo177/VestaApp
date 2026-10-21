import { DatePicker, toISODate } from "@/components/ui/DatePicker";
import { Segmented } from "@/components/ui/Segmented";

export interface DateRange {
  from: string;
  to: string;
}

export interface RangePreset {
  key: string;
  label: string;
  /** null = personalizado: se eligen las dos fechas a mano. */
  range: (() => DateRange) | null;
}

const ymd = (y: number, m: number, d: number) => toISODate(new Date(y, m, d));

/** Atajos de rango habituales para reportes, calculados en hora local. */
export const PRESETS = {
  thisMonth: (): DateRange => {
    const n = new Date();
    return { from: ymd(n.getFullYear(), n.getMonth(), 1), to: ymd(n.getFullYear(), n.getMonth() + 1, 0) };
  },
  lastMonth: (): DateRange => {
    const n = new Date();
    return { from: ymd(n.getFullYear(), n.getMonth() - 1, 1), to: ymd(n.getFullYear(), n.getMonth(), 0) };
  },
  thisYear: (): DateRange => {
    const y = new Date().getFullYear();
    return { from: ymd(y, 0, 1), to: ymd(y, 11, 31) };
  },
};

interface RangePickerProps {
  presets: RangePreset[];
  preset: string;
  onPreset: (key: string) => void;
  custom: DateRange;
  onCustom: (r: DateRange) => void;
}

/**
 * Rango por atajos: lo habitual (este mes, el pasado) a un toque, y las dos
 * fechas a mano solo si se pide "Personalizado".
 */
export function RangePicker({ presets, preset, onPreset, custom, onCustom }: RangePickerProps) {
  const isCustom = presets.find((p) => p.key === preset)?.range === null;
  return (
    <div className="space-y-3">
      <div className="no-scrollbar -mx-5 overflow-x-auto px-5">
        <Segmented
          aria-label="Rango de fechas"
          value={preset}
          onChange={onPreset}
          options={presets.map((p) => ({ key: p.key, label: p.label }))}
        />
      </div>
      {isCustom && (
        <div className="grid grid-cols-2 gap-3">
          <DatePicker
            label="Desde"
            value={custom.from}
            onChange={(from) => onCustom({ ...custom, from })}
            placeholder="Inicio"
          />
          <DatePicker
            label="Hasta"
            value={custom.to}
            onChange={(to) => onCustom({ ...custom, to })}
            placeholder="Fin"
          />
        </div>
      )}
    </div>
  );
}

/** El rango efectivo de un atajo (o el personalizado). */
export function resolveRange(presets: RangePreset[], preset: string, custom: DateRange): DateRange {
  const p = presets.find((x) => x.key === preset);
  return p?.range ? p.range() : custom;
}

const short = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("es-VE", { day: "numeric", month: "short", year: "numeric" });

/** "del 1 oct. 2026 al 31 oct. 2026", "desde…", "hasta…" o "" si no hay fechas. */
export function describeRange({ from, to }: DateRange): string {
  if (from && to) return `del ${short(from)} al ${short(to)}`;
  if (from) return `desde el ${short(from)}`;
  if (to) return `hasta el ${short(to)}`;
  return "";
}
