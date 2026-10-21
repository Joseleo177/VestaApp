import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { Page } from "@/components/ui/Page";
import { Pagination } from "@/components/ui/Pagination";
import { SearchField } from "@/components/ui/SearchField";
import { Segmented } from "@/components/ui/Segmented";
import { PropertyWithBalance } from "@/features/admin-panel/types";
import { formatCurrency } from "@/lib/format";
import { matchesTerm } from "@/lib/search";
import { usePagination } from "@/lib/usePagination";
import { useUnits } from "../hooks/useUnits";
import { UnitsTable } from "../components/UnitsTable";
import { UnitFormModal } from "../components/UnitFormModal";
import { PropertyChargesModal } from "../components/PropertyChargesModal";

const EPS = 0.005;
type Filter = "ALL" | "DEBT" | "CURRENT";

const byCode = (a: PropertyWithBalance, b: PropertyWithBalance) =>
  a.code.localeCompare(b.code, "es", { numeric: true });

/** Unidades de la asociación con su titular, autorizado y saldo. */
export function UnitsPage() {
  const { units, owners, authorizedCandidates, loading, refetch } = useUnits();
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<PropertyWithBalance | null>(null);
  const [chargesOf, setChargesOf] = useState<PropertyWithBalance | null>(null);

  const [filter, setFilter] = useState<Filter>("ALL");
  const [tower, setTower] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  const towers = useMemo(() => {
    const map = new Map<string, string>();
    units.forEach((u) => u.tower && map.set(u.tower.id, u.tower.name));
    return [...map].sort((a, b) => a[1].localeCompare(b[1], "es", { numeric: true }));
  }, [units]);

  const inTower = useMemo(() => (tower === "ALL" ? units : units.filter((u) => u.tower?.id === tower)), [units, tower]);
  const debtors = inTower.filter((u) => Number(u.balance) > EPS);
  const debt = debtors.reduce((s, u) => s + Number(u.balance), 0);

  const filtered = useMemo(
    () =>
      inTower
        .filter((u) => (filter === "DEBT" ? Number(u.balance) > EPS : filter === "CURRENT" ? Number(u.balance) <= EPS : true))
        .filter((u) =>
          matchesTerm(search, [u.code, u.tower?.name, u.owner?.fullName, u.owner?.cedula, u.authorized?.fullName])
        )
        .sort(byCode),
    [inTower, filter, search]
  );
  const paged = usePagination(filtered, 25);
  const hasQuery = filter !== "ALL" || tower !== "ALL" || search.trim() !== "";

  const openCreate = () => {
    setEditing(null);
    setEditOpen(true);
  };
  const openEdit = (u: PropertyWithBalance) => {
    setEditing(u);
    setEditOpen(true);
  };
  const handleSaved = () => {
    setEditOpen(false);
    setEditing(null);
    void refetch();
  };

  return (
    <Page
      module="Asociación"
      title="Departamentos"
      actions={
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Nuevo departamento</span>
          <span className="sm:hidden">Nuevo</span>
        </Button>
      }
      subheader={
        !loading && units.length > 0 ? (
          <p className="text-[14px] text-ios-secondary">
            {units.length} departamentos
            {debtors.length > 0 ? (
              <>
                {" · "}
                <span className="font-semibold text-red-600 dark:text-red-400">{debtors.length}</span> con deuda ·{" "}
                <Money value={formatCurrency(debt)} className="font-semibold text-ios-label" /> por cobrar
                {tower !== "ALL" && " en esta torre"}
              </>
            ) : (
              " · todos al día"
            )}
            . Toca uno para ver sus cuotas.
          </p>
        ) : undefined
      }
    >
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-ios-separator p-4 lg:flex-row lg:items-center">
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
            <Segmented<Filter>
              aria-label="Saldo"
              value={filter}
              onChange={setFilter}
              options={[
                { key: "ALL", label: "Todos", count: inTower.length },
                { key: "DEBT", label: "Con deuda", count: debtors.length },
                { key: "CURRENT", label: "Al día", count: inTower.length - debtors.length },
              ]}
            />
            {/* Torres como filtro solo si hay más de una: con una, no separa nada. */}
            {towers.length > 1 && (
              <Segmented
                aria-label="Torre"
                value={tower}
                onChange={setTower}
                options={[{ key: "ALL", label: "Todas las torres" }, ...towers.map(([id, name]) => ({ key: id, label: name }))]}
              />
            )}
          </div>
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Código, torre, titular o cédula"
            className="lg:ml-auto lg:w-72"
            hotkey
          />
        </div>

        <UnitsTable
          units={paged.items}
          loading={loading}
          hasQuery={hasQuery}
          onClear={() => {
            setFilter("ALL");
            setTower("ALL");
            setSearch("");
          }}
          onOpen={setChargesOf}
          onEdit={openEdit}
        />

        <Pagination
          page={paged.page}
          totalPages={paged.totalPages}
          total={paged.total}
          from={paged.from}
          to={paged.to}
          onPageChange={paged.setPage}
          label="departamentos"
        />
      </Card>

      <UnitFormModal
        open={editOpen}
        unit={editing}
        owners={owners}
        authorizedCandidates={authorizedCandidates}
        onClose={() => setEditOpen(false)}
        onSaved={handleSaved}
      />

      <PropertyChargesModal
        property={chargesOf}
        open={!!chargesOf}
        onClose={() => {
          setChargesOf(null);
          // Desde el modal se pudo pagar, exonerar o condonar: los saldos cambian.
          void refetch();
        }}
      />
    </Page>
  );
}
