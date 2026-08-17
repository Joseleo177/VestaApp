import { useEffect, useMemo, useState } from "react";

export interface Pagination<T> {
  /** Los elementos de la página actual. */
  items: T[];
  page: number;
  totalPages: number;
  /** Total de elementos, ya filtrados. */
  total: number;
  /** Índice 1-based del primer y último elemento mostrados. */
  from: number;
  to: number;
  setPage: (page: number) => void;
}

/**
 * Pagina en cliente una lista ya cargada y filtrada.
 *
 * Vuelve a la página 1 cuando cambia el tamaño de la lista, para que al
 * escribir en un buscador no te quedes viendo una página vacía.
 */
export function usePagination<T>(items: T[], pageSize = 25): Pagination<T> {
  const [page, setPage] = useState(1);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    setPage(1);
  }, [total]);

  // Si la lista se acorta estando en la última página, no dejamos el
  // índice fuera de rango mientras el efecto de arriba no haya corrido.
  const safePage = Math.min(page, totalPages);

  const paged = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize]
  );

  return {
    items: paged,
    page: safePage,
    totalPages,
    total,
    from: total === 0 ? 0 : (safePage - 1) * pageSize + 1,
    to: Math.min(safePage * pageSize, total),
    setPage,
  };
}