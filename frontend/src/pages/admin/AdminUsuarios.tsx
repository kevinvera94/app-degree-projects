import { useCallback, useEffect, useState } from "react";
import api from "../../services/api";

// ── Tipos ──────────────────────────────────────────────────────────────────

type Role = "administrador" | "docente" | "estudiante";

interface UserItem {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  is_active: boolean;
  created_at: string;
}

interface PaginatedUsers {
  items: UserItem[];
  total: number;
  page: number;
  size: number;
}

// ── Componentes auxiliares ─────────────────────────────────────────────────

function RoleBadge({ role }: { role: Role }) {
  const styles: Record<Role, string> = {
    administrador: "bg-purple-100 text-purple-700",
    docente: "bg-blue-100 text-blue-700",
    estudiante: "bg-gray-100 text-gray-600",
  };
  const labels: Record<Role, string> = {
    administrador: "Administrador",
    docente: "Docente",
    estudiante: "Estudiante",
  };
  return (
    <span
      className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${styles[role]}`}
    >
      {labels[role]}
    </span>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
        active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
      }`}
    >
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}

// ── Modal de creación / edición ────────────────────────────────────────────

interface UserFormModalProps {
  editUser: UserItem | null;
  onClose: () => void;
  onSaved: () => void;
}

function UserFormModal({ editUser, onClose, onSaved }: UserFormModalProps) {
  const [fullName, setFullName] = useState(editUser?.full_name ?? "");
  const [email, setEmail] = useState(editUser?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>(editUser?.role ?? "estudiante");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isEdit = editUser !== null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isEdit) {
        await api.patch(`/users/${editUser.id}`, { full_name: fullName, email, role });
      } else {
        await api.post("/users", { full_name: fullName, email, password, role });
      }
      onSaved();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Error al guardar el usuario.";
      setError(typeof msg === "string" ? msg : "Error al guardar el usuario.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold text-usc-navy mb-5">
          {isEdit ? "Editar usuario" : "Nuevo usuario"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre completo
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-usc-blue"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Correo institucional
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-usc-blue"
              placeholder="usuario@usc.edu.co"
            />
          </div>

          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña temporal
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-usc-blue"
                placeholder="Mínimo 8 caracteres"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rol
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-usc-blue bg-white"
            >
              <option value="administrador">Administrador</option>
              <option value="docente">Docente</option>
              <option value="estudiante">Estudiante</option>
            </select>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm bg-usc-blue text-white rounded-lg hover:bg-usc-navy transition-colors disabled:opacity-60"
            >
              {loading ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear usuario"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal de confirmación de desactivación ─────────────────────────────────

interface DeactivateModalProps {
  user: UserItem;
  onClose: () => void;
  onDeactivated: () => void;
}

function DeactivateModal({ user, onClose, onDeactivated }: DeactivateModalProps) {
  const [affectedIds, setAffectedIds] = useState<string[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setError("");
    setLoading(true);
    try {
      const res = await api.patch<{ affected_project_ids: string[] }>(
        `/users/${user.id}/deactivate`
      );
      const ids = res.data.affected_project_ids;
      if (ids.length > 0) {
        setAffectedIds(ids);
      } else {
        onDeactivated();
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "No se pudo desactivar el usuario.";
      setError(typeof msg === "string" ? msg : "No se pudo desactivar el usuario.");
    } finally {
      setLoading(false);
    }
  }

  // Si ya hay proyectos afectados, mostrar la lista y un botón de cierre
  if (affectedIds !== null) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
          <h2 className="text-lg font-bold text-usc-navy mb-2">
            Usuario desactivado
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            El usuario <strong>{user.full_name}</strong> fue desactivado.{" "}
            {affectedIds.length} proyecto(s) requieren reasignación de director
            o jurado:
          </p>
          <ul className="space-y-1 mb-5 max-h-48 overflow-y-auto">
            {affectedIds.map((id) => (
              <li key={id} className="text-xs font-mono text-gray-500 bg-gray-50 px-3 py-1.5 rounded">
                {id}
              </li>
            ))}
          </ul>
          <div className="flex justify-end">
            <button
              onClick={onDeactivated}
              className="px-4 py-2 text-sm bg-usc-blue text-white rounded-lg hover:bg-usc-navy transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-bold text-usc-navy mb-2">
          ¿Desactivar usuario?
        </h2>
        <p className="text-sm text-gray-600 mb-5">
          Se desactivará a <strong>{user.full_name}</strong>. Si tiene proyectos
          asignados como director o jurado se generarán alertas de reasignación.
        </p>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60"
          >
            {loading ? "Desactivando..." : "Desactivar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────

export default function AdminUsuarios() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const [filterRole, setFilterRole] = useState<Role | "">("");
  const [filterActive, setFilterActive] = useState<"" | "true" | "false">("");

  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState("");

  // Modales
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserItem | null>(null);
  const [deactivateUser, setDeactivateUser] = useState<UserItem | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoadingList(true);
    setListError("");
    try {
      const params: Record<string, string | number> = { page, size: PAGE_SIZE };
      if (filterRole) params.role = filterRole;
      if (filterActive !== "") params.is_active = filterActive;

      const res = await api.get<PaginatedUsers>("/users", { params });
      setUsers(res.data.items);
      setTotal(res.data.total);
    } catch {
      setListError("No se pudo cargar la lista de usuarios.");
    } finally {
      setLoadingList(false);
    }
  }, [page, filterRole, filterActive]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Resetear a página 1 al cambiar filtros
  useEffect(() => {
    setPage(1);
  }, [filterRole, filterActive]);

  async function handleActivate(user: UserItem) {
    try {
      await api.patch(`/users/${user.id}`, { is_active: true });
      fetchUsers();
    } catch {
      // error silencioso — se podría mostrar un toast en el futuro
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-8">
      {/* Encabezado */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-usc-navy">Usuarios</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total} usuario{total !== 1 ? "s" : ""} registrado{total !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="bg-usc-blue text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-usc-navy transition-colors"
        >
          + Nuevo usuario
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 mb-5">
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value as Role | "")}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-usc-blue"
        >
          <option value="">Todos los roles</option>
          <option value="administrador">Administrador</option>
          <option value="docente">Docente</option>
          <option value="estudiante">Estudiante</option>
        </select>

        <select
          value={filterActive}
          onChange={(e) => setFilterActive(e.target.value as "" | "true" | "false")}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-usc-blue"
        >
          <option value="">Todos los estados</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {listError ? (
          <p className="p-6 text-sm text-red-600">{listError}</p>
        ) : loadingList ? (
          <p className="p-6 text-sm text-gray-500">Cargando...</p>
        ) : users.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">No hay usuarios con los filtros seleccionados.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left">
                <th className="px-5 py-3 font-semibold text-gray-600">Nombre</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Email</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Rol</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Estado</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-gray-800">
                    {u.full_name}
                  </td>
                  <td className="px-5 py-3 text-gray-600">{u.email}</td>
                  <td className="px-5 py-3">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge active={u.is_active} />
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditUser(u)}
                        className="text-usc-blue hover:underline text-xs font-medium"
                      >
                        Editar
                      </button>
                      {u.is_active ? (
                        <button
                          onClick={() => setDeactivateUser(u)}
                          className="text-red-600 hover:underline text-xs font-medium"
                        >
                          Desactivar
                        </button>
                      ) : (
                        <button
                          onClick={() => handleActivate(u)}
                          className="text-green-600 hover:underline text-xs font-medium"
                        >
                          Activar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
          <span>
            Página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* Modales */}
      {(createOpen || editUser) && (
        <UserFormModal
          editUser={editUser}
          onClose={() => {
            setCreateOpen(false);
            setEditUser(null);
          }}
          onSaved={() => {
            setCreateOpen(false);
            setEditUser(null);
            fetchUsers();
          }}
        />
      )}

      {deactivateUser && (
        <DeactivateModal
          user={deactivateUser}
          onClose={() => setDeactivateUser(null)}
          onDeactivated={() => {
            setDeactivateUser(null);
            fetchUsers();
          }}
        />
      )}
    </div>
  );
}
