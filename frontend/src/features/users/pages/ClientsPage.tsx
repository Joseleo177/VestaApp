import { Pencil, Plus, Power, PowerOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Page } from "@/components/ui/Page";
import { Pagination } from "@/components/ui/Pagination";
import { PropertyChargesModal } from "@/features/units/components/PropertyChargesModal";
import { useClientsLogic } from "../hooks/useClientsLogic";
import { ClientTable } from "../components/ClientTable";
import { ClientToolbar } from "../components/ClientToolbar";
import { ClientDetail, ClientDetailSkeleton } from "../components/ClientDetail";
import { UserFormModal } from "../components/UserFormModal";
import { isActiveClient } from "../types";

/**
 * Clientes de la asociación: copropietarios, autorizados y administradores.
 * Listado con su deuda y, al tocar una fila, su ficha con los departamentos.
 */
export function ClientsPage() {
  const s = useClientsLogic();
  const { detail } = s;
  const showingDetail = !!s.detailId;

  const actions = showingDetail ? (
    detail && (
      <>
        <Button size="sm" variant="outline" onClick={() => s.openEdit(detail)}>
          <Pencil className="h-4 w-4" />
          Editar
        </Button>
        <Button
          size="sm"
          variant="outline"
          loading={s.togglingId === detail.id}
          onClick={() => s.requestToggle(detail)}
        >
          {isActiveClient(detail) ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
          {isActiveClient(detail) ? "Desactivar" : "Activar"}
        </Button>
      </>
    )
  ) : (
    <Button size="sm" onClick={s.openNew}>
      <Plus className="h-4 w-4" />
      <span className="hidden sm:inline">Nuevo cliente</span>
      <span className="sm:hidden">Nuevo</span>
    </Button>
  );

  return (
    <Page
      module="Clientes"
      title={showingDetail ? "Ficha del cliente" : "Clientes"}
      actions={actions}
      onBack={showingDetail ? s.closeDetail : undefined}
      backLabel="Clientes"
    >
      {showingDetail ? (
        detail ? (
          <ClientDetail client={detail} onOpenUnit={s.openUnit} />
        ) : (
          <ClientDetailSkeleton />
        )
      ) : (
        <Card className="overflow-hidden">
          <ClientToolbar
            search={s.search}
            onSearch={s.setSearch}
            role={s.role}
            onRole={s.setRole}
            roleCounts={s.roleCounts}
            status={s.status}
            onStatus={s.setStatus}
            onlyDebtors={s.onlyDebtors}
            onOnlyDebtors={s.setOnlyDebtors}
            withoutUnits={s.withoutUnits}
            onWithoutUnits={s.setWithoutUnits}
            sort={s.sort}
            onSort={s.setSort}
            filtersCount={s.filtersCount}
            onClearFilters={s.clearFilters}
            summary={s.summary}
            loading={s.loading}
          />
          <ClientTable
            clients={s.paged.items}
            loading={s.loading}
            hasQuery={s.hasQuery}
            onClear={s.clearAll}
            onOpen={s.openDetail}
            onEdit={s.openEdit}
            onToggle={s.requestToggle}
            togglingId={s.togglingId}
          />
          <Pagination
            page={s.paged.page}
            totalPages={s.paged.totalPages}
            total={s.paged.total}
            from={s.paged.from}
            to={s.paged.to}
            onPageChange={s.paged.setPage}
            label="clientes"
          />
        </Card>
      )}

      <UserFormModal open={s.formOpen} user={s.editing} onClose={s.closeForm} onSaved={s.onSaved} />

      <ConfirmDialog
        open={!!s.confirmDeactivate}
        onClose={() => s.setConfirmDeactivate(null)}
        onConfirm={() => s.confirmDeactivate && void s.applyToggle(s.confirmDeactivate)}
        loading={!!s.togglingId}
        title="¿Desactivar el acceso?"
        description={`${s.confirmDeactivate?.fullName ?? ""} no podrá iniciar sesión ni reportar pagos hasta que lo vuelvas a activar. Sus departamentos y su historial no cambian.`}
        confirmLabel="Desactivar"
      />

      <PropertyChargesModal property={s.unitOpen} open={!!s.unitOpen} onClose={s.closeUnit} />
    </Page>
  );
}
