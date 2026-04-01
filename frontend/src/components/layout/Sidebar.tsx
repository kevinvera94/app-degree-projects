import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
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
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function fetchCount() {
      try {
        const { data } = await api.get<{ unread: number }>("/messages/unread-count");
        if (!cancelled) setUnreadCount(data.unread);
      } catch {
        // silencioso — no interrumpir navegación por fallo de badge
      }
    }

    fetchCount();
    const id = setInterval(fetchCount, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [user]);

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
        {navItems.map((item) => {
          const isMensajes = item.path.includes("mensajes");
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                [
                  "flex items-center justify-between gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  isActive
                    ? "bg-usc-blue text-white font-medium"
                    : "text-white/70 hover:bg-white/10 hover:text-white",
                ].join(" ")
              }
            >
              <span>{item.label}</span>
              {isMensajes && unreadCount > 0 && (
                <span className="bg-usc-gold text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </NavLink>
          );
        })}
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
