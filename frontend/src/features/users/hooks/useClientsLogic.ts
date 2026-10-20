import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { UserRole } from "@/types/domain";
import { PropertyWithBalance } from "@/features/admin-panel/types";
import { formatDocumentId } from "@/lib/format";
import { matchesTerm } from "@/lib/search";
import { usePagination } from "@/lib/usePagination";
import { ApiError } from "@/services/api";
import { userService } from "../services/user.service";
import {
  Client,
  ClientSort,
  DEBT_EPSILON,
  isActiveClient,
  RoleFilter,
  StatusFilter,
} from "../types";
import { useClients } from "./useClients";

const PAGE_SIZE = 25;
const DETAIL_PARAM = "cliente";

/**
 * Todo el estado de la página de clientes: filtros, paginación, ficha abierta,
 * formulario y acciones. La página y sus componentes solo pintan.
 */
export function useClientsLogic() {
  const { clients, loading, refetch } = useClients();

  // ── Filtros ──
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<RoleFilter>("ALL");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [onlyDebtors, setOnlyDebtors] = useState(false);
  const [withoutUnits, setWithoutUnits] = useState(false);
  const [sort, setSort] = useState<ClientSort>("NAME");

  const filtersCount = (status !== "ALL" ? 1 : 0) + (onlyDebtors ? 1 : 0) + (withoutUnits ? 1 : 0);
  const hasQuery = filtersCount > 0 || role !== "ALL" || search.trim() !== "";

  const clearFilters = useCallback(() => {
    setStatus("ALL");
    setOnlyDebtors(false);
    setWithoutUnits(false);
  }, []);

  const clearAll = useCallback(() => {
    clearFilters();
    setRole("ALL");
    setSearch("");
  }, [clearFilters]);

  // Los conteos del selector de rol no dependen de los demás filtros: así no
  // saltan mientras se escribe en el buscador.
  const roleCounts = useMemo(() => {
    const counts: Record<RoleFilter, number> = {
      ALL: clients.length,
      [UserRole.OWNER]: 0,
      [UserRole.AUTHORIZED]: 0,
      [UserRole.ADMIN]: 0,
    };
    clients.forEach((c) => counts[c.role]++);
    return counts;
  }, [clients]);

  const filtered = useMemo(() => {
    const list = clients.filter((c) => {
      if (role !== "ALL" && c.role !== role) return false;
      if (status === "ACTIVE" && !isActiveClient(c)) return false;
      if (status === "INACTIVE" && isActiveClient(c)) return false;
      if (onlyDebtors && c.debt <= DEBT_EPSILON) return false;
      if (withoutUnits && (c.units.length > 0 || c.role === UserRole.ADMIN)) return false;
      return matchesTerm(search, [
        c.fullName,
        c.cedula,
        formatDocumentId(c.cedulaTipo, c.cedula),
        c.email,
        c.phone,
        ...c.units.map((u) => u.property.code),
      ]);
    });
    const byName = (a: Client, b: Client) => a.fullName.localeCompare(b.fullName, "es");
    return list.sort(sort === "DEBT" ? (a, b) => b.debt - a.debt || byName(a, b) : byName);
  }, [clients, role, status, onlyDebtors, withoutUnits, search, sort]);

  const paged = usePagination(filtered, PAGE_SIZE);

  // Deuda de lo que se está viendo. Se suma por departamento y no por cliente:
  // titular y autorizado de una misma unidad la contarían dos veces.
  const summary = useMemo(() => {
    const balances = new Map<string, number>();
    filtered.forEach((c) => c.units.forEach((u) => balances.set(u.property.id, Number(u.property.balance))));
    let debt = 0;
    balances.forEach((b) => b > DEBT_EPSILON && (debt += b));
    return {
      count: filtered.length,
      debtors: filtered.filter((c) => c.debt > DEBT_EPSILON).length,
      debt,
    };
  }, [filtered]);

  // ── Ficha ──
  // Va en la URL: el botón "atrás" del navegador la cierra y se puede compartir.
  const [params, setParams] = useSearchParams();
  const detailId = params.get(DETAIL_PARAM);
  const detail = detailId ? clients.find((c) => c.id === detailId) ?? null : null;

  const openDetail = useCallback(
    (c: Client) => {
      setParams({ [DETAIL_PARAM]: c.id });
      window.scrollTo({ top: 0 });
    },
    [setParams]
  );
  const closeDetail = useCallback(() => setParams({}), [setParams]);

  // Un enlace a un cliente que ya no existe vuelve al listado.
  useEffect(() => {
    if (!loading && detailId && !detail) setParams({}, { replace: true });
  }, [loading, detailId, detail, setParams]);

  // ── Formulario ──
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (c: Client) => {
    setEditing(c);
    setFormOpen(true);
  };
  const closeForm = () => setFormOpen(false);
  const onSaved = () => {
    setFormOpen(false);
    setEditing(null);
    void refetch();
  };

  // ── Activar / desactivar ──
  // Desactivar le corta el acceso, así que se confirma. Activar no hace daño.
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<Client | null>(null);

  const applyToggle = async (c: Client) => {
    const activate = !isActiveClient(c);
    setTogglingId(c.id);
    try {
      await userService.setActive(c.id, activate);
      toast.success(activate ? `${c.fullName} puede volver a entrar` : `${c.fullName} ya no puede entrar`);
      await refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo actualizar");
    } finally {
      setTogglingId(null);
      setConfirmDeactivate(null);
    }
  };

  const requestToggle = (c: Client) => {
    if (isActiveClient(c)) setConfirmDeactivate(c);
    else void applyToggle(c);
  };

  // ── Cuotas de un departamento ──
  const [unitOpen, setUnitOpen] = useState<PropertyWithBalance | null>(null);
  const openUnit = (p: PropertyWithBalance) => setUnitOpen(p);
  // Al cerrar se recarga: en el modal se pudo registrar un pago o exonerar.
  const closeUnit = () => {
    setUnitOpen(null);
    void refetch();
  };

  return {
    loading,
    // filtros
    search, setSearch,
    role, setRole, roleCounts,
    status, setStatus,
    onlyDebtors, setOnlyDebtors,
    withoutUnits, setWithoutUnits,
    sort, setSort,
    filtersCount, hasQuery, clearFilters, clearAll,
    // listado
    paged, summary,
    // ficha
    detailId, detail, openDetail, closeDetail,
    // formulario
    formOpen, editing, openNew, openEdit, closeForm, onSaved,
    // acceso
    togglingId, confirmDeactivate, setConfirmDeactivate, requestToggle, applyToggle,
    // cuotas
    unitOpen, openUnit, closeUnit,
  };
}
