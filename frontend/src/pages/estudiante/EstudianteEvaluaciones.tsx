import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../../services/api";

// ── Tipos ──────────────────────────────────────────────────────────────────

interface ProjectDetail {
  id: string;
  title: string;
  status: string;
  period: string;
}

interface Evaluation {
  id: string;
  juror_number: number;
  stage: string;
  revision_number: number;
  score: number | null;
  observations: string | null;
  submitted_at: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Días hábiles restantes desde requestedAt hasta el límite de deadlineDays.
 * Excluye fines de semana (festivos USC no disponibles en cliente).
 */
function businessDaysRemaining(requestedAtStr: string, deadlineDays = 10): number {
  const start = new Date(requestedAtStr);
  start.setHours(0, 0, 0, 0);

  const deadline = new Date(start);
  let added = 0;
  while (added < deadlineDays) {
    deadline.setDate(deadline.getDate() + 1);
    const d = deadline.getDay();
    if (d !== 0 && d !== 6) added++;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (deadline < today) return 0;

  let remaining = 0;
  const cursor = new Date(today);
  while (cursor <= deadline) {
    const d = cursor.getDay();
    if (d !== 0 && d !== 6) remaining++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return remaining;
}

function scoreColor(score: number): string {
  if (score >= 4.0) return "text-success";
  if (score >= 3.0) return "text-warning";
  return "text-error";
}

function scoreVerdict(score: number): string {
  if (score >= 4.0) return "Aprobado";
  if (score >= 3.0) return "Correcciones";
  return "Reprobado";
}

function scoreBadgeClass(score: number): string {
  if (score >= 4.0) return "bg-green-100 text-green-700";
  if (score >= 3.0) return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
}

// ── Subcomponente: tarjeta de evaluación individual ──────────────────────

function EvalCard({ evaluation }: { evaluation: Evaluation }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-gray-800 text-sm">
          Jurado {evaluation.juror_number}
          {evaluation.juror_number === 3 && (
            <span className="ml-2 text-xs text-gray-400 font-normal">(Jurado dirimente)</span>
          )}
        </span>
        {evaluation.score !== null ? (
          <div className="flex items-center gap-2">
            <span className={`text-lg font-bold ${scoreColor(evaluation.score)}`}>
              {evaluation.score.toFixed(1)}
            </span>
            <span className="text-gray-400 text-sm">/ 5.0</span>
            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${scoreBadgeClass(evaluation.score)}`}>
              {scoreVerdict(evaluation.score)}
            </span>
          </div>
        ) : (
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
            Pendiente
          </span>
        )}
      </div>

      {evaluation.observations && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Observaciones
          </p>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
            {evaluation.observations}
          </p>
        </div>
      )}

      {!evaluation.observations && evaluation.score !== null && (
        <p className="text-xs text-gray-400 italic">Sin observaciones adicionales.</p>
      )}

      {evaluation.submitted_at && (
        <p className="text-xs text-gray-400">
          Registrado:{" "}
          {new Date(evaluation.submitted_at).toLocaleDateString("es-CO", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      )}
    </div>
  );
}

// ── Banner de resultado ────────────────────────────────────────────────────

function OutcomeBanner({
  status,
  correctionDaysLeft,
  projectId,
}: {
  status: string;
  correctionDaysLeft: number | null;
  projectId: string;
}) {
  if (status === "correcciones_anteproyecto_solicitadas") {
    const isUrgent = correctionDaysLeft !== null && correctionDaysLeft <= 2;
    return (
      <div
        className={`flex gap-3 rounded-xl border p-5 ${
          isUrgent
            ? "bg-red-50 border-red-300 text-red-800"
            : "bg-yellow-50 border-yellow-300 text-yellow-800"
        }`}
      >
        <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <div>
          <p className="font-semibold text-sm">Correcciones solicitadas</p>
          {correctionDaysLeft !== null && (
            <p className="text-sm mt-1">
              {correctionDaysLeft === 0
                ? "El plazo de correcciones ha vencido."
                : `Tienes ${correctionDaysLeft} día${correctionDaysLeft === 1 ? "" : "s"} hábil${correctionDaysLeft === 1 ? "" : "es"} para entregar las correcciones.`}
            </p>
          )}
          <p className="text-sm mt-2">
            Revisa las observaciones de los jurados y sube el documento corregido junto con
            el Vo.Bo. del director.
          </p>
          <Link
            to={`/estudiante/proyectos/${projectId}/entregar-correcciones`}
            className="inline-block mt-3 text-sm font-semibold underline"
          >
            Subir correcciones →
          </Link>
        </div>
      </div>
    );
  }

  if (status === "anteproyecto_reprobado" || status === "idea_aprobada") {
    // idea_aprobada puede significar que fue reprobado y volvió al estado anterior
    return (
      <div className="flex gap-3 rounded-xl border bg-red-50 border-red-300 text-red-800 p-5">
        <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div>
          <p className="font-semibold text-sm">Anteproyecto reprobado</p>
          <p className="text-sm mt-1">
            El anteproyecto fue reprobado de forma unánime por los jurados. El trabajo retorna
            al estado <strong>"Idea aprobada"</strong>: debes elaborar un nuevo anteproyecto
            desde cero y radicarlo en la próxima ventana de fechas habilitada por el CTG.
          </p>
        </div>
      </div>
    );
  }

  if (status === "anteproyecto_corregido_entregado") {
    return (
      <div className="flex gap-3 rounded-xl border bg-blue-50 border-blue-300 text-blue-800 p-5">
        <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div>
          <p className="font-semibold text-sm">Correcciones entregadas — pendiente de segunda revisión</p>
          <p className="text-sm mt-1">
            Los jurados tienen <strong>10 días hábiles</strong> para revisar las correcciones.
            En esta revisión solo pueden aprobar o reprobar.
          </p>
        </div>
      </div>
    );
  }

  // Aprobado: en_desarrollo o cualquier estado posterior al anteproyecto
  const postAnteproyectoStatuses = new Set([
    "en_desarrollo",
    "producto_final_entregado",
    "en_revision_jurados_producto_final",
    "correcciones_producto_final_solicitadas",
    "producto_final_corregido_entregado",
    "aprobado_para_sustentacion",
    "sustentacion_programada",
    "trabajo_aprobado",
    "acta_generada",
  ]);

  if (postAnteproyectoStatuses.has(status)) {
    return (
      <div className="flex gap-3 rounded-xl border bg-green-50 border-green-300 text-green-800 p-5">
        <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div>
          <p className="font-semibold text-sm">¡Anteproyecto aprobado!</p>
          <p className="text-sm mt-1">
            Tu anteproyecto fue aprobado por los jurados. El trabajo se encuentra ahora en
            la etapa de <strong>En desarrollo</strong>. Continúa con el director asignado.
          </p>
          <Link
            to="/estudiante/dashboard"
            className="inline-block mt-3 text-sm font-semibold underline"
          >
            Ver estado del trabajo →
          </Link>
        </div>
      </div>
    );
  }

  return null;
}

// ── Página principal ───────────────────────────────────────────────────────

export default function EstudianteEvaluaciones() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [correctionDaysLeft, setCorrectionDaysLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    async function load() {
      try {
        const [projRes, evalRes] = await Promise.all([
          api.get<ProjectDetail>(`/projects/${projectId}`),
          api.get<Evaluation[]>(`/projects/${projectId}/evaluations`, {
            params: { stage: "anteproyecto" },
          }),
        ]);

        if (cancelled) return;
        setProject(projRes.data);
        setEvaluations(evalRes.data);

        // Calcular días restantes si hay correcciones pendientes
        if (projRes.data.status === "correcciones_anteproyecto_solicitadas") {
          try {
            const histRes = await api.get<
              { type: string; new_status?: string; changed_at?: string }[]
            >(`/projects/${projectId}/history`);
            if (cancelled) return;
            const event = [...histRes.data]
              .reverse()
              .find(
                (e) =>
                  e.type === "status_change" &&
                  e.new_status === "correcciones_anteproyecto_solicitadas",
              );
            if (event?.changed_at) {
              setCorrectionDaysLeft(businessDaysRemaining(event.changed_at));
            }
          } catch {
            // No bloquear la vista si falla el historial
          }
        }
      } catch {
        if (!cancelled) setError("No se pudieron cargar las evaluaciones. Recarga la página.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [projectId]);

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        <div className="h-7 w-56 bg-gray-200 animate-pulse rounded" />
        <div className="h-32 bg-gray-100 animate-pulse rounded-xl" />
        <div className="h-32 bg-gray-100 animate-pulse rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </p>
      </div>
    );
  }

  // Agrupar evaluaciones por revision_number
  const byRevision = evaluations.reduce<Record<number, Evaluation[]>>((acc, ev) => {
    (acc[ev.revision_number] ??= []).push(ev);
    return acc;
  }, {});
  const revisions = Object.keys(byRevision)
    .map(Number)
    .sort((a, b) => a - b);

  const revisionLabel: Record<number, string> = {
    1: "Primera revisión",
    2: "Segunda revisión",
  };

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
        <h1 className="text-2xl font-bold text-usc-navy">Evaluaciones del anteproyecto</h1>
        {project && (
          <p className="text-sm text-gray-500 mt-1 truncate">{project.title}</p>
        )}
      </div>

      {/* Banner de resultado */}
      {project && (
        <OutcomeBanner
          status={project.status}
          correctionDaysLeft={correctionDaysLeft}
          projectId={projectId ?? ""}
        />
      )}

      {/* Sin evaluaciones aún */}
      {evaluations.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500">
            Aún no hay calificaciones registradas para el anteproyecto. Los jurados tienen{" "}
            <strong>15 días hábiles</strong> desde su asignación para emitir su calificación.
          </p>
        </div>
      )}

      {/* Evaluaciones agrupadas por revisión */}
      {revisions.map((rev) => (
        <section key={rev}>
          <h2 className="text-sm font-semibold text-gray-600 mb-3">
            {revisionLabel[rev] ?? `Revisión ${rev}`}
          </h2>
          <div className="space-y-3">
            {byRevision[rev]
              .sort((a, b) => a.juror_number - b.juror_number)
              .map((ev) => (
                <EvalCard key={ev.id} evaluation={ev} />
              ))}
          </div>
        </section>
      ))}

      {/* Nota de anonimato */}
      {evaluations.length > 0 && (
        <p className="text-xs text-gray-400 text-center">
          Las identidades de los jurados son anónimas en cumplimiento del reglamento de trabajos
          de grado (Resolución 004/2025).
        </p>
      )}
    </div>
  );
}
