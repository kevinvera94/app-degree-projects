import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import api from "../../services/api";

// ── Tipos ──────────────────────────────────────────────────────────────────

interface Member {
  full_name: string;
  is_active: boolean;
}

interface Director {
  full_name: string;
  order: number;
  is_active: boolean;
}

interface ProjectDetail {
  id: string;
  title: string;
  modality_id: string;
  period: string;
  status: string;
  members: Member[];
  directors: Director[];
}

interface Modality {
  id: string;
  name: string;
}

interface DateWindow {
  window_type: string;
  is_active: boolean;
  start_date: string;
  end_date: string;
}

interface HistoryEvent {
  type: string;
  new_status?: string;
  changed_at?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; classes: string }> = {
  pendiente_evaluacion_idea: { label: "Pendiente evaluación idea", classes: "bg-blue-100 text-blue-700" },
  idea_aprobada: { label: "Idea aprobada", classes: "bg-blue-100 text-blue-700" },
  idea_rechazada: { label: "Idea rechazada", classes: "bg-red-100 text-red-700" },
  anteproyecto_pendiente_evaluacion: { label: "Anteproyecto — pendiente evaluación", classes: "bg-blue-100 text-blue-700" },
  anteproyecto_aprobado: { label: "Anteproyecto aprobado", classes: "bg-green-100 text-green-700" },
  anteproyecto_reprobado: { label: "Anteproyecto reprobado", classes: "bg-red-100 text-red-700" },
  correcciones_anteproyecto_solicitadas: { label: "Correcciones anteproyecto", classes: "bg-yellow-100 text-yellow-700" },
  anteproyecto_corregido_entregado: { label: "Correcciones entregadas", classes: "bg-blue-100 text-blue-700" },
  en_desarrollo: { label: "En desarrollo", classes: "bg-gray-100 text-gray-600" },
  producto_final_entregado: { label: "Producto final entregado", classes: "bg-blue-100 text-blue-700" },
  en_revision_jurados_producto_final: { label: "En revisión jurados (PF)", classes: "bg-blue-100 text-blue-700" },
  correcciones_producto_final_solicitadas: { label: "Correcciones producto final", classes: "bg-yellow-100 text-yellow-700" },
  producto_final_corregido_entregado: { label: "Correcciones PF entregadas", classes: "bg-blue-100 text-blue-700" },
  aprobado_para_sustentacion: { label: "Aprobado para sustentación", classes: "bg-green-100 text-green-700" },
  sustentacion_programada: { label: "Sustentación programada", classes: "bg-green-100 text-green-700" },
  trabajo_aprobado: { label: "Trabajo aprobado", classes: "bg-green-100 text-green-700" },
  reprobado_en_sustentacion: { label: "Reprobado en sustentación", classes: "bg-red-100 text-red-700" },
  acta_generada: { label: "Acta generada", classes: "bg-green-100 text-green-700" },
  suspendido_por_plagio: { label: "Suspendido por plagio", classes: "bg-red-100 text-red-700" },
  cancelado: { label: "Cancelado", classes: "bg-gray-100 text-gray-500" },
};

const TIMELINE_STEPS = [
  {
    label: "Idea",
    statuses: ["pendiente_evaluacion_idea", "idea_aprobada", "idea_rechazada"],
  },
  {
    label: "Anteproyecto",
    statuses: [
      "anteproyecto_pendiente_evaluacion",
      "anteproyecto_aprobado",
      "anteproyecto_reprobado",
      "correcciones_anteproyecto_solicitadas",
      "anteproyecto_corregido_entregado",
    ],
  },
  {
    label: "Desarrollo",
    statuses: ["en_desarrollo"],
  },
  {
    label: "Producto Final",
    statuses: [
      "producto_final_entregado",
      "en_revision_jurados_producto_final",
      "correcciones_producto_final_solicitadas",
      "producto_final_corregido_entregado",
      "aprobado_para_sustentacion",
    ],
  },
  {
    label: "Sustentación",
    statuses: ["sustentacion_programada", "trabajo_aprobado", "reprobado_en_sustentacion"],
  },
  {
    label: "Acta",
    statuses: ["acta_generada"],
  },
];

const CORRECTION_STATUSES = new Set([
  "correcciones_anteproyecto_solicitadas",
  "correcciones_producto_final_solicitadas",
]);

function getTimelineStep(status: string): number {
  return TIMELINE_STEPS.findIndex((s) => s.statuses.includes(status));
}

function getActionForStatus(
  status: string,
  projectId: string,
): { label: string; to: string } | null {
  switch (status) {
    case "idea_aprobada":
      return {
        label: "Radicar anteproyecto",
        to: `/estudiante/proyectos/${projectId}/radicar-anteproyecto`,
      };
    case "correcciones_anteproyecto_solicitadas":
    case "correcciones_producto_final_solicitadas":
      return {
        label: "Subir correcciones",
        to: `/estudiante/proyectos/${projectId}/entregar-correcciones`,
      };
    case "en_desarrollo":
      return {
        label: "Radicar producto final",
        to: `/estudiante/proyectos/${projectId}/radicar-producto-final`,
      };
    case "trabajo_aprobado":
      return {
        label: "Diligenciar autorización de biblioteca",
        to: `/estudiante/proyectos/${projectId}/biblioteca`,
      };
    case "acta_generada":
      return {
        label: "Descargar acta",
        to: `/estudiante/proyectos/${projectId}/acta`,
      };
    default:
      return null;
  }
}

/**
 * Días hábiles restantes (excluye fines de semana).
 * Aproximación sin festivos USC — suficiente para indicador visual en MVP.
 */
function businessDaysRemaining(requestedAtStr: string, deadlineDays = 10): number {
  const start = new Date(requestedAtStr);
  start.setHours(0, 0, 0, 0);

  // Calcular fecha límite sumando deadlineDays días hábiles desde start
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

  // Contar días hábiles desde hoy hasta la fecha límite (inclusivo)
  let remaining = 0;
  const cursor = new Date(today);
  while (cursor <= deadline) {
    const d = cursor.getDay();
    if (d !== 0 && d !== 6) remaining++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return remaining;
}

function hasActiveInscricionWindow(windows: DateWindow[]): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return windows.some(
    (w) =>
      w.window_type === "inscripcion_idea" &&
      w.is_active &&
      w.start_date <= today &&
      w.end_date >= today,
  );
}

// ── Subcomponentes ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? {
    label: status,
    classes: "bg-gray-100 text-gray-500",
  };
  return (
    <span className={`text-sm font-semibold px-3 py-1 rounded-full ${meta.classes}`}>
      {meta.label}
    </span>
  );
}

function Timeline({ status }: { status: string }) {
  const currentStep = getTimelineStep(status);
  const isSuspended = status === "suspendido_por_plagio" || status === "cancelado";

  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-1">
      {TIMELINE_STEPS.map((step, i) => {
        const isCompleted = !isSuspended && i < currentStep;
        const isCurrent = !isSuspended && i === currentStep;
        const isPending = isSuspended || i > currentStep;

        return (
          <div key={step.label} className="flex items-center min-w-0">
            {/* Nodo */}
            <div className="flex flex-col items-center shrink-0">
              <div
                className={[
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors",
                  isCompleted
                    ? "bg-success border-success text-white"
                    : isCurrent
                      ? "bg-usc-blue border-usc-blue text-white"
                      : "bg-white border-gray-300 text-gray-400",
                ].join(" ")}
              >
                {isCompleted ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={[
                  "text-xs mt-1 text-center whitespace-nowrap",
                  isCurrent
                    ? "font-semibold text-usc-blue"
                    : isCompleted
                      ? "text-success"
                      : isPending
                        ? "text-gray-400"
                        : "text-gray-500",
                ].join(" ")}
              >
                {step.label}
              </span>
            </div>
            {/* Conector (no después del último) */}
            {i < TIMELINE_STEPS.length - 1 && (
              <div
                className={[
                  "h-0.5 w-10 sm:w-14 mx-1 shrink-0",
                  isCompleted ? "bg-success" : "bg-gray-200",
                ].join(" ")}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────

export default function EstudianteDashboard() {
  const location = useLocation();
  const successMessage = (location.state as { successMessage?: string } | null)
    ?.successMessage ?? "";

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [modalities, setModalities] = useState<Modality[]>([]);
  const [dateWindows, setDateWindows] = useState<DateWindow[]>([]);
  const [correctionDaysLeft, setCorrectionDaysLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [projectsRes, modalitiesRes, windowsRes] = await Promise.all([
          api.get<{ id: string; status: string }[]>("/projects/my"),
          api.get<Modality[]>("/modalities"),
          api.get<DateWindow[]>("/date-windows"),
        ]);

        if (cancelled) return;

        setModalities(modalitiesRes.data);
        setDateWindows(windowsRes.data);

        const projects = projectsRes.data;
        if (projects.length === 0) {
          setProject(null);
          return;
        }

        // El estudiante tiene un trabajo activo — obtener detalle
        const activeProject = projects[0];
        const detailRes = await api.get<ProjectDetail>(`/projects/${activeProject.id}`);
        if (cancelled) return;

        setProject(detailRes.data);

        // Si hay correcciones pendientes, obtener historial para calcular el plazo
        if (CORRECTION_STATUSES.has(detailRes.data.status)) {
          try {
            const historyRes = await api.get<HistoryEvent[]>(
              `/projects/${activeProject.id}/history`,
            );
            if (cancelled) return;

            const correctionStatus =
              detailRes.data.status === "correcciones_anteproyecto_solicitadas"
                ? "correcciones_anteproyecto_solicitadas"
                : "correcciones_producto_final_solicitadas";

            // Buscar el evento más reciente que corresponde al status de corrección
            const event = [...historyRes.data]
              .reverse()
              .find((e) => e.type === "status_change" && e.new_status === correctionStatus);

            if (event?.changed_at) {
              setCorrectionDaysLeft(businessDaysRemaining(event.changed_at));
            }
          } catch {
            // No bloquear la vista por error en historial
          }
        }
      } catch {
        if (!cancelled) setError("No se pudo cargar el dashboard. Verifica la conexión.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        <div className="h-7 w-48 bg-gray-200 animate-pulse rounded" />
        <div className="h-40 bg-gray-100 animate-pulse rounded-xl" />
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

  const modalityName =
    project && modalities.find((m) => m.id === project.modality_id)?.name;

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-usc-navy">Dashboard</h1>

      {successMessage && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-green-50 border-green-300 text-green-700 text-sm font-medium">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {successMessage}
        </div>
      )}

      {/* ── Sin trabajo inscrito ────────────────────────────────────────── */}
      {!project && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-gray-100 mx-auto mb-4 flex items-center justify-center">
            <svg
              className="w-7 h-7 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-800 mb-1">
            No tienes un trabajo de grado inscrito
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            Una vez que inscribas tu idea podrás hacer seguimiento del proceso aquí.
          </p>

          {hasActiveInscricionWindow(dateWindows) ? (
            <Link
              to="/estudiante/inscribir-idea"
              className="inline-block bg-usc-blue text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity"
            >
              Inscribir idea
            </Link>
          ) : (
            <p className="text-sm text-gray-400 italic">
              La ventana de inscripción está cerrada. Consulta al Administrador para conocer las
              próximas fechas.
            </p>
          )}
        </div>
      )}

      {/* ── Con trabajo inscrito ─────────────────────────────────────────── */}
      {project && (
        <>
          {/* Alerta de correcciones pendientes */}
          {CORRECTION_STATUSES.has(project.status) && correctionDaysLeft !== null && (
            <div
              className={[
                "flex items-center gap-3 px-4 py-3 rounded-lg border text-sm font-medium",
                correctionDaysLeft <= 2
                  ? "bg-red-50 border-red-300 text-red-700"
                  : "bg-yellow-50 border-yellow-300 text-yellow-700",
              ].join(" ")}
            >
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              {correctionDaysLeft === 0
                ? "El plazo de correcciones ha vencido. La entrega estará disponible cuando se abra la siguiente ventana de radicación."
                : `Tienes ${correctionDaysLeft} día${correctionDaysLeft === 1 ? "" : "s"} hábil${correctionDaysLeft === 1 ? "" : "es"} para entregar las correcciones.`}
            </div>
          )}

          {/* Tarjeta del trabajo */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900 leading-snug">{project.title}</h2>
                {modalityName && (
                  <p className="text-sm text-gray-500 mt-0.5">{modalityName}</p>
                )}
              </div>
              <StatusBadge status={project.status} />
            </div>

            {/* Integrantes */}
            {project.members.filter((m) => m.is_active).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Integrantes
                </p>
                <div className="flex flex-wrap gap-2">
                  {project.members
                    .filter((m) => m.is_active)
                    .map((m) => (
                      <span
                        key={m.full_name}
                        className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded-full"
                      >
                        {m.full_name}
                      </span>
                    ))}
                </div>
              </div>
            )}

            {/* Directores */}
            {project.directors.filter((d) => d.is_active).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  {project.directors.filter((d) => d.is_active).length === 1
                    ? "Director"
                    : "Directores"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {project.directors
                    .filter((d) => d.is_active)
                    .sort((a, b) => a.order - b.order)
                    .map((d) => (
                      <span
                        key={d.full_name}
                        className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded-full"
                      >
                        {d.full_name}
                      </span>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Línea de tiempo */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <p className="text-sm font-semibold text-gray-600 mb-5">Progreso del proceso</p>
            {project.status === "suspendido_por_plagio" ||
            project.status === "cancelado" ? (
              <p className="text-sm text-red-600 font-medium">
                El proceso está suspendido.{" "}
                {project.status === "suspendido_por_plagio"
                  ? "Motivo: presunto plagio. Contacta al Administrador."
                  : "El trabajo fue cancelado."}
              </p>
            ) : (
              <Timeline status={project.status} />
            )}
          </div>

          {/* Acción principal */}
          {(() => {
            const action = getActionForStatus(project.status, project.id);
            if (!action) return null;
            return (
              <div className="flex justify-start">
                <Link
                  to={action.to}
                  className="inline-block bg-usc-blue text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity"
                >
                  {action.label}
                </Link>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
