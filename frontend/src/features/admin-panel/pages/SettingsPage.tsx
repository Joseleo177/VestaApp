import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { api } from "@/services/api";

interface Settings {
  receipt_prefix:   string;
  receipt_counter:  string;
  condo_name:       string;
  condo_city:       string;
  condo_address:    string;
  condo_rif:        string;
  condo_phone:      string;
  bank_name:        string;
  bank_beneficiary: string;
  bank_account:     string;
}

export function SettingsPage() {
  const [values, setValues] = useState<Settings>({
    receipt_prefix: "RC", receipt_counter: "0",
    condo_name: "", condo_city: "Caracas", condo_address: "",
    condo_rif: "", condo_phone: "",
    bank_name: "", bank_beneficiary: "", bank_account: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<Settings>("/settings").then(({ data }) => setValues(data)).finally(() => setLoading(false));
  }, []);

  const set = (key: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch("/settings", values);
      toast.success("Configuración guardada");
    } catch {
      toast.error("No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-[28px] font-bold leading-tight text-ios-label">Ajustes</h1>
        <p className="text-sm text-ios-secondary">Configuración general de la aplicación</p>
      </div>

      <Card className="p-6 space-y-5">
        <h2 className="font-semibold text-ios-label">Recibos</h2>
        <Input
          id="receipt_prefix"
          label="Prefijo"
          placeholder="Ej. RC, REC, COND"
          disabled={loading}
          value={values.receipt_prefix}
          onChange={set("receipt_prefix")}
        />
        <Input
          id="receipt_counter"
          type="number"
          min="0"
          label="Contador actual"
          placeholder="0"
          disabled={loading}
          value={values.receipt_counter}
          onChange={set("receipt_counter")}
        />
        <p className="text-xs text-ios-secondary">
          El próximo recibo será <strong>{values.receipt_prefix || "RC"}-{String(Number(values.receipt_counter || 0) + 1).padStart(8, "0")}</strong>.
          Cambia el contador si ya tienes recibos emitidos fuera del sistema.
        </p>
      </Card>

      <Card className="p-6 space-y-5">
        <h2 className="font-semibold text-ios-label">Datos de la asociación</h2>
        <Input
          id="condo_name"
          label="Nombre de la asociación"
          placeholder="Ej. Residencias Las Palmas"
          disabled={loading}
          value={values.condo_name}
          onChange={set("condo_name")}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            id="condo_rif"
            label="RIF"
            placeholder="Ej. J-12345678-9"
            disabled={loading}
            value={values.condo_rif}
            onChange={set("condo_rif")}
          />
          <Input
            id="condo_phone"
            label="Teléfono"
            placeholder="Ej. 0212-555 1234"
            disabled={loading}
            value={values.condo_phone}
            onChange={set("condo_phone")}
          />
        </div>
        <Input
          id="condo_city"
          label="Ciudad"
          placeholder="Ej. Caracas"
          disabled={loading}
          value={values.condo_city}
          onChange={set("condo_city")}
        />
        <Input
          id="condo_address"
          label="Dirección"
          placeholder="Ej. Av. Principal, Urb. Los Naranjos, Caracas"
          disabled={loading}
          value={values.condo_address}
          onChange={set("condo_address")}
        />
      </Card>

      <Card className="p-6 space-y-5">
        <h2 className="font-semibold text-ios-label">Cuenta bancaria para recaudación</h2>
        <p className="text-xs text-ios-secondary -mt-2">Se muestra a los propietarios en el formulario de pago.</p>
        <Input
          id="bank_name"
          label="Banco"
          placeholder="Ej. Banplus"
          disabled={loading}
          value={values.bank_name}
          onChange={set("bank_name")}
        />
        <Input
          id="bank_beneficiary"
          label="Beneficiario"
          placeholder="Ej. Asociacion Civil de Vivienda y Habitat"
          disabled={loading}
          value={values.bank_beneficiary}
          onChange={set("bank_beneficiary")}
        />
        <Input
          id="bank_account"
          label="Número de cuenta"
          placeholder="Ej. 0174-0142-4914-2453-7189"
          disabled={loading}
          value={values.bank_account}
          onChange={set("bank_account")}
        />
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} loading={saving} disabled={loading}>
          <Save className="h-4 w-4" />
          Guardar cambios
        </Button>
      </div>
    </div>
  );
}
