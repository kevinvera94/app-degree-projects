/**
 * api.ts — Helper de llamadas directas al backend para setup y teardown de tests.
 *
 * Los tests E2E del Admin se concentran en la UI del Admin.
 * Las acciones de otros roles (Docente registrando calificaciones, etc.)
 * se ejecutan directamente contra la API para no duplicar tests de otras fases.
 *
 * NOTA: este archivo corre en Node.js (contexto Playwright), NO en el browser.
 * Las variables VITE_* no están disponibles en process.env — usar E2E_* exclusivamente.
 * Ver e2e/.env.e2e.example para la lista completa de variables requeridas.
 */

import axios from "axios";

const apiURL = process.env.E2E_API_URL ?? "http://localhost:8000/api/v1";

/**
 * Obtiene un token JWT llamando directamente a la REST API de Supabase Auth.
 * Requiere E2E_SUPABASE_URL y E2E_SUPABASE_ANON_KEY en el entorno.
 */
export async function getToken(email: string, password: string): Promise<string> {
  const supabaseUrl = process.env.E2E_SUPABASE_URL ?? "";
  const supabaseAnonKey = process.env.E2E_SUPABASE_ANON_KEY ?? "";

  const res = await axios.post(
    `${supabaseUrl}/auth/v1/token?grant_type=password`,
    { email, password },
    {
      headers: {
        apikey: supabaseAnonKey,
        "Content-Type": "application/json",
      },
    }
  );
  return res.data.access_token as string;
}

/**
 * Crea un cliente axios autenticado para el usuario indicado.
 * Usado en los specs para registrar calificaciones y otras acciones de Docente.
 */
export async function apiAs(email: string, password: string) {
  const token = await getToken(email, password);
  return axios.create({
    baseURL: apiURL,
    headers: { Authorization: `Bearer ${token}` },
  });
}
