import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import type { UserRole } from "../types/auth";

const ROLE_HOME: Record<UserRole, string> = {
  administrador: "/admin/dashboard",
  docente: "/docente/proyectos",
  estudiante: "/estudiante/dashboard",
};

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirigir si ya hay sesión activa
  useEffect(() => {
    if (user) {
      navigate(ROLE_HOME[user.role] ?? "/login", { replace: true });
    }
  }, [user, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      // La redirección la maneja el useEffect anterior cuando user se actualiza
    } catch {
      setError("Credenciales inválidas. Verifica tu email y contraseña.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-md w-full max-w-sm p-8">
        {/* Logo USC */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-usc-navy rounded-full mb-3" />
          <h1 className="text-xl font-bold text-usc-navy leading-tight text-center">
            Universidad Santiago de Cali
          </h1>
          <p className="text-sm text-gray-500 mt-1">Sistema de Trabajos de Grado</p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Correo institucional
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-usc-blue focus:border-transparent"
              placeholder="usuario@usc.edu.co"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-usc-blue focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-usc-blue text-white rounded-lg py-2 text-sm font-semibold hover:bg-usc-navy transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        {/* Recuperar contraseña */}
        <div className="mt-5 text-center">
          <a
            href="/auth/forgot-password"
            className="text-sm text-usc-blue hover:underline"
          >
            ¿Olvidaste tu contraseña?
          </a>
        </div>
      </div>
    </div>
  );
}
