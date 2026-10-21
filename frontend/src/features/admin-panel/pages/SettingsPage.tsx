import { ChangeEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Building2, Coins, Landmark, LucideIcon, Receipt } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Page } from "@/components/ui/Page";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { api } from "@/services/api";

interface Settings {
  receipt_prefix: string;
  receipt_counter: string;
  condo_name: string;
  condo_city: string;
  condo_address: string;
  condo_rif: string;
  condo_phone: string;
  bank_name: string;
  bank_beneficiary: string;
  bank_account: string;
  bank_usd_name: string;
  bank_usd_beneficiary: string;
  bank_usd_account: string;
}

const EMPTY: Settings = {
  receipt_prefix: "RC",
  receipt_counter: "0",
  condo_name: "",
  condo_city: "Caracas",
  condo_address: "",
  condo_rif: "",
  condo_phone: "",
  bank_name: "",
  bank_beneficiary: "",
  bank_account: "",
  bank_usd_name: "",
  bank_usd_beneficiary: "",
  bank_usd_account: "",
};

const SECTIONS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "asociacion", label: "Asociación", icon: Building2 },
  { id: "recibos", label: "Recibos", icon: Receipt },
  { id: "cuenta-bs", label: "Cuenta en bolívares", icon: Landmark },
  { id: "cuenta-divisas", label: "Cuenta en divisas", icon: Coins },
];

function Section({
  id,
  icon: Icon,
  tone,
  title,
  description,
  aside,
  children,
}: {
  id: string;
  icon: LucideIcon;
  tone: string;
  title: string;
  description: string;
  /** Vista previa a la derecha en escritorio. */
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card id={id} className="scroll-mt-24 overflow-hidden">
      <div className="flex items-start gap-3 border-b border-ios-separator px-5 py-4">
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tone)}>
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-[16px] font-semibold text-ios-label">{title}</h2>
          <p className="text-[13px] text-ios-secondary">{description}</p>
        </div>
      </div>
      <div className={cn("grid gap-5 p-5", aside && "xl:grid-cols-[minmax(0,1fr)_260px]")}>
        <div className="space-y-4">{children}</div>
        {aside && <div className="xl:border-l xl:border-ios-separator xl:pl-5">{aside}</div>}
      </div>
    </Card>
  );
}

/** Cómo ve el vecino esta cuenta en "Datos de pago": así se revisa antes de guardar. */
function AccountPreview({ title, rows }: { title: string; rows: [string, string][] }) {
  const filled = rows.filter(([, v]) => v.trim());
  return (
    <div>
      <p className="mb-2 text-[12px] font-medium text-ios-secondary">Así la ven los vecinos</p>
      <div className="overflow-hidden rounded-xl border border-ios-separator">
        <p className="border-b border-ios-separator bg-ios-fill/50 px-3.5 py-2 text-[13px] font-semibold text-ios-label">{title}</p>
        {filled.length ? (
          <dl className="divide-y divide-ios-separator">
            {filled.map(([k, v]) => (
              <div key={k} className="px-3.5 py-2">
                <dt className="text-[11px] text-ios-secondary">{k}</dt>
                <dd className="break-all text-[13px] font-semibold tabular-nums text-ios-label">{v}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="px-3.5 py-4 text-[12px] text-ios-secondary">Sin datos: los vecinos no verán esta cuenta.</p>
        )}
      </div>
    </div>
  );
}

/** Datos de la asociación, numeración de recibos y cuentas para transferir. */
export function SettingsPage() {
  const [values, setValues] = useState<Settings>(EMPTY);
  const [saved, setSaved] = useState<Settings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<Settings>("/settings")
      .then(({ data }) => {
        const merged = { ...EMPTY, ...data };
        setValues(merged);
        setSaved(merged);
      })
      .catch(() => toast.error("No se pudieron cargar los ajustes"))
      .finally(() => setLoading(false));
  }, []);

  const changed = useMemo(
    () => (Object.keys(values) as (keyof Settings)[]).filter((k) => (values[k] ?? "") !== (saved[k] ?? "")),
    [values, saved]
  );
  const dirty = changed.length > 0;

  // Salir con cambios sin guardar lo pregunta el navegador.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = (key: keyof Settings) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  const save = async () => {
    setSaving(true);
    try {
      await api.patch("/settings", values);
      setSaved(values);
      toast.success("Ajustes guardados");
    } catch {
      toast.error("No se pudieron guardar los ajustes");
    } finally {
      setSaving(false);
    }
  };

  const nextReceipt = `${values.receipt_prefix.trim() || "RC"}-${String(Number(values.receipt_counter || 0) + 1).padStart(8, "0")}`;
  const field = (id: keyof Settings, label: string, placeholder: string, extra?: object) => (
    <Input id={id} label={label} placeholder={placeholder} disabled={loading} value={values[id]} onChange={set(id)} {...extra} />
  );

  return (
    <Page
      module="Finanzas y ajustes"
      title="Ajustes"
      subheader={<p className="text-[14px] text-ios-secondary">Los datos que salen en los recibos y en la pantalla de pago de los vecinos.</p>}
    >
      <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        {/* Índice: salta a cada sección en escritorio. */}
        <nav aria-label="Secciones de ajustes" className="hidden lg:block">
          <ul className="sticky top-24 space-y-1">
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[14px] font-medium text-ios-secondary transition-colors hover:bg-ios-fill hover:text-ios-label"
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-48 w-full !rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-5 pb-24">
            <Section
              id="asociacion"
              icon={Building2}
              tone="bg-indigo-500/[0.12] text-indigo-600 dark:text-indigo-400"
              title="Datos de la asociación"
              description="Aparecen en el encabezado de los recibos y estados de cuenta."
            >
              {field("condo_name", "Nombre", "Ej. Residencias Las Palmas")}
              <div className="grid gap-4 sm:grid-cols-2">
                {field("condo_rif", "RIF", "Ej. J-12345678-9")}
                {field("condo_phone", "Teléfono", "Ej. 0212-555 1234", { inputMode: "tel" })}
              </div>
              {field("condo_city", "Ciudad", "Ej. Caracas")}
              <div className="space-y-1.5">
                <label htmlFor="condo_address" className="block text-[13px] font-medium text-ios-secondary">
                  Dirección
                </label>
                <textarea
                  id="condo_address"
                  rows={2}
                  value={values.condo_address}
                  onChange={set("condo_address")}
                  placeholder="Ej. Av. Principal, Urb. Los Naranjos, Caracas"
                  className="w-full resize-none rounded-xl border-0 bg-ios-fill px-3.5 py-3 text-[15px] text-ios-label placeholder:text-ios-secondary focus:outline-none focus:ring-2 focus:ring-brand-500/70"
                />
              </div>
            </Section>

            <Section
              id="recibos"
              icon={Receipt}
              tone="bg-emerald-500/[0.12] text-emerald-600 dark:text-emerald-400"
              title="Recibos"
              description="Numeración de los recibos que se emiten al confirmar un pago."
              aside={
                <div>
                  <p className="mb-2 text-[12px] font-medium text-ios-secondary">Próximo recibo</p>
                  <div className="rounded-xl border border-dashed border-ios-separator px-4 py-5 text-center">
                    <p className="text-[11px] uppercase tracking-[0.08em] text-ios-secondary">Recibo N.º</p>
                    <p className="mt-1 text-[22px] font-bold tabular-nums tracking-tight text-ios-label">{nextReceipt}</p>
                  </div>
                </div>
              }
            >
              <div className="grid gap-4 sm:grid-cols-2">
                {field("receipt_prefix", "Prefijo", "Ej. RC, REC")}
                {field("receipt_counter", "Último número emitido", "0", { type: "number", min: "0", inputMode: "numeric" })}
              </div>
              <p className="text-[12px] text-ios-secondary">
                Súbelo solo si ya emitiste recibos fuera del sistema, para que la numeración no se repita. Bajarlo puede
                generar números duplicados.
              </p>
            </Section>

            <Section
              id="cuenta-bs"
              icon={Landmark}
              tone="bg-sky-500/[0.12] text-sky-600 dark:text-sky-400"
              title="Cuenta en bolívares"
              description="Para transferencias en Bs. Los pagos que llegan aquí se concilian con el extracto."
              aside={
                <AccountPreview
                  title="Pago en bolívares"
                  rows={[
                    ["Banco", values.bank_name],
                    ["Titular", values.bank_beneficiary],
                    ["Número de cuenta", values.bank_account],
                    ["RIF", values.condo_rif],
                  ]}
                />
              }
            >
              {field("bank_name", "Banco", "Ej. Banplus")}
              {field("bank_beneficiary", "Titular de la cuenta", "Ej. Asociación Civil Las Palmas")}
              {field("bank_account", "Número de cuenta", "Ej. 0174-0142-4914-2453-7189", { inputMode: "numeric" })}
            </Section>

            <Section
              id="cuenta-divisas"
              icon={Coins}
              tone="bg-lime-500/[0.14] text-lime-700 dark:text-lime-400"
              title="Cuenta en divisas"
              description="Para transferencias en $. No aparecen en el extracto en Bs, así que se confirman a mano."
              aside={
                <AccountPreview
                  title="Pago en divisas"
                  rows={[
                    ["Banco", values.bank_usd_name],
                    ["Titular", values.bank_usd_beneficiary],
                    ["Cuenta", values.bank_usd_account],
                  ]}
                />
              }
            >
              {field("bank_usd_name", "Banco o servicio", "Ej. Banesco Panamá, Zelle")}
              {field("bank_usd_beneficiary", "Titular de la cuenta", "Ej. Asociación Civil Las Palmas")}
              {field("bank_usd_account", "Número de cuenta o correo", "Ej. 0134-… o pagos@correo.com")}
            </Section>
          </div>
        )}
      </div>

      {/* Barra de cambios sin guardar: aparece solo cuando hay algo que guardar. */}
      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="popover-in mx-auto flex max-w-3xl items-center gap-3 rounded-2xl border border-black/[0.06] bg-ios-card/95 px-4 py-3 shadow-ios-lg backdrop-blur-xl dark:border-white/10">
            <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500 ring-4 ring-amber-500/20" />
            <p className="min-w-0 flex-1 text-[14px] text-ios-label">
              <span className="font-semibold">Cambios sin guardar</span>
              <span className="hidden text-ios-secondary sm:inline">
                {" "}
                · {changed.length} {changed.length === 1 ? "campo" : "campos"}
              </span>
            </p>
            <Button size="sm" variant="outline" onClick={() => setValues(saved)} disabled={saving}>
              Descartar
            </Button>
            <Button size="sm" onClick={save} loading={saving}>
              Guardar
            </Button>
          </div>
        </div>
      )}
    </Page>
  );
}
