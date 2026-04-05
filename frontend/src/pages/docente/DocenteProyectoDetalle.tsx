import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import api from "../../services/api";

// ── Tipos ──────────────────────────────────────────────────────────────────

interface MemberInfo {
  student_id: string;
  full_name: string;
  email: string;
  is_active: boolean;
}

interface DirectorInfo {
  docente_id: string;
  full_name: string;
  order: number;
  is_active: boolean;
}

interface JurorInfo {
  id: string;
  docente_id: string | null;
  full_name: string | null;
  juror_number: number;
  stage: string;
  is_active: boolean;
}

interface SubmissionBasic {
  id: string;
  stage: string;
  status: string;
  submitted_at: string;
  revision_number: number;
  is_extemporaneous: boolean;
}

interface ProjectDetail {
  id: string;
  title: string;
  modality_id: string;
  status: string;
  period: string;
  members: MemberInfo[];
  directors: DirectorInfo[];
  jurors: JurorInfo[];
  submissions: SubmissionBasic[];
}

interface Modality {
  id: string;
  name: string;
}

interface AttachmentInfo {
  id: string;
  attachment_type: string;
  file_name: string;
  uploaded_at: string;
}

interface SubmissionDetail {
  id: string;
  stage: string;
  status: string;
  submitted_at: string;
  revision_number: number;
  is_extemporaneous: boolean;
  attachments: AttachmentInfo[];
}

// Evaluación — el backend retorna EvaluationStudentResponse para jurado,
// EvaluationDirectorResponse para director (con juror_name)
interface EvaluationRow {
  id?: string;
  juror_number: number;
  stage: string;
  revision_number: number;
  score: number | null;
  observations: string | null;
  submitted_at: string | null;
  juror_name?: string; // solo para director
  juror_id?: string;
  due_date?: string;
  is_extemporaneous?: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  pendiente_evaluacion_idea: "Pendiente evaluación de idea",
  idea_aprobada: "Idea aprobada",
  idea_rechazada: "Idea rechazada",
  anteproyecto_pendiente_evaluacion: "Anteproyecto — pendiente evaluación",
  anteproyecto_aprobado: "Anteproyecto aprobado",
  anteproyecto_reprobado: "Anteproyecto reprobado",
  correcciones_anteproyecto_solicitadas: "Correcciones de anteproyecto",
  anteproyecto_corregido_entregado: "Correcciones entregadas (anteproyecto)",
  en_desarrollo: "En desarrollo",
  producto_final_entregado: "Producto final entregado",
  en_revision_jurados_producto_final: "En revisión de jurados (PF)",
  correcciones_producto_final_solicitadas: "Correcciones de producto final",
  producto_final_corregido_entregado: "Correcciones entregadas (PF)",
  aprobado_para_sustentacion: "Aprobado para sustentación",
  sustentacion_programada: "Sustentación programada",
  trabajo_aprobado: "Trabajo aprobado",
  reprobado_en_sustentacion: "Reprobado en sustentación",
  acta_generada: "Acta generada",
  suspendido_por_plagio: "Suspendido por plagio",
  cancelado: "Cancelado",
};

const STATUS_CLASSES: Record<string, string> = {
  pendiente_evaluacion_idea: "bg-blue-100 text-blue-700",
  idea_aprobada: "bg-blue-100 text-blue-700",
  anteproyecto_pendiente_evaluacion: "bg-yellow-100 text-yellow-700",
  anteproyecto_aprobado: "bg-green-100 text-green-700",
  anteproyecto_reprobado: "bg-red-100 text-red-700",
  correcciones_anteproyecto_solicitadas: "bg-yellow-100 text-yellow-700",
  anteproyecto_corregido_entregado: "bg-blue-100 text-blue-700",
  en_desarrollo: "bg-gray-100 text-gray-600",
  producto_final_entregado: "bg-blue-100 text-blue-700",
  en_revision_jurados_producto_final: "bg-yellow-100 text-yellow-700",
  correcciones_producto_final_solicitadas: "bg-yellow-100 text-yellow-700",
  aprobado_para_sustentacion: "bg-green-100 text-green-700",
  trabajo_aprobado: "bg-green-100 text-green-700",
  acta_generada: "bg-green-100 text-green-700",
  suspendido_por_plagio: "bg-red-100 text-red-700",
  cancelado: "bg-gray-100 text-gray-400",
};

const STAGE_LABELS: Record<string, string> = {
  anteproyecto: "Anteproyecto",
  correcciones_anteproyecto: "Correcciones anteproyecto",
  producto_final: "Producto final",
  correcciones_producto_final: "Correcciones producto final",
  sustentacion: "Sustentación",
};

const ATTACHMENT_LABELS: Record<string, string> = {
  plantilla: "Documento principal",
  carta_aval: "Carta de aval",
  reporte_similitud: "Reporte de similitud",
  aval_etica: "Aval comité de ética",
  certificacion_plan_negocio: "Certificación Plan de Negocio",
  carta_impacto: "Carta de impacto empresarial",
  autorizacion_biblioteca: "Autorización de biblioteca",
  otro: "Documento adicional",
};

// Mapeo de project.status → stage de evaluación activo para el jurado
const EVAL_STAGE_BY_STATUS: Record<string, string> = {
  anteproyecto_pendiente_evaluacion: "anteproyecto",
  anteproyecto_corregido_entregado: "correcciones_anteproyecto",
  en_revision_jurados_producto_final: "producto_final",
  producto_final_corregido_entregado: "correcciones_producto_final",
  sustentacion_programada: "sustentacion",
};

/**
 * Días hábiles restantes desde hoy hasta due_date.
 * Aproximación sin festivos USC.
 */
function businessDaysUntil(dueDateStr: string): number {
  const deadline = new Date(dueDateStr);
  deadline.setHours(23, 59, 59, 0);
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

function apiError(err: unknown): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data
    ?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d: { msg?: string }) => d.msg).join("; ");
  return "Ocurrió un error inesperado.";
}

// ── Subcomponente: descarga de adjunto ─────────────────────────────────────

function AttachmentDownloadButton({
  projectId,
  submissionId,
  attachment,
}: {
  projectId: string;
  submissionId: string;
  attachment: AttachmentInfo;
}) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await api.get<{ signed_url: string }>(
        `/projects/${projectId}/submissions/${submissionId}/attachments/${attachment.id}`,
      );
      window.open(res.data.signed_url, "_blank", "noopener,noreferrer");
    } catch {
      alert("No se pudo generar el enlace de descarga. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-1.5 text-xs text-usc-blue hover:underline disabled:opacity-50"
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
        />
      </svg>
      {loading ? "Generando enlace…" : (ATTACHMENT_LABELS[attachment.attachment_type] ?? attachment.attachment_type)}
    </button>
  );
}

// ── Subcomponente: formulario de calificación ──────────────────────────────

function EvaluationForm({
  projectId,
  evalStage,
  myJurorNumber,
  revision,
  dueDate,
  onSuccess,
}: {
  projectId: string;
  evalStage: string;
  myJurorNumber: number;
  revision: number;
  dueDate: string | null;
  onSuccess: () => void;
}) {
  const [scoreStr, setScoreStr] = useState("");
  const [observations, setObservations] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);

  const score = parseFloat(scoreStr);
  const isValidScore = !isNaN(score) && score >= 0 && score <= 5;

  // Restricción de segunda revisión y Jurado 3: solo < 3.0 o >= 4.0
  const isSecondRevisionOrJ3 = revision >= 2 || myJurorNumber === 3;
  const isInvalidRange =
    isSecondRevisionOrJ3 && isValidScore && score >= 3.0 && score < 4.0;

  const isPastDue = dueDate ? new Date() > new Date(dueDate) : false;
  const daysLeft = dueDate && !isPastDue ? businessDaysUntil(dueDate) : 0;

  const canSubmit =
    isValidScore &&
    !isInvalidRange &&
    observations.trim().length > 0;

  function handleOpenConfirm() {
    setError("");
    setShowConfirm(true);
    dialogRef.current?.showModal();
  }

  function handleCloseConfirm() {
    setShowConfirm(false);
    dialogRef.current?.close();
  }

  async function handleConfirm() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      await api.post(`/projects/${projectId}/evaluations`, {
        stage: evalStage,
        score,
        observations: observations.trim(),
      });
      handleCloseConfirm();
      onSuccess();
    } catch (err) {
      setError(apiError(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Plazo */}
      {dueDate && (
        <div className={[
          "flex gap-3 rounded-lg border px-4 py-3 text-sm font-medium",
          isPastDue
            ? "bg-orange-50 border-orange-300 text-orange-800"
            : daysLeft <= 2
              ? "bg-red-50 border-red-300 text-red-700"
              : "bg-yellow-50 border-yellow-300 text-yellow-800",
        ].join(" ")}>
          <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {isPastDue
            ? "El plazo ha vencido. Su calificación quedará marcada como extemporánea."
            : `${daysLeft} día${daysLeft === 1 ? "" : "s"} hábil${daysLeft === 1 ? "" : "es"} restante${daysLeft === 1 ? "" : "s"} para calificar.`
          }
        </div>
      )}

      {/* Campo: calificación */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Calificación <span className="text-gray-400 font-normal">(0.0 – 5.0)</span>
        </label>
        <input
          type="number"
          min={0}
          max={5}
          step={0.1}
          value={scoreStr}
          onChange={(e) => setScoreStr(e.target.value)}
          placeholder="Ej: 3.8"
          className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-usc-blue focus:border-transparent"
        />
        {isInvalidRange && (
          <p className="text-xs text-red-600 mt-1">
            En esta etapa solo puede Aprobar (≥ 4.0) o Reprobar (&lt; 3.0). No se permite rango intermedio.
          </p>
        )}
      </div>

      {/* Campo: observaciones */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Observaciones{" "}
          {!isValidScore || score < 4.0
            ? <span className="text-red-500">*</span>
            : <span className="text-gray-400 font-normal">(recomendadas si calificación &lt; 4.0)</span>
          }
        </label>
        <textarea
          value={observations}
          onChange={(e) => setObservations(e.target.value)}
          rows={4}
          placeholder="Describa sus observaciones, fortalezas y recomendaciones al trabajo…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-usc-blue focus:border-transparent resize-none"
        />
        {observations.trim().length === 0 && (
          <p className="text-xs text-gray-400 mt-0.5">Las observaciones son obligatorias.</p>
        )}
      </div>

      <button
        onClick={handleOpenConfirm}
        disabled={!canSubmit}
        className="bg-usc-blue text-white text-sm font-semibold px-6 py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Registrar calificación
      </button>

      {/* Modal de confirmación */}
      <dialog
        ref={dialogRef}
        className="rounded-xl shadow-xl border border-gray-200 p-6 max-w-sm w-full backdrop:bg-black/40"
        onClose={() => setShowConfirm(false)}
      >
        {showConfirm && (
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-gray-900">Confirmar calificación</h3>
            <p className="text-sm text-gray-600">
              Va a registrar una calificación de{" "}
              <strong className="text-gray-900">{score.toFixed(1)} / 5.0</strong>.
              Esta acción no puede deshacerse.
            </p>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <div className="flex gap-3 pt-1">
              <button
                onClick={handleConfirm}
                disabled={submitting}
                className="flex-1 bg-usc-blue text-white text-sm font-semibold py-2 rounded-lg hover:opacity-90 disabled:opacity-40"
              >
                {submitting ? "Registrando…" : "Confirmar"}
              </button>
              <button
                onClick={handleCloseConfirm}
                disabled={submitting}
                className="flex-1 text-sm text-gray-600 border border-gray-200 py-2 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────

export default function DocenteProyectoDetalle() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [modality, setModality] = useState<Modality | null>(null);
  const [evaluations, setEvaluations] = useState<EvaluationRow[]>([]);
  // Detalles de submissions (con adjuntos) solo para Director
  const [submissionDetails, setSubmissionDetails] = useState<SubmissionDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [evalSuccess, setEvalSuccess] = useState(false);

  // ── Determinar roles ────────────────────────────────────────────────────
  const userId = user?.id ?? "";

  const isDirector = (project?.directors ?? []).some(
    (d) => d.docente_id === userId && d.is_active,
  );
  const myJurorEntry = (project?.jurors ?? []).find(
    (j) => j.docente_id === userId && j.is_active,
  );
  const isJuror = !!myJurorEntry;

  // Etapa de evaluación activa basada en el estado del proyecto
  const activeEvalStage = project ? (EVAL_STAGE_BY_STATUS[project.status] ?? null) : null;

  // Mi evaluación pendiente: mismo juror_number + mismo stage activo + score null
  const myPendingEval = activeEvalStage && myJurorEntry
    ? evaluations.find(
        (e) =>
          e.juror_number === myJurorEntry.juror_number &&
          e.stage === activeEvalStage &&
          e.score === null,
      ) ?? null
    : null;

  // ¿Ya registré mi calificación?
  const mySubmittedEval = activeEvalStage && myJurorEntry
    ? evaluations.find(
        (e) =>
          e.juror_number === myJurorEntry.juror_number &&
          e.stage === activeEvalStage &&
          e.score !== null,
      ) ?? null
    : null;

  // Evaluaciones visibles para el jurado:
  // Si aún no calificó → solo ve la suya (pending); oculta la del otro jurado
  const visibleEvaluations =
    isJuror && !isDirector && myPendingEval
      ? evaluations.filter(
          (e) => e.juror_number === myJurorEntry!.juror_number,
        )
      : evaluations;

  // ── Carga de datos ──────────────────────────────────────────────────────
  async function loadData(cancelled: { v: boolean }) {
    if (!projectId) return;
    try {
      const [projRes, modRes, evalRes] = await Promise.all([
        api.get<ProjectDetail>(`/projects/${projectId}`),
        api.get<Modality[]>("/modalities"),
        api.get<EvaluationRow[]>(`/projects/${projectId}/evaluations`),
      ]);

      if (cancelled.v) return;

      const proj = projRes.data;
      setProject(proj);
      setEvaluations(evalRes.data);

      const mod = modRes.data.find((m) => m.id === proj.modality_id) ?? null;
      setModality(mod);

      // Para Director: cargar detalle de cada submission en paralelo
      const isDir = proj.directors.some(
        (d) => d.docente_id === userId && d.is_active,
      );
      if (isDir && proj.submissions.length > 0) {
        const details = await Promise.all(
          proj.submissions
            .filter((s) => s.status === "en_revision")
            .map((s) =>
              api
                .get<SubmissionDetail>(`/projects/${proj.id}/submissions/${s.id}`)
                .then((r) => r.data),
            ),
        );
        if (!cancelled.v) setSubmissionDetails(details);
      }
    } catch {
      if (!cancelled.v) setError("No se pudo cargar la ficha del proyecto.");
    } finally {
      if (!cancelled.v) setLoading(false);
    }
  }

  useEffect(() => {
    const cancelled = { v: false };
    loadData(cancelled);
    return () => { cancelled.v = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, userId]);

  function handleEvalSuccess() {
    setEvalSuccess(true);
    const cancelled = { v: false };
    setLoading(true);
    loadData(cancelled);
  }

  // ── Renders ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        <div className="h-7 w-56 bg-gray-200 animate-pulse rounded" />
        <div className="h-40 bg-gray-100 animate-pulse rounded-xl" />
        <div className="h-32 bg-gray-100 animate-pulse rounded-xl" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="p-8">
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error || "Proyecto no encontrado."}
        </p>
      </div>
    );
  }

  const statusClasses = STATUS_CLASSES[project.status] ?? "bg-gray-100 text-gray-500";
  const statusLabel = STATUS_LABELS[project.status] ?? project.status;

  const activeMembers = project.members.filter((m) => m.is_active);
  const activeDirectors = project.directors.filter((d) => d.is_active).sort((a, b) => a.order - b.order);
  const activeJurors = project.jurors.filter((j) => j.is_active);

  return (
    <div className="p-8 max-w-3xl space-y-6">
      {/* Breadcrumb */}
      <button
        onClick={() => navigate("/docente/dashboard")}
        className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Dashboard
      </button>

      {/* ── Información general ──────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900 leading-snug">{project.title}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {modality && (
                <span className="text-sm text-gray-500">{modality.name}</span>
              )}
              <span className="text-gray-300">·</span>
              <span className="text-sm text-gray-400">{project.period}</span>
              {isDirector && (
                <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                  Director
                </span>
              )}
              {isJuror && (
                <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                  Jurado {myJurorEntry?.juror_number}
                </span>
              )}
            </div>
          </div>
          <span className={`text-sm font-semibold px-3 py-1 rounded-full ${statusClasses}`}>
            {statusLabel}
          </span>
        </div>

        {/* Integrantes */}
        {activeMembers.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Integrantes
            </p>
            <div className="space-y-1">
              {activeMembers.map((m) => (
                <div key={m.student_id} className="flex items-center gap-2">
                  <span className="text-sm text-gray-700">{m.full_name}</span>
                  <span className="text-xs text-gray-400">{m.email}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Directores — visibles para todos */}
        {activeDirectors.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              {activeDirectors.length === 1 ? "Director" : "Directores"}
            </p>
            <div className="flex flex-wrap gap-2">
              {activeDirectors.map((d) => (
                <span
                  key={d.docente_id}
                  className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded-full"
                >
                  {d.full_name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Jurados — identidad visible solo para Director */}
        {isDirector && activeJurors.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Jurados
            </p>
            <div className="space-y-1">
              {activeJurors.map((j) => (
                <div key={j.id} className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500">
                    Jurado {j.juror_number}
                    {j.juror_number === 3 && (
                      <span className="text-gray-400 ml-1">(dirimente)</span>
                    )}
                    {" — "}
                    <span className="text-xs text-gray-400">{STAGE_LABELS[j.stage] ?? j.stage}</span>
                  </span>
                  <span className="text-sm text-gray-700">
                    {j.full_name ?? <span className="italic text-gray-400">Sin asignar</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Sección Director: Documentos radicados ───────────────────── */}
      {isDirector && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-800">Documentos radicados</h2>
            <Link
              to={`/docente/proyectos/${project.id}/historial`}
              className="text-xs text-usc-blue hover:underline"
            >
              Ver historial completo →
            </Link>
          </div>

          {submissionDetails.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No hay radicaciones confirmadas aún.</p>
          ) : (
            <div className="space-y-4">
              {submissionDetails.map((sub) => (
                <div key={sub.id} className="border border-gray-100 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-semibold text-gray-700">
                      {STAGE_LABELS[sub.stage] ?? sub.stage}
                    </span>
                    {sub.revision_number > 1 && (
                      <span className="text-xs text-gray-400">Revisión {sub.revision_number}</span>
                    )}
                    {sub.is_extemporaneous && (
                      <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
                        Extemporánea
                      </span>
                    )}
                    <span className="text-xs text-gray-400 ml-auto">
                      {new Date(sub.submitted_at).toLocaleDateString("es-CO", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {sub.attachments.map((att) => (
                      <div key={att.id} className="flex items-center gap-3">
                        <AttachmentDownloadButton
                          projectId={project.id}
                          submissionId={sub.id}
                          attachment={att}
                        />
                        <span className="text-xs text-gray-300">{att.file_name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Sección Director: Evaluaciones recibidas ─────────────────── */}
      {isDirector && evaluations.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Evaluaciones</h2>
          <div className="space-y-3">
            {evaluations.map((ev, i) => (
              <div
                key={i}
                className="flex items-start gap-4 py-3 border-b border-gray-100 last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-700">
                      Jurado {ev.juror_number}
                      {ev.juror_number === 3 && (
                        <span className="text-gray-400 text-xs ml-1">(dirimente)</span>
                      )}
                    </span>
                    {ev.juror_name && (
                      <span className="text-xs text-gray-400">— {ev.juror_name}</span>
                    )}
                    <span className="text-xs text-gray-400">
                      {STAGE_LABELS[ev.stage] ?? ev.stage}
                      {ev.revision_number > 1 && ` · Rev. ${ev.revision_number}`}
                    </span>
                  </div>
                  {ev.score !== null ? (
                    <div className="mt-1">
                      <span
                        className={`text-base font-bold ${
                          ev.score >= 4.0
                            ? "text-green-600"
                            : ev.score >= 3.0
                              ? "text-yellow-600"
                              : "text-red-600"
                        }`}
                      >
                        {ev.score.toFixed(1)}
                      </span>
                      <span className="text-xs text-gray-400"> / 5.0</span>
                      {ev.observations && (
                        <p className="text-xs text-gray-500 mt-1 italic">"{ev.observations}"</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic mt-1">Pendiente de calificar</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Sección Jurado: Documento a evaluar ──────────────────────── */}
      {isJuror && !isDirector && activeEvalStage && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">
            Documento a evaluar — {STAGE_LABELS[activeEvalStage] ?? activeEvalStage}
          </h2>

          {/* Buscar submission para el stage activo.
              - anteproyecto / producto_final: submission en_revision de esa etapa.
              - sustentacion: no tiene submission propia; mostrar el producto_final aprobado. */}
          {(() => {
            let relevantSub: SubmissionBasic | undefined;

            if (activeEvalStage === "sustentacion") {
              // La sustentación evalúa el producto final entregado (aprobado)
              relevantSub = project.submissions
                .filter((s) => s.stage === "producto_final" && s.status === "aprobado")
                .sort((a, b) => b.revision_number - a.revision_number)[0];
            } else {
              relevantSub = project.submissions
                .filter(
                  (s) => s.stage === activeEvalStage && s.status === "en_revision",
                )
                .sort((a, b) => b.revision_number - a.revision_number)[0];
            }

            if (!relevantSub) {
              return (
                <p className="text-sm text-gray-400 italic">
                  No hay documento disponible para esta etapa.
                </p>
              );
            }

            return (
              <SubmissionDocumentLoader
                projectId={project.id}
                submissionId={relevantSub.id}
              />
            );
          })()}
        </div>
      )}

      {/* ── Sección Jurado: Evaluaciones propias + formulario ────────── */}
      {isJuror && !isDirector && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
          <h2 className="text-base font-semibold text-gray-800">Mi calificación</h2>

          {/* Éxito */}
          {evalSuccess && (
            <div className="flex gap-3 bg-green-50 border border-green-300 text-green-800 rounded-lg px-4 py-3 text-sm font-medium">
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Calificación registrada exitosamente.
            </div>
          )}

          {/* Mis evaluaciones ya enviadas */}
          {visibleEvaluations.filter((e) => e.score !== null).map((ev, i) => (
            <div key={i} className="rounded-lg bg-gray-50 border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-gray-700">
                  {STAGE_LABELS[ev.stage] ?? ev.stage}
                  {ev.revision_number > 1 && ` — Revisión ${ev.revision_number}`}
                </span>
                {ev.is_extemporaneous && (
                  <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
                    Extemporánea
                  </span>
                )}
              </div>
              <span
                className={`text-xl font-bold ${
                  (ev.score ?? 0) >= 4.0
                    ? "text-green-600"
                    : (ev.score ?? 0) >= 3.0
                      ? "text-yellow-600"
                      : "text-red-600"
                }`}
              >
                {ev.score?.toFixed(1)}
              </span>
              <span className="text-sm text-gray-400"> / 5.0</span>
              {ev.observations && (
                <p className="text-sm text-gray-600 mt-2 italic">"{ev.observations}"</p>
              )}
            </div>
          ))}

          {/* Formulario si hay evaluación pendiente */}
          {myPendingEval && activeEvalStage && myJurorEntry && !evalSuccess && (
            <EvaluationForm
              projectId={project.id}
              evalStage={activeEvalStage}
              myJurorNumber={myJurorEntry.juror_number}
              revision={myPendingEval.revision_number}
              dueDate={myPendingEval.due_date ?? null}
              onSuccess={handleEvalSuccess}
            />
          )}

          {/* Si no hay evaluación pendiente y tampoco submitted */}
          {!myPendingEval && !mySubmittedEval && !evalSuccess && (
            <p className="text-sm text-gray-400 italic">
              No tienes evaluaciones pendientes para este trabajo en este momento.
            </p>
          )}

          {/* Evaluaciones del otro jurado — solo si ya califiqué */}
          {mySubmittedEval && (
            <>
              {visibleEvaluations.filter((e) => e.juror_number !== myJurorEntry!.juror_number).length > 0 && (
                <div className="pt-3 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Calificaciones del otro jurado
                  </p>
                  {visibleEvaluations
                    .filter((e) => e.juror_number !== myJurorEntry!.juror_number)
                    .map((ev, i) => (
                      <div key={i} className="rounded-lg bg-gray-50 border border-gray-100 p-4">
                        <span className="text-sm font-medium text-gray-500">
                          Jurado {ev.juror_number}
                          {" — "}{STAGE_LABELS[ev.stage] ?? ev.stage}
                        </span>
                        {ev.score !== null ? (
                          <div className="mt-1">
                            <span
                              className={`font-bold ${
                                ev.score >= 4.0 ? "text-green-600" : ev.score >= 3.0 ? "text-yellow-600" : "text-red-600"
                              }`}
                            >
                              {ev.score.toFixed(1)}
                            </span>
                            <span className="text-xs text-gray-400"> / 5.0</span>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400 italic mt-1">Pendiente</p>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Subcomponente: carga todos los adjuntos de una submission ─────────────

function SubmissionDocumentLoader({
  projectId,
  submissionId,
}: {
  projectId: string;
  submissionId: string;
}) {
  const [attachments, setAttachments] = useState<AttachmentInfo[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api
      .get<{ attachments: AttachmentInfo[] }>(
        `/projects/${projectId}/submissions/${submissionId}`,
      )
      .then((r) => {
        setAttachments(r.data.attachments);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [projectId, submissionId]);

  if (!loaded) return <span className="text-xs text-gray-400">Cargando adjuntos…</span>;

  if (attachments.length === 0) {
    return (
      <span className="text-sm text-gray-400 italic">
        No hay adjuntos disponibles.
      </span>
    );
  }

  return (
    <div className="space-y-2">
      {attachments.map((att) => (
        <div key={att.id} className="flex items-center gap-3">
          <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <AttachmentDownloadButton
            projectId={projectId}
            submissionId={submissionId}
            attachment={att}
          />
          <span className="text-xs text-gray-300">{att.file_name}</span>
        </div>
      ))}
    </div>
  );
}
