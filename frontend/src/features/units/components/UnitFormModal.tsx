import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, Building } from "lucide-react";
import { Modal, ModalIcon } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { SearchSelect, SearchOption } from "@/components/ui/SearchSelect";
import { Button } from "@/components/ui/Button";
import { User } from "@/types/domain";
import { PropertyWithBalance } from "@/features/admin-panel/types";
import { ApiError } from "@/services/api";
import { formatDocumentId } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useTowers } from "@/features/towers/hooks/useTowers";
import { unitService } from "../services/unit.service";
import { unitSchema, UnitFormValues } from "../schema";

interface UnitFormModalProps {
  open: boolean;
  unit?: PropertyWithBalance | null;
  owners: User[];
  /** Usuarios que pueden figurar como autorizados (copropietarios + autorizados). */
  authorizedCandidates: User[];
  onClose: () => void;
  onSaved: () => void;
}

/** Bloque titulado del formulario. */
function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-[13px] font-semibold text-ios-label">{title}</h3>
        {hint && <p className="text-[12px] text-ios-secondary">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export function UnitFormModal({ open, unit, owners, authorizedCandidates, onClose, onSaved }: UnitFormModalProps) {
  const isEditing = !!unit;
  const { towers } = useTowers();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<UnitFormValues>({
    resolver: zodResolver(unitSchema),
    values: {
      code: unit?.code ?? "",
      towerId: unit?.tower?.id ?? "",
      ownerId: unit?.owner?.id ?? owners[0]?.id ?? "",
      authorizedId: unit?.authorized?.id ?? "",
    },
  });

  const towerId = watch("towerId");
  const ownerId = watch("ownerId");
  const authorizedId = watch("authorizedId");
  const sameAsOwner = !!ownerId && authorizedId === ownerId;

  const towerOptions: SearchOption[] = towers.map((t) => ({ value: t.id, label: t.name }));

  // La cédula va como `hint`: se muestra bajo el nombre y también se busca por ella.
  const ownerOptions: SearchOption[] = owners.map((o) => ({
    value: o.id,
    label: o.fullName,
    hint: formatDocumentId(o.cedulaTipo, o.cedula),
  }));

  const authorizedOptions: SearchOption[] = authorizedCandidates.map((u) => ({
    value: u.id,
    label: u.id === ownerId ? `${u.fullName} (titular)` : u.fullName,
    hint: formatDocumentId(u.cedulaTipo, u.cedula),
  }));

  const onSubmit = async (values: UnitFormValues) => {
    try {
      // authorizedId siempre viaja: "" desasigna el autorizado en el backend.
      const payload = {
        ...values,
        code: values.code.trim(),
        towerId: values.towerId || undefined,
        authorizedId: values.authorizedId ?? "",
      };
      if (isEditing && unit) {
        await unitService.update(unit.id, payload);
        toast.success(`${payload.code} actualizado`);
      } else {
        await unitService.create(payload);
        toast.success(`${payload.code} creado`);
      }
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo guardar");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? `Editar ${unit?.code}` : "Nuevo departamento"}
      description={isEditing ? "Cambia su torre, titular o autorizado." : "Identifícalo y asígnale su titular."}
      icon={
        <ModalIcon tone="bg-amber-500/[0.12] text-amber-600 dark:text-amber-400">
          <Building className="h-5 w-5" />
        </ModalIcon>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Section title="Identificación">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              id="code"
              label="Código"
              placeholder="Ej. Apt 4B"
              autoFocus={!isEditing}
              autoComplete="off"
              error={errors.code?.message}
              {...register("code")}
            />
            <SearchSelect
              id="towerId"
              label="Torre o bloque"
              value={towerId ?? ""}
              onChange={(v) => setValue("towerId", v, { shouldDirty: true })}
              options={towerOptions}
              emptyLabel="Sin torre"
              placeholder="Sin torre"
              searchPlaceholder="Buscar torre…"
              error={errors.towerId?.message}
            />
          </div>
        </Section>

        <Section title="Personas" hint="El titular es quien debe las cuotas; el autorizado puede reportar pagos en su nombre.">
          <SearchSelect
            id="ownerId"
            label="Titular"
            value={ownerId}
            onChange={(v) => setValue("ownerId", v, { shouldDirty: true, shouldValidate: true })}
            options={ownerOptions}
            placeholder="Elige al titular"
            searchPlaceholder="Nombre o cédula…"
            error={errors.ownerId?.message}
          />

          {/* Interruptor: dice el estado, no la acción. */}
          <button
            type="button"
            role="switch"
            aria-checked={sameAsOwner}
            disabled={!ownerId}
            onClick={() => setValue("authorizedId", sameAsOwner ? "" : ownerId, { shouldDirty: true })}
            className="flex w-full items-center justify-between gap-3 rounded-xl bg-ios-fill/60 px-4 py-3 text-left transition-colors hover:bg-ios-fill disabled:opacity-40"
          >
            <span>
              <span className="block text-[14px] font-medium text-ios-label">El titular también es el autorizado</span>
              <span className="block text-[12px] text-ios-secondary">Él mismo reporta sus pagos</span>
            </span>
            <span
              aria-hidden
              className={cn("relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors", sameAsOwner ? "bg-brand-600" : "bg-ios-separator")}
            >
              <span
                className={cn(
                  "absolute top-[3px] h-5 w-5 rounded-full bg-white shadow transition-[left]",
                  sameAsOwner ? "left-[21px]" : "left-[3px]"
                )}
              />
            </span>
          </button>

          {!sameAsOwner && (
            <SearchSelect
              id="authorizedId"
              label="Autorizado (opcional)"
              value={authorizedId ?? ""}
              onChange={(v) => setValue("authorizedId", v, { shouldDirty: true })}
              options={authorizedOptions}
              emptyLabel="Sin autorizado"
              placeholder="Sin autorizado"
              searchPlaceholder="Nombre o cédula…"
              error={errors.authorizedId?.message}
            />
          )}
        </Section>

        {owners.length === 0 && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3 text-[13px] text-amber-800 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              No hay copropietarios activos para asignar.{" "}
              <Link to="/admin/clientes" className="font-semibold underline underline-offset-2">
                Crea uno en Clientes
              </Link>
              .
            </p>
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={isSubmitting} disabled={owners.length === 0}>
            {isEditing ? "Guardar cambios" : "Crear departamento"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
