import { useState } from "react";
import { Pencil, Power, PowerOff, Users as UsersIcon } from "lucide-react";
import { toast } from "sonner";
import { User } from "@/types/domain";
import { Card } from "@/components/ui/Card";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ApiError } from "@/services/api";
import { userService } from "../services/user.service";
import { ROLE_LABELS } from "../types";

interface UsersTableProps {
  users: User[];
  loading: boolean;
  onEdit: (user: User) => void;
  onChanged: () => void;
}

export function UsersTable({ users, loading, onEdit, onChanged }: UsersTableProps) {
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const handleToggle = async (user: User) => {
    setTogglingId(user.id);
    try {
      await userService.setActive(user.id, !user.isActive);
      toast.success(user.isActive ? "Usuario desactivado" : "Usuario activado");
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo actualizar");
    } finally {
      setTogglingId(null);
    }
  };

  if (loading) {
    return (
      <Card className="overflow-hidden">
        <TableSkeleton rows={5} cols={5} />
      </Card>
    );
  }

  if (users.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<UsersIcon className="h-7 w-7" />}
          title="Sin usuarios"
          description="Crea el primer usuario con el botón “Nuevo usuario”."
        />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ios-separator text-[11px] font-semibold uppercase tracking-wider text-ios-secondary">
            <tr>
              <th className="px-5 py-3 font-medium">Usuario</th>
              <th className="px-5 py-3 font-medium">Rol</th>
              <th className="px-5 py-3 font-medium">Estado</th>
              <th className="px-5 py-3 font-medium">Alta</th>
              <th className="px-5 py-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ios-separator">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-ios-fill">
                <td className="px-5 py-3.5">
                  <div className="font-medium text-ios-label">{user.fullName}</div>
                  <div className="text-xs text-ios-secondary">C.I. {user.cedula}</div>
                </td>
                <td className="px-5 py-3.5 text-ios-label">{ROLE_LABELS[user.role]}</td>
                <td className="px-5 py-3.5">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                      user.isActive
                        ? "bg-ios-green/10 text-ios-green"
                        : "bg-ios-fill text-ios-secondary"
                    )}
                  >
                    {user.isActive ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-ios-secondary">
                  {user.createdAt ? formatDate(user.createdAt) : "—"}
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => onEdit(user)}>
                      <Pencil className="h-4 w-4" /> Editar
                    </Button>
                    <Button
                      size="sm"
                      variant={user.isActive ? "danger" : "success"}
                      onClick={() => handleToggle(user)}
                      disabled={togglingId === user.id}
                    >
                      {user.isActive ? (
                        <PowerOff className="h-4 w-4" />
                      ) : (
                        <Power className="h-4 w-4" />
                      )}
                      {user.isActive ? "Desactivar" : "Activar"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
