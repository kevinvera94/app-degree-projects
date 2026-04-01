import { useState } from "react";
import { supabase } from "../../services/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: sbError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        }
      );
      if (sbError) throw sbError;
      setSent(true);
    } catch {
      setError("No se pudo enviar el correo. Verifica que el email sea correcto.");
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
            Recuperar contraseña
          </h1>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <div className="text-green-600 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm">
              Se envió un enlace de recuperación a <strong>{email}</strong>. Revisa
              tu bandeja de entrada.
            </div>
            <a
              href="/login"
              className="block text-sm text-usc-blue hover:underline mt-4"
            >
              Volver al inicio de sesión
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-gray-500 mb-2">
              Ingresa tu correo institucional y te enviaremos un enlace para
              restablecer tu contraseña.
            </p>

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
              {loading ? "Enviando..." : "Enviar enlace"}
            </button>

            <div className="text-center mt-2">
              <a
                href="/login"
                className="text-sm text-usc-blue hover:underline"
              >
                Volver al inicio de sesión
              </a>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
