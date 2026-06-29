import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { User } from "@/types/domain";
import { useUsers } from "../hooks/useUsers";
import { UsersTable } from "../components/UsersTable";
import { UserFormModal } from "../components/UserFormModal";

/** Módulo de gestión de usuarios: crear, editar, activar/desactivar. */
export function UsersPage() {
  const { users, loading, refetch } = useUsers();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (user: User) => {
    setEditing(user);
    setModalOpen(true);
  };

  const handleSaved = () => {
    setModalOpen(false);
    setEditing(null);
    void refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Usuarios</h1>
          <p className="text-sm text-slate-500">
            Gestiona quién accede al sistema y con qué rol
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Nuevo usuario
        </Button>
      </div>

      <UsersTable
        users={users}
        loading={loading}
        onEdit={openEdit}
        onChanged={refetch}
      />

      <UserFormModal
        open={modalOpen}
        user={editing}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  );
}
