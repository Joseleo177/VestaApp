import { forwardRef, ReactNode, useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { FilterPopover } from "./FilterPopover";

// Calendarios propios en lugar de <input type="date|month">: el nativo cambia de
// aspecto en cada navegador y sistema, no sigue el modo noche ni los colores de
// la app, y en un modal abría por fuera de él.

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];

const pad = (n: number) => String(n).padStart(2, "0");
/** "2026-10-21" en hora local (toISOString daría el día de UTC). */
export const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseISO = (s?: string) => {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  return y && m ? new Date(y, m - 1, d || 1) : null;
};
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export interface DateShortcut {
  label: string;
  value: string;
}

interface FieldProps {
  id?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
}

/** El campo que abre el calendario: mismo alto, relleno y foco que los Input. */
const Trigger = forwardRef<
  HTMLButtonElement,
  FieldProps & { open: boolean; display: string | null; onClick: () => void; trailing?: ReactNode }
>(({ id, error, disabled, placeholder, open, display, onClick, trailing }, ref) => (
  <button
    ref={ref}
    id={id}
    type="button"
    disabled={disabled}
    onClick={onClick}
    aria-haspopup="dialog"
    aria-expanded={open}
    className={cn(
      "group flex h-11 w-full items-center gap-2.5 rounded-xl bg-ios-fill px-3.5 text-left text-[15px] transition-shadow",
      "focus:outline-none focus:ring-2 disabled:opacity-40",
      error ? "ring-1 ring-ios-red/50 focus:ring-ios-red" : "focus:ring-brand-500/70",
      open && !error && "ring-2 ring-brand-500/70"
    )}
  >
    <CalendarDays
      className={cn("h-[18px] w-[18px] shrink-0 transition-colors", open ? "text-brand-600" : "text-ios-secondary")}
    />
    <span className={cn("min-w-0 flex-1 truncate", display ? "text-ios-label" : "text-ios-secondary")}>
      {display ?? placeholder}
    </span>
    {trailing}
  </button>
));
Trigger.displayName = "Trigger";

function Field({ id, label, error, children }: FieldProps & { children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-[13px] font-medium text-ios-secondary">
          {label}
        </label>
      )}
      {children}
      {error && <p className="text-[13px] font-medium text-ios-red">{error}</p>}
    </div>
  );
}

const navBtn =
  "flex h-8 w-8 items-center justify-center rounded-lg text-ios-secondary transition-colors hover:bg-ios-fill hover:text-ios-label";

// ─────────────────────────────────────────────────────────────── DatePicker

interface DatePickerProps extends FieldProps {
  /** "YYYY-MM-DD" o vacío. */
  value?: string;
  onChange: (value: string) => void;
  /** Atajos al pie del calendario. Por defecto, "Hoy". */
  shortcuts?: DateShortcut[];
  /** Última fecha elegible ("YYYY-MM-DD"): las posteriores quedan deshabilitadas. */
  max?: string;
}

export function DatePicker({ value, onChange, shortcuts, max, placeholder = "Elige una fecha", ...field }: DatePickerProps) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"days" | "months">("days");
  const selected = parseISO(value);
  const [view, setView] = useState(() => selected ?? new Date());

  // Al abrir, el calendario va al mes de la fecha elegida (o al de hoy).
  useEffect(() => {
    if (open) {
      setView(parseISO(value) ?? new Date());
      setMode("days");
    }
  }, [open, value]);

  const today = toISODate(new Date());
  const y = view.getFullYear();
  const m = view.getMonth();
  const offset = (new Date(y, m, 1).getDay() + 6) % 7; // lunes primero
  const days = Array.from({ length: 42 }, (_, i) => new Date(y, m, i - offset + 1));

  const pick = (iso: string) => {
    onChange(iso);
    setOpen(false);
    anchorRef.current?.focus();
  };

  const display = selected
    ? capitalize(selected.toLocaleDateString("es-VE", { weekday: "short", day: "numeric", month: "short", year: "numeric" }))
    : null;
  // Un atajo que cae después del límite no se ofrece.
  const quick = (shortcuts ?? [{ label: "Hoy", value: today }]).filter((s) => !max || !s.value || s.value <= max);

  return (
    <Field {...field}>
      <Trigger
        ref={anchorRef}
        {...field}
        placeholder={placeholder}
        open={open}
        display={display}
        onClick={() => setOpen((v) => !v)}
      />
      <FilterPopover open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} width={300} align="start">
        <div className="p-3" role="dialog" aria-label="Elegir fecha">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMode((v) => (v === "days" ? "months" : "days"))}
              className="rounded-lg px-2 py-1 text-[15px] font-semibold text-ios-label transition-colors hover:bg-ios-fill"
            >
              {mode === "days" ? capitalize(view.toLocaleDateString("es-VE", { month: "long", year: "numeric" })) : y}
            </button>
            <div className="flex">
              <button
                type="button"
                className={navBtn}
                aria-label={mode === "days" ? "Mes anterior" : "Año anterior"}
                onClick={() => setView(mode === "days" ? new Date(y, m - 1, 1) : new Date(y - 1, m, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                className={navBtn}
                aria-label={mode === "days" ? "Mes siguiente" : "Año siguiente"}
                onClick={() => setView(mode === "days" ? new Date(y, m + 1, 1) : new Date(y + 1, m, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {mode === "days" ? (
            <>
              <div className="grid grid-cols-7">
                {WEEKDAYS.map((d) => (
                  <span key={d} className="flex h-7 items-center justify-center text-[11px] font-semibold text-ios-secondary">
                    {d}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-y-0.5">
                {days.map((d) => {
                  const iso = toISODate(d);
                  const inMonth = d.getMonth() === m;
                  const isSel = iso === value;
                  const isToday = iso === today;
                  const out = !!max && iso > max;
                  return (
                    <button
                      key={iso}
                      type="button"
                      onClick={() => pick(iso)}
                      disabled={out}
                      aria-pressed={isSel}
                      aria-label={d.toLocaleDateString("es-VE", { dateStyle: "full" })}
                      className={cn(
                        "relative mx-auto flex h-9 w-9 items-center justify-center rounded-full text-[13px] tabular-nums transition-colors",
                        "disabled:pointer-events-none disabled:text-ios-tertiary disabled:line-through disabled:decoration-ios-tertiary/60",
                        isSel
                          ? "bg-brand-600 font-semibold text-white"
                          : inMonth
                            ? "text-ios-label hover:bg-ios-fill"
                            : "text-ios-tertiary hover:bg-ios-fill/60",
                        isToday && !isSel && "font-semibold text-brand-600"
                      )}
                    >
                      {d.getDate()}
                      {isToday && !isSel && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-brand-600" />}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="grid grid-cols-3 gap-1.5 py-1">
              {MONTHS.map((name, i) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    setView(new Date(y, i, 1));
                    setMode("days");
                  }}
                  className={cn(
                    "h-10 rounded-xl text-[13px] font-medium capitalize transition-colors",
                    i === m ? "bg-brand-50 font-semibold text-brand-700" : "text-ios-label hover:bg-ios-fill"
                  )}
                >
                  {name}
                </button>
              ))}
            </div>
          )}

          <div className="mt-2 flex flex-wrap gap-1.5 border-t border-ios-separator pt-2.5">
            {quick.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => pick(s.value)}
                className={cn(
                  "h-7 rounded-full px-2.5 text-[12px] font-medium transition-colors",
                  s.value === value ? "bg-brand-600 text-white" : "bg-ios-fill text-ios-label hover:bg-ios-separator"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </FilterPopover>
    </Field>
  );
}

// ────────────────────────────────────────────────────────────── MonthPicker

interface MonthPickerProps extends FieldProps {
  /** "YYYY-MM". */
  value?: string;
  onChange: (value: string) => void;
  /** Meses a señalar con un punto y su motivo (p. ej. "ya emitido"). */
  marked?: Record<string, string>;
}

export function MonthPicker({ value, onChange, marked = {}, placeholder = "Elige un mes", ...field }: MonthPickerProps) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const selected = parseISO(value);
  const [year, setYear] = useState(() => (selected ?? new Date()).getFullYear());

  useEffect(() => {
    if (open) setYear((parseISO(value) ?? new Date()).getFullYear());
  }, [open, value]);

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonth = `${next.getFullYear()}-${pad(next.getMonth() + 1)}`;

  const pick = (key: string) => {
    onChange(key);
    setOpen(false);
    anchorRef.current?.focus();
  };

  const display = selected ? capitalize(selected.toLocaleDateString("es-VE", { month: "long", year: "numeric" })) : null;
  const note = value ? marked[value] : undefined;

  return (
    <Field {...field}>
      <Trigger
        ref={anchorRef}
        {...field}
        placeholder={placeholder}
        open={open}
        display={display}
        onClick={() => setOpen((v) => !v)}
        trailing={
          note && (
            <span className="shrink-0 rounded-md bg-amber-500/[0.12] px-1.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
              {note}
            </span>
          )
        }
      />
      <FilterPopover open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} width={280} align="start">
        <div className="p-3" role="dialog" aria-label="Elegir mes">
          <div className="mb-2 flex items-center justify-between">
            <span className="px-2 text-[15px] font-semibold tabular-nums text-ios-label">{year}</span>
            <div className="flex">
              <button type="button" className={navBtn} aria-label="Año anterior" onClick={() => setYear((v) => v - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button type="button" className={navBtn} aria-label="Año siguiente" onClick={() => setYear((v) => v + 1)}>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {MONTHS.map((name, i) => {
              const key = `${year}-${pad(i + 1)}`;
              const isSel = key === value;
              const mark = marked[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => pick(key)}
                  title={mark ? `${capitalize(name)}: ${mark}` : undefined}
                  className={cn(
                    "relative flex h-11 flex-col items-center justify-center rounded-xl text-[13px] capitalize transition-colors",
                    isSel ? "bg-brand-600 font-semibold text-white" : "text-ios-label hover:bg-ios-fill",
                    key === thisMonth && !isSel && "font-semibold text-brand-600 ring-1 ring-inset ring-brand-500/30"
                  )}
                >
                  {name}
                  {mark && (
                    <span
                      className={cn(
                        "absolute bottom-1.5 h-1 w-1 rounded-full",
                        isSel ? "bg-white" : "bg-amber-500"
                      )}
                    />
                  )}
                </button>
              );
            })}
          </div>
          {Object.keys(marked).length > 0 && (
            <p className="mt-2 flex items-center gap-1.5 px-1 text-[11px] text-ios-secondary">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Ya tiene cuota emitida
            </p>
          )}
          <div className="mt-2 flex gap-1.5 border-t border-ios-separator pt-2.5">
            {[
              { label: "Este mes", value: thisMonth },
              { label: "Próximo mes", value: nextMonth },
            ].map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => pick(s.value)}
                className={cn(
                  "h-7 rounded-full px-2.5 text-[12px] font-medium transition-colors",
                  s.value === value ? "bg-brand-600 text-white" : "bg-ios-fill text-ios-label hover:bg-ios-separator"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </FilterPopover>
    </Field>
  );
}
