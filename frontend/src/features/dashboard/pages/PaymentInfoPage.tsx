import { ReactNode, useState } from "react";
import { Check, Copy, Landmark, MapPin, Phone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyBlock } from "@/components/ui/Ledger";
import { Money } from "@/components/ui/Money";
import { Page } from "@/components/ui/Page";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency } from "@/lib/format";
import { dueAmount } from "../dueDays";
import { useResident } from "../hooks/useResident";

/**
 * Un dato con su botón de copiar. Al transferir desde la app del banco lo que
 * se hace es copiar y pegar: el número de cuenta dictado o tipeado a mano es
 * donde se cuelan los errores.
 */
function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copiado`);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("No se pudo copiar; mantén presionado el dato para copiarlo");
    }
  };

  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[12px] text-ios-secondary">{label}</p>
        <p className="select-all break-all text-[15px] font-semibold tabular-nums text-ios-label">{value}</p>
      </div>
      <button
        type="button"
        onClick={copy}
        className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-ios-fill px-3 text-[13px] font-semibold text-ios-label transition-colors hover:bg-ios-separator"
        aria-label={`Copiar ${label.toLowerCase()}`}
      >
        {copied ? (
          <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
        ) : (
          <Copy className="h-4 w-4" />
        )}
        <span className="hidden sm:inline">{copied ? "Copiado" : "Copiar"}</span>
      </button>
    </div>
  );
}

function AccountCard({ title, hint, fields }: { title: string; hint: string; fields: [string, string | undefined][] }) {
  const present = fields.filter((f): f is [string, string] => !!f[1]?.trim());
  if (present.length === 0) return null;
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 border-b border-ios-separator px-5 py-3.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <Landmark className="h-[18px] w-[18px]" />
        </span>
        <div>
          <h2 className="text-[15px] font-semibold leading-tight text-ios-label">{title}</h2>
          <p className="text-[12px] text-ios-secondary">{hint}</p>
        </div>
      </div>
      <div className="divide-y divide-ios-separator">
        {present.map(([label, value]) => (
          <CopyField key={label} label={label} value={value} />
        ))}
      </div>
    </Card>
  );
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[12px] font-bold text-white">
        {n}
      </span>
      <span className="pt-0.5 text-[14px] text-ios-label">{children}</span>
    </li>
  );
}

/** Cuentas del condominio y cómo reportar un pago, sin tener que abrir el formulario. */
export function PaymentInfoPage() {
  const s = useResident();
  const cfg = s.settings ?? {};
  const payableTotal = s.payable.reduce((sum, c) => sum + dueAmount(c), 0);
  const rif = cfg.condo_rif?.trim();

  const bs = (
    <AccountCard
      title="Pago en bolívares"
      hint="Transferencia a la tasa BCV del día"
      fields={[
        ["Banco", cfg.bank_name],
        ["Titular", cfg.bank_beneficiary],
        ["Número de cuenta", cfg.bank_account],
        ["RIF", rif],
      ]}
    />
  );
  const usd = (
    <AccountCard
      title="Pago en divisas"
      hint="Transferencia en dólares"
      fields={[
        ["Banco", cfg.bank_usd_name],
        ["Titular", cfg.bank_usd_beneficiary],
        ["Cuenta", cfg.bank_usd_account],
      ]}
    />
  );
  const hasAccounts = [cfg.bank_account, cfg.bank_usd_account, cfg.bank_name, cfg.bank_usd_name].some((v) => v?.trim());

  return (
    <Page module="Mi cuenta" title="Datos de pago">
      <Card className="p-5">
        <h2 className="text-[15px] font-semibold text-ios-label">¿Cómo pago mi cuota?</h2>
        <ol className="mt-3 space-y-2.5">
          <Step n={1}>Transfiere a una de las cuentas de abajo el monto de tus cuotas.</Step>
          <Step n={2}>Registra el pago aquí, con la referencia y el comprobante.</Step>
          <Step n={3}>La administración lo valida y tu recibo queda en Mis cuotas.</Step>
        </ol>
        {s.payable.length > 0 && (
          <div className="mt-4 flex flex-col gap-3 rounded-xl bg-ios-fill/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[13px] text-ios-secondary">
              Tienes <Money value={formatCurrency(payableTotal)} className="font-semibold text-ios-label" /> por
              pagar
            </p>
            <Button size="sm" onClick={s.payAll}>
              Registrar mi pago
            </Button>
          </div>
        )}
      </Card>

      {s.loadingSettings ? (
        <Card className="space-y-3 p-5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </Card>
      ) : hasAccounts ? (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {bs}
          {usd}
        </div>
      ) : (
        <Card>
          <EmptyBlock
            title="La administración aún no cargó sus cuentas"
            hint="Consulta los datos para transferir directamente con la administración del condominio."
          />
        </Card>
      )}

      {(cfg.condo_phone?.trim() || cfg.condo_address?.trim()) && (
        <Card className="divide-y divide-ios-separator overflow-hidden">
          <p className="px-5 py-3 text-[13px] font-semibold text-ios-label">
            {cfg.condo_name || "Administración"}
            {rif && <span className="ml-2 font-normal tabular-nums text-ios-secondary">{rif}</span>}
          </p>
          {cfg.condo_phone?.trim() && (
            <a
              href={`tel:${cfg.condo_phone}`}
              className="flex items-center gap-3 px-5 py-3 text-[14px] text-ios-label transition-colors hover:bg-ios-fill/50"
            >
              <Phone className="h-4 w-4 text-ios-secondary" />
              <span className="tabular-nums">{cfg.condo_phone}</span>
            </a>
          )}
          {cfg.condo_address?.trim() && (
            <p className="flex items-start gap-3 px-5 py-3 text-[14px] text-ios-label">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ios-secondary" />
              {cfg.condo_address}
            </p>
          )}
        </Card>
      )}
    </Page>
  );
}
