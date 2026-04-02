import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import api from "../../services/api";

// ── Tipos ──────────────────────────────────────────────────────────────────

interface ProjectSummary {
  id: string;
  title: string;
  academic_program_id: string;
  status: string;
  period: string;
}

interface DirectorInfo {
  docente_id: string;
  is_active: boolean;
}

interface JurorInfo {
  docente_id: string | null;
  is_active: boolean;
  stage: string;
}

interface ProjectDetail {
  id: string;
  title: string;
  academic_program_id: string;
  status: string;
  period: string;
  directors: DirectorInfo[];
  jurors: JurorInfo[];
}

interface AcademicProgram {
  id: string;
  name: string;
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
  anteproyecto_corregido_entregado: "Correcciones entregadas",
  en_desarrollo: "En desarrollo",
  producto_final_entregado: "Producto final entregado",
  en_revision_jurados_producto_final: "En revisión de jurados (PF)",
  correcciones_producto_final_solicitadas: "Correcciones de producto final",
  producto_final_corregido_entregado: "Correcciones PF entregadas",
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
  idea_rechazada: "bg-red-100 text-red-700",
  anteproyecto_pendiente_evaluacion: "bg-yellow-100 text-yellow-700",
  anteproyecto_aprobado: "bg-green-100 text-green-700",
  anteproyecto_reprobado: "bg-red-100 text-red-700",
  correcciones_anteproyecto_solicitadas: "bg-yellow-100 text-yellow-700",
  anteproyecto_corregido_entregado: "bg-blue-100 text-blue-700",
  en_desarrollo: "bg-gray-100 text-gray-600",
  producto_final_entregado: "bg-blue-100 text-blue-700",
  en_revision_jurados_producto_final: "bg-yellow-100 text-yellow-700",
  correcciones_producto_final_solicitadas: "bg-yellow-100 text-yellow-700",
  producto_final_corregido_entregado: "bg-blue-100 text-blue-700",
  aprobado_para_sustentacion: "bg-green-100 text-green-700",
  sustentacion_programada: "bg-green-100 text-green-700",
  trabajo_aprobado: "bg-green-100 text-green-700",
  reprobado_en_sustentacion: "bg-red-100 text-red-700",
  acta_generada: "bg-green-100 text-green-700",
  suspendido_por_plagio: "bg-red-100 text-red-700",
  cancelado: "bg-gray-100 text-gray-400",
};

// Statuses en los que el jurado tiene calificación pendiente
const PENDING_EVAL_STATUSES = new Set([
  "anteproyecto_pendiente_evaluacion",
  "en_revision_jurados_producto_final",
]);

function statusLabel(s: string) {
  return STATUS_LABELS[s] ?? s;
}

function statusClasses(s: string) {
  return STATUS_CLASSES[s] ?? "bg-gray-100 text-gray-500";
}

// ── Subcomponente: tabla de proyectos ──────────────────────────────────────

function ProjectRow({
  proj,
  programName,
  badgePending,
}: {
  proj: ProjectDetail;
  programName: string;
  badgePending?: boolean;
}) {
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3">
        <Link
          to={`/docente/proyectos/${proj.id}`}
          className="text-sm font-medium text-usc-blue hover:underline"
        >
          {proj.title}
        </Link>
        <p className="text-xs text-gray-400 mt-0.5">{proj.period}</p>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">
        {programName}
      </td>
      <td className="px-4 py-3">
        <span
          className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${statusClasses(proj.status)}`}
        >
          {statusLabel(proj.status)}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          {badgePending && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700 bg-orange-100 px-2 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse inline-block" />
              Pendiente calificar
            </span>
          )}
          <Link
            to={`/docente/proyectos/${proj.id}`}
            className="text-xs text-gray-400 hover:text-usc-blue transition-colors"
          >
            Ver →
          </Link>
        </div>
      </td>
    </tr>
  );
}

function ProjectTable({
  projects,
  programs,
  showPendingBadge,
  emptyMessage,
}: {
  projects: ProjectDetail[];
  programs: AcademicProgram[];
  showPendingBadge: boolean;
  emptyMessage: string;
}) {
  if (projects.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic py-4 text-center">{emptyMessage}</p>
    );
  }

  function programName(id: string) {
    return programs.find((p) => p.id === id)?.name ?? "—";
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Título
            </th>
            <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">
              Programa
            </th>
            <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Estado
            </th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {projects.map((proj) => (
            <ProjectRow
              key={proj.id}
              proj={proj}
              programName={programName(proj.academic_program_id)}
              badgePending={
                showPendingBadge && PENDING_EVAL_STATUSES.has(proj.status)
              }
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────

export default function DocenteDashboard() {
  const { user } = useAuth();

  const [directorProjects, setDirectorProjects] = useState<ProjectDetail[]>([]);
  const [jurorProjects, setJurorProjects] = useState<ProjectDetail[]>([]);
  const [programs, setPrograms] = useState<AcademicProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const userId = user.id;

    async function load() {
      try {
        // Obtener lista resumida + programas en paralelo
        const [myRes, programsRes] = await Promise.all([
          api.get<ProjectSummary[]>("/projects/my"),
          api.get<AcademicProgram[]>("/academic-programs"),
        ]);

        if (cancelled) return;
        setPrograms(programsRes.data);

        const summaries = myRes.data;
        if (summaries.length === 0) {
          setLoading(false);
          return;
        }

        // Obtener detalle de cada proyecto en paralelo para saber el rol
        const details = await Promise.all(
          summaries.map((p) =>
            api.get<ProjectDetail>(`/projects/${p.id}`).then((r) => r.data),
          ),
        );

        if (cancelled) return;

        const dirs: ProjectDetail[] = [];
        const jurs: ProjectDetail[] = [];

        for (const detail of details) {
          const isDirector = detail.directors.some(
            (d) => d.docente_id === userId && d.is_active,
          );
          const isJuror = detail.jurors.some(
            (j) => j.docente_id === userId && j.is_active,
          );
          // Un docente puede ser director Y jurado en el mismo proyecto (poco frecuente)
          if (isDirector) dirs.push(detail);
          if (isJuror) jurs.push(detail);
        }

        setDirectorProjects(dirs);
        setJurorProjects(jurs);
      } catch {
        if (!cancelled) setError("No se pudo cargar el dashboard. Verifica la conexión.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [user?.id]);

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        <div className="h-7 w-48 bg-gray-200 animate-pulse rounded" />
        <div className="h-48 bg-gray-100 animate-pulse rounded-xl" />
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

  const pendingJuror = jurorProjects.filter((p) =>
    PENDING_EVAL_STATUSES.has(p.status),
  ).length;

  return (
    <div className="p-8 max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-usc-navy">Dashboard</h1>
        {user?.full_name && (
          <p className="text-sm text-gray-500 mt-1">Bienvenido, {user.full_name}</p>
        )}
      </div>

      {/* Resumen rápido */}
      {(pendingJuror > 0) && (
        <div className="flex gap-3 items-center bg-orange-50 border border-orange-200 text-orange-800 rounded-xl px-5 py-4 text-sm font-medium">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          Tienes {pendingJuror} trabajo{pendingJuror > 1 ? "s" : ""} pendiente{pendingJuror > 1 ? "s" : ""} de calificación como Jurado.
        </div>
      )}

      {/* ── Sección Director ─────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-800">
            Mis trabajos como Director
          </h2>
          <span className="text-xs text-gray-400 font-medium">
            {directorProjects.length} trabajo{directorProjects.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <ProjectTable
            projects={directorProjects}
            programs={programs}
            showPendingBadge={false}
            emptyMessage="No tienes trabajos asignados como Director."
          />
        </div>
      </section>

      {/* ── Sección Jurado ───────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-800">
            Mis trabajos como Jurado
          </h2>
          <span className="text-xs text-gray-400 font-medium">
            {jurorProjects.length} trabajo{jurorProjects.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <ProjectTable
            projects={jurorProjects}
            programs={programs}
            showPendingBadge={true}
            emptyMessage="No tienes trabajos asignados como Jurado."
          />
        </div>
      </section>

      {/* Sin ningún trabajo */}
      {directorProjects.length === 0 && jurorProjects.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500">
            No tienes trabajos asignados en este momento.
          </p>
        </div>
      )}
    </div>
  );
}
