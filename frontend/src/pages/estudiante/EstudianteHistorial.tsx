import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../services/api";

// ── Tipos (espejo del backend history.py) ─────────────────────────────────

interface StatusChangeEvent {
  type: "status_change";
  previous_status: string | null;
  new_status: string;
  changed_by_name: string;
  reason: string | null;
  changed_at: string;
}

interface DocumentUploadedEvent {
  type: "document_uploaded";
  attachment_type: string;
  file_name: string;
  stage: string;
  uploaded_by_name: string;
  uploaded_at: string;
}

interface EvaluationSubmittedEvent {
  type: "evaluation_submitted";
  juror_number: number;
  score: number;
  stage: string;
  submitted_at: string;
  is_extemporaneous: boolean;
  juror_name: string | null; // siempre null para Estudiante
}

type HistoryEvent = StatusChangeEvent | DocumentUploadedEvent | EvaluationSubmittedEvent;

interface ProjectDetail {
  id: string;
  title: string;
}

// ── Etiquetas legibles ─────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  pendiente_evaluacion_idea: "Pendiente evaluación de idea",
  idea_aprobada: "Idea aprobada",
  idea_rechazada: "Idea rechazada",
  anteproyecto_pendiente_evaluacion: "Anteproyecto — pendiente evaluación",
  anteproyecto_aprobado: "Anteproyecto aprobado",
  anteproyecto_reprobado: "Anteproyecto reprobado",
  correcciones_anteproyecto_solicitadas: "Correcciones de anteproyecto solicitadas",
  anteproyecto_corregido_entregado: "Correcciones de anteproyecto entregadas",
  en_desarrollo: "En desarrollo",
  producto_final_entregado: "Producto final entregado",
  en_revision_jurados_producto_final: "En revisión de jurados (producto final)",
  correcciones_producto_final_solicitadas: "Correcciones de producto final solicitadas",
  producto_final_corregido_entregado: "Correcciones de producto final entregadas",
  aprobado_para_sustentacion: "Aprobado para sustentación",
  sustentacion_programada: "Sustentación programada",
  trabajo_aprobado: "Trabajo aprobado",
  reprobado_en_sustentacion: "Reprobado en sustentación",
  acta_generada: "Acta generada",
  suspendido_por_plagio: "Suspendido por plagio",
  cancelado: "Cancelado",
};

const STAGE_LABELS: Record<string, string> = {
  anteproyecto: "Anteproyecto",
  correcciones_anteproyecto: "Correcciones de anteproyecto",
  producto_final: "Producto final",
  correcciones_producto_final: "Correcciones de producto final",
  sustentacion: "Sustentación",
};

const ATTACHMENT_LABELS: Record<string, string> = {
  plantilla: "Documento principal",
  carta_aval: "Carta de aval",
  reporte_similitud: "Reporte de similitud",
  aval_etica: "Aval del comité de ética",
  certificacion_plan_negocio: "Certificación Plan de Negocio",
  carta_impacto: "Carta de impacto empresarial",
  autorizacion_biblioteca: "Autorización de biblioteca",
  retiro_integrante: "Solicitud de retiro de integrante",
  otro: "Documento adicional",
};

function statusLabel(s: string): string {
  return STATUS_LABELS[s] ?? s;
}

function stageLabel(s: string): string {
  return STAGE_LABELS[s] ?? s;
}

function attachmentLabel(s: string): string {
  return ATTACHMENT_LABELS[s] ?? s;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function eventDate(ev: HistoryEvent): string {
  if (ev.type === "status_change") return ev.changed_at;
  if (ev.type === "document_uploaded") return ev.uploaded_at;
  return ev.submitted_at;
}

// ── Subcomponentes por tipo de evento ─────────────────────────────────────

function StatusChangeCard({ ev }: { ev: StatusChangeEvent }) {
  return (
    <div className="flex gap-4">
      {/* Ícono */}
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </div>
        <div className="w-0.5 bg-gray-200 flex-1 mt-1" />
      </div>

      {/* Contenido */}
      <div className="pb-6 flex-1 min-w-0">
        <p className="text-xs text-gray-400 mb-1">{formatDate(ev.changed_at)}</p>
        <p className="text-sm font-semibold text-gray-800">
          Cambio de estado
        </p>
        <p className="text-sm text-gray-600 mt-0.5">
          {ev.previous_status ? (
            <>
              <span className="text-gray-400">{statusLabel(ev.previous_status)}</span>
              {" → "}
            </>
          ) : null}
          <span className="font-medium text-gray-800">{statusLabel(ev.new_status)}</span>
        </p>
        {ev.reason && (
          <p className="text-xs text-gray-500 mt-1 italic">"{ev.reason}"</p>
        )}
        <p className="text-xs text-gray-400 mt-1">Por: {ev.changed_by_name}</p>
      </div>
    </div>
  );
}

function DocumentUploadedCard({ ev }: { ev: DocumentUploadedEvent }) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <div className="w-0.5 bg-gray-200 flex-1 mt-1" />
      </div>

      <div className="pb-6 flex-1 min-w-0">
        <p className="text-xs text-gray-400 mb-1">{formatDate(ev.uploaded_at)}</p>
        <p className="text-sm font-semibold text-gray-800">
          Documento adjuntado — {stageLabel(ev.stage)}
        </p>
        <p className="text-sm text-gray-600 mt-0.5">
          {attachmentLabel(ev.attachment_type)}:{" "}
          <span className="text-gray-500 font-mono text-xs">{ev.file_name}</span>
        </p>
        <p className="text-xs text-gray-400 mt-1">Por: {ev.uploaded_by_name}</p>
      </div>
    </div>
  );
}

function EvaluationSubmittedCard({ ev }: { ev: EvaluationSubmittedEvent }) {
  const scoreColor =
    ev.score >= 4.0
      ? "text-green-600"
      : ev.score >= 3.0
        ? "text-yellow-600"
        : "text-red-600";

  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
            />
          </svg>
        </div>
        <div className="w-0.5 bg-gray-200 flex-1 mt-1" />
      </div>

      <div className="pb-6 flex-1 min-w-0">
        <p className="text-xs text-gray-400 mb-1">{formatDate(ev.submitted_at)}</p>
        <p className="text-sm font-semibold text-gray-800">
          Calificación registrada — {stageLabel(ev.stage)}
        </p>
        <p className="text-sm text-gray-600 mt-0.5">
          Jurado {ev.juror_number}
          {ev.juror_number === 3 && (
            <span className="text-gray-400 text-xs ml-1">(dirimente)</span>
          )}
          {" · "}
          <span className={`font-bold ${scoreColor}`}>{ev.score.toFixed(1)}</span>
          <span className="text-gray-400 text-xs"> / 5.0</span>
          {ev.is_extemporaneous && (
            <span className="ml-2 text-xs font-semibold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
              Extemporánea
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────

export default function EstudianteHistorial() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    async function load() {
      try {
        const [projRes, histRes] = await Promise.all([
          api.get<ProjectDetail>(`/projects/${projectId}`),
          api.get<HistoryEvent[]>(`/projects/${projectId}/history`),
        ]);
        if (cancelled) return;
        setProject(projRes.data);
        setEvents(histRes.data);
      } catch {
        if (!cancelled) setError("No se pudo cargar el historial. Recarga la página.");
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
        <div className="h-7 w-52 bg-gray-200 animate-pulse rounded" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-xl" />
        ))}
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

  // Ordenar cronológicamente (el backend ya los ordena, pero por seguridad)
  const sorted = [...events].sort(
    (a, b) => new Date(eventDate(a)).getTime() - new Date(eventDate(b)).getTime(),
  );

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
        <h1 className="text-2xl font-bold text-usc-navy">Historial del proyecto</h1>
        {project && (
          <p className="text-sm text-gray-500 mt-1 truncate">{project.title}</p>
        )}
      </div>

      {/* Sin eventos */}
      {sorted.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500">
            Aún no hay eventos registrados para este trabajo.
          </p>
        </div>
      )}

      {/* Timeline de eventos */}
      {sorted.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          {sorted.map((ev, i) => {
            const isLast = i === sorted.length - 1;
            const key = `${ev.type}-${eventDate(ev)}-${i}`;

            if (ev.type === "status_change") {
              return (
                <div key={key} className={isLast ? "[&>div>div:last-child]:hidden" : ""}>
                  <StatusChangeCard ev={ev} />
                </div>
              );
            }
            if (ev.type === "document_uploaded") {
              return (
                <div key={key} className={isLast ? "[&>div>div:last-child]:hidden" : ""}>
                  <DocumentUploadedCard ev={ev} />
                </div>
              );
            }
            return (
              <div key={key} className={isLast ? "[&>div>div:last-child]:hidden" : ""}>
                <EvaluationSubmittedCard ev={ev} />
              </div>
            );
          })}
        </div>
      )}

      {/* Nota de anonimato */}
      {sorted.some((e) => e.type === "evaluation_submitted") && (
        <p className="text-xs text-gray-400 text-center">
          Las identidades de los jurados son anónimas en cumplimiento del reglamento de
          trabajos de grado (Resolución 004/2025).
        </p>
      )}
    </div>
  );
}
