import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      const { error: sbError } = await supabase.auth.updateUser({ password });
      if (sbError) throw sbError;
      // Cerrar sesión para forzar nuevo login con la nueva contraseña
      await supabase.auth.signOut();
      navigate("/login", { replace: true });
    } catch {
      setError("No se pudo actualizar la contraseña. El enlace puede haber expirado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-md w-full max-w-sm p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-usc-navy rounded-full mb-3" />
          <h1 className="text-xl font-bold text-usc-navy text-center">
            Nueva contraseña
          </h1>
          <p className="text-sm text-gray-500 mt-1 text-center">
            Elige una contraseña segura para tu cuenta
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Nueva contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-usc-blue focus:border-transparent"
              placeholder="Mínimo 8 caracteres"
            />
          </div>

          <div>
            <label
              htmlFor="confirm"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Confirmar contraseña
            </label>
            <input
              id="confirm"
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-usc-blue focus:border-transparent"
              placeholder="Repite la contraseña"
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
            {loading ? "Guardando..." : "Establecer contraseña"}
          </button>
        </form>
      </div>
    </div>
  );
}
