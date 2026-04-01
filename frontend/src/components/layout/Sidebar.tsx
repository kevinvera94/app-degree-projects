import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import type { UserRole } from "../../types/auth";

interface NavItem {
  label: string;
  path: string;
}

const NAV_ITEMS: Record<UserRole, NavItem[]> = {
  administrador: [
    { label: "Dashboard", path: "/admin/dashboard" },
    { label: "Proyectos", path: "/admin/proyectos" },
    { label: "Usuarios", path: "/admin/usuarios" },
    { label: "Configuración", path: "/admin/configuracion" },
    { label: "Reportes", path: "/admin/reportes" },
    { label: "Mensajes", path: "/admin/mensajes" },
  ],
  docente: [
    { label: "Mis proyectos", path: "/docente/proyectos" },
    { label: "Mensajes", path: "/docente/mensajes" },
  ],
  estudiante: [
    { label: "Mi proyecto", path: "/estudiante/proyecto" },
    { label: "Mensajes", path: "/estudiante/mensajes" },
  ],
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const navItems = NAV_ITEMS[user.role];

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <aside className="w-60 min-h-screen bg-usc-navy flex flex-col">
      {/* Logo / cabecera */}
      <div className="px-6 py-5 border-b border-white/10">
        <span className="block text-white font-bold text-base leading-tight">
          USC
        </span>
        <span className="block text-white/60 text-xs mt-0.5">
          Trabajos de Grado
        </span>
      </div>

      {/* Navegación */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              [
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-usc-blue text-white font-medium"
                  : "text-white/70 hover:bg-white/10 hover:text-white",
              ].join(" ")
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Usuario + logout */}
      <div className="px-4 py-4 border-t border-white/10">
        <p className="text-white/80 text-xs truncate mb-0.5">{user.full_name}</p>
        <p className="text-white/50 text-xs truncate capitalize mb-3">
          {user.role}
        </p>
        <button
          onClick={handleLogout}
          className="w-full text-xs text-white/60 hover:text-white hover:bg-white/10 py-1.5 px-3 rounded-md transition-colors text-left"
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
