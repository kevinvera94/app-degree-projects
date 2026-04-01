/**
 * api.ts — Helper de llamadas directas al backend para setup y teardown de tests.
 *
 * Los tests E2E del Admin se concentran en la UI del Admin.
 * Las acciones de otros roles (Docente registrando calificaciones, etc.)
 * se ejecutan directamente contra la API para no duplicar tests de otras fases.
 */

import axios from "axios";

const apiURL =
  process.env.E2E_API_URL ?? "http://localhost:8000/api/v1";

/**
 * Obtiene un token JWT para un usuario dado, usando las credenciales de entorno.
 * Llama directamente a Supabase Auth REST API.
 */
export async function getToken(email: string, password: string): Promise<string> {
  const supabaseUrl = process.env.E2E_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
  const supabaseAnonKey =
    process.env.E2E_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? "";

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
 * Crea un cliente de API autenticado para el usuario indicado.
 */
export async function apiAs(email: string, password: string) {
  const token = await getToken(email, password);
  return axios.create({
    baseURL: apiURL,
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Registra la calificación de un jurado para un proyecto dado.
 * Simplifica el setup de los tests de transición de estado.
 */
export async function submitJurorGrade(params: {
  docenteEmail: string;
  docentePassword: string;
  projectId: string;
  evaluationId: string;
  score: number;
  observations?: string;
}) {
  const client = await apiAs(params.docenteEmail, params.docentePassword);
  await client.patch(
    `/projects/${params.projectId}/evaluations/${params.evaluationId}`,
    {
      score: params.score,
      observations: params.observations ?? "Evaluación registrada por test E2E.",
    }
  );
}

/**
 * Registra la calificación de un jurado en la sustentación.
 */
export async function submitSustentationGrade(params: {
  docenteEmail: string;
  docentePassword: string;
  projectId: string;
  jurorId: string;
  score: number;
}) {
  const client = await apiAs(params.docenteEmail, params.docentePassword);
  await client.patch(
    `/projects/${params.projectId}/sustentation/grades/${params.jurorId}`,
    { score: params.score }
  );
}
