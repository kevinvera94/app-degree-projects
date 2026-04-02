import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../services/api";

// ── Tipos ──────────────────────────────────────────────────────────────────

interface ProjectDetail {
  id: string;
  title: string;
  status: string;
}

interface ActDetail {
  id: string;
  library_authorization: boolean | null;
  act_file_url: string | null;
  issued_at: string | null;
}

function apiError(err: unknown): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data
    ?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d: { msg?: string }) => d.msg).join("; ");
  return "Ocurrió un error inesperado.";
}

// ── Página principal ───────────────────────────────────────────────────────

export default function EstudianteBiblioteca() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [act, setAct] = useState<ActDetail | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Estado del formulario de autorización
  const [selected, setSelected] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // ── Cargar datos ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!projectId) return;

    async function load() {
      try {
        const projRes = await api.get<ProjectDetail>(`/projects/${projectId}`);
        setProject(projRes.data);

        // El acta puede no existir aún (404) — no es error fatal
        try {
          const actRes = await api.get<ActDetail>(`/projects/${projectId}/act`);
          setAct(actRes.data);
          // Pre-seleccionar si ya fue diligenciada
          if (actRes.data.library_authorization !== null) {
            setSelected(actRes.data.library_authorization);
            setSubmitted(true);
          }
        } catch {
          // Sin acta registrada aún
        }
      } catch {
        setLoadError("No se pudieron cargar los datos. Recarga la página.");
      } finally {
        setLoadingData(false);
      }
    }

    load();
  }, [projectId]);

  // ── Enviar autorización ─────────────────────────────────────────────────
  async function handleSubmit() {
    if (selected === null || !projectId) return;
    setSubmitError("");
    setSubmitting(true);
    try {
      const res = await api.patch<ActDetail>(`/projects/${projectId}/library-authorization`, {
        library_authorization: selected,
      });
      setAct(res.data);
      setSubmitted(true);
    } catch (err) {
      setSubmitError(apiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  // ── Descargar acta ──────────────────────────────────────────────────────
  async function handleDownload() {
    if (!projectId) return;
    try {
      const res = await api.get<ActDetail>(`/projects/${projectId}/act`);
      if (res.data.act_file_url) {
        window.open(res.data.act_file_url, "_blank", "noopener,noreferrer");
      }
    } catch {
      // Error silencioso — el botón solo se muestra si ya hay act_file_url
    }
  }

  // ── Renders ─────────────────────────────────────────────────────────────

  if (loadingData) {
    return (
      <div className="p-8 space-y-4">
        <div className="h-7 w-64 bg-gray-200 animate-pulse rounded" />
        <div className="h-48 bg-gray-100 animate-pulse rounded-xl" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-8">
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {loadError}
        </p>
      </div>
    );
  }

  const isActaGenerada = project?.status === "acta_generada";
  const isTrabajoAprobado = project?.status === "trabajo_aprobado";

  // Estado incorrecto
  if (!isTrabajoAprobado && !isActaGenerada) {
    return (
      <div className="p-8 max-w-lg">
        <h1 className="text-2xl font-bold text-usc-navy mb-4">Acta y biblioteca</h1>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
          <p className="text-sm text-gray-600">
            Esta sección está disponible cuando el trabajo ha sido aprobado. Estado actual:{" "}
            <strong>{project?.status}</strong>.
          </p>
          <button
            onClick={() => navigate("/estudiante/dashboard")}
            className="mt-4 text-sm text-usc-blue hover:underline"
          >
            ← Volver al dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl space-y-6">
      {/* Cabecera */}
      <div>
        <button
          onClick={() => navigate("/estudiante/dashboard")}
          className="text-xs text-gray-400 hover:text-gray-600 mb-3 flex items-center gap-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Dashboard
        </button>
        <h1 className="text-2xl font-bold text-usc-navy">Acta y biblioteca</h1>
        {project && (
          <p className="text-sm text-gray-500 mt-1 truncate">{project.title}</p>
        )}
      </div>

      {/* ── Sección: Autorización de biblioteca ───────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-800">
            Autorización de publicación en biblioteca
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            El Reglamento de Trabajos de Grado (Resolución 004/2025) requiere que los autores
            indiquen si autorizan la publicación de su trabajo en el repositorio institucional
            de la USC.
          </p>
        </div>

        {submitted ? (
          /* Autorización ya registrada */
          <div className="flex gap-3 rounded-xl border bg-green-50 border-green-300 text-green-800 p-4">
            <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <p className="text-sm font-semibold">
                {act?.library_authorization
                  ? "Autorización concedida"
                  : "Autorización denegada"}
              </p>
              {!isActaGenerada && (
                <p className="text-sm mt-1">
                  Tu autorización ha sido registrada. El Administrador emitirá el acta pronto.
                </p>
              )}
            </div>
          </div>
        ) : (
          /* Formulario */
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-700">
              ¿Autoriza la publicación de su trabajo en la biblioteca de la USC?
            </p>

            <div className="space-y-2">
              <label
                className={[
                  "flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors",
                  selected === true
                    ? "border-usc-blue bg-blue-50"
                    : "border-gray-200 hover:border-gray-300",
                ].join(" ")}
              >
                <input
                  type="radio"
                  name="library"
                  className="mt-0.5"
                  checked={selected === true}
                  onChange={() => setSelected(true)}
                />
                <div>
                  <p className="text-sm font-medium text-gray-800">Sí, autorizo</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    El trabajo quedará disponible en el repositorio institucional de la USC
                    para consulta pública según las condiciones de la licencia.
                  </p>
                </div>
              </label>

              <label
                className={[
                  "flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors",
                  selected === false
                    ? "border-usc-blue bg-blue-50"
                    : "border-gray-200 hover:border-gray-300",
                ].join(" ")}
              >
                <input
                  type="radio"
                  name="library"
                  className="mt-0.5"
                  checked={selected === false}
                  onChange={() => setSelected(false)}
                />
                <div>
                  <p className="text-sm font-medium text-gray-800">No autorizo</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    El trabajo solo estará disponible para consulta interna por parte del
                    CTG y la dirección académica.
                  </p>
                </div>
              </label>
            </div>

            {submitError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                {submitError}
              </p>
            )}

            <button
              onClick={handleSubmit}
              disabled={selected === null || submitting}
              className="bg-usc-blue text-white text-sm font-semibold px-6 py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? "Registrando…" : "Registrar autorización"}
            </button>
          </div>
        )}
      </div>

      {/* ── Sección: Descarga de acta ──────────────────────────────────── */}
      {isActaGenerada && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-3">
          <h2 className="text-base font-semibold text-gray-800">Acta de grado</h2>

          {act?.act_file_url ? (
            <>
              <p className="text-sm text-gray-600">
                El acta de grado ha sido emitida.
                {act.issued_at && (
                  <span className="text-gray-400 ml-1">
                    Emitida el{" "}
                    {new Date(act.issued_at).toLocaleDateString("es-CO", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                    .
                  </span>
                )}
              </p>
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 bg-usc-blue text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Descargar acta
              </button>
            </>
          ) : (
            <div className="flex gap-3 rounded-lg border bg-yellow-50 border-yellow-200 text-yellow-800 px-4 py-3">
              <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sm">
                El acta fue registrada pero no tiene archivo digital adjunto. Contacta a la
                secretaría para obtener una copia.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
