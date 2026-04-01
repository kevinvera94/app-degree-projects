import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";

// ── Tipos ──────────────────────────────────────────────────────────────────

interface ProjectItem {
  id: string;
  title: string;
  modality_id: string;
  academic_program_id: string;
  period: string;
  status: string;
  plagiarism_suspended: boolean;
}

interface PaginatedProjects {
  items: ProjectItem[];
  total: number;
  page: number;
  size: number;
}

interface LookupItem {
  id: string;
  name: string;
}

// ── Mapa de estados ────────────────────────────────────────────────────────

interface StatusMeta {
  label: string;
  classes: string;
}

const STATUS_META: Record<string, StatusMeta> = {
  pendiente_evaluacion_idea: {
    label: "Pendiente evaluación",
    classes: "bg-blue-100 text-blue-700",
  },
  idea_aprobada: {
    label: "Idea aprobada",
    classes: "bg-blue-100 text-blue-700",
  },
  idea_rechazada: {
    label: "Idea rechazada",
    classes: "bg-red-100 text-red-700",
  },
  anteproyecto_pendiente_evaluacion: {
    label: "Anteproyecto — pendiente",
    classes: "bg-blue-100 text-blue-700",
  },
  anteproyecto_reprobado: {
    label: "Anteproyecto reprobado",
    classes: "bg-red-100 text-red-700",
  },
  correcciones_anteproyecto_solicitadas: {
    label: "Correcciones anteproy.",
    classes: "bg-yellow-100 text-yellow-700",
  },
  anteproyecto_corregido_entregado: {
    label: "Correcciones entregadas",
    classes: "bg-blue-100 text-blue-700",
  },
  en_desarrollo: {
    label: "En desarrollo",
    classes: "bg-gray-100 text-gray-600",
  },
  producto_final_entregado: {
    label: "Producto final entregado",
    classes: "bg-blue-100 text-blue-700",
  },
  en_revision_jurados_producto_final: {
    label: "En revisión (PF)",
    classes: "bg-blue-100 text-blue-700",
  },
  correcciones_producto_final_solicitadas: {
    label: "Correcciones PF",
    classes: "bg-yellow-100 text-yellow-700",
  },
  producto_final_corregido_entregado: {
    label: "Correcciones PF entregadas",
    classes: "bg-blue-100 text-blue-700",
  },
  producto_final_reprobado: {
    label: "PF reprobado",
    classes: "bg-red-100 text-red-700",
  },
  aprobado_para_sustentacion: {
    label: "Aprobado p/ sustentación",
    classes: "bg-green-100 text-green-700",
  },
  sustentacion_programada: {
    label: "Sustentación programada",
    classes: "bg-green-100 text-green-700",
  },
  trabajo_aprobado: {
    label: "Trabajo aprobado",
    classes: "bg-green-100 text-green-700",
  },
  reprobado_en_sustentacion: {
    label: "Reprobado sustentación",
    classes: "bg-red-100 text-red-700",
  },
  acta_generada: {
    label: "Acta generada",
    classes: "bg-green-100 text-green-700",
  },
  suspendido_por_plagio: {
    label: "Suspendido por plagio",
    classes: "bg-red-100 text-red-700",
  },
  cancelado: {
    label: "Cancelado",
    classes: "bg-gray-100 text-gray-500",
  },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? {
    label: status,
    classes: "bg-gray-100 text-gray-500",
  };
  return (
    <span
      className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${meta.classes}`}
    >
      {meta.label}
    </span>
  );
}

// ── Lista de estados para el filtro ───────────────────────────────────────

const FILTER_STATUSES = Object.entries(STATUS_META).map(([value, { label }]) => ({
  value,
  label,
}));

// ── Página principal ───────────────────────────────────────────────────────

export default function AdminProyectos() {
  const navigate = useNavigate();

  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  // Lookups para nombres de modalidad y programa
  const [modalityMap, setModalityMap] = useState<Record<string, string>>({});
  const [programMap, setProgramMap] = useState<Record<string, string>>({});
  const [lookupsReady, setLookupsReady] = useState(false);

  // Filtros
  const [filterStatus, setFilterStatus] = useState("");
  const [filterModality, setFilterModality] = useState("");
  const [filterProgram, setFilterProgram] = useState("");
  const [filterPeriod, setFilterPeriod] = useState("");

  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState("");

  // Cargar lookups una sola vez
  useEffect(() => {
    Promise.all([
      api.get<LookupItem[]>("/modalities"),
      api.get<LookupItem[]>("/academic-programs"),
    ]).then(([modRes, progRes]) => {
      setModalityMap(
        Object.fromEntries(modRes.data.map((m) => [m.id, m.name]))
      );
      setProgramMap(
        Object.fromEntries(progRes.data.map((p) => [p.id, p.name]))
      );
      setLookupsReady(true);
    });
  }, []);

  const fetchProjects = useCallback(async () => {
    setLoadingList(true);
    setListError("");
    try {
      const params: Record<string, string | number> = {
        page,
        size: PAGE_SIZE,
      };
      if (filterStatus) params.project_status = filterStatus;
      if (filterModality) params.modality_id = filterModality;
      if (filterProgram) params.academic_program_id = filterProgram;
      if (filterPeriod) params.academic_period = filterPeriod;

      const res = await api.get<PaginatedProjects>("/reports/projects", {
        params,
      });
      setProjects(res.data.items);
      setTotal(res.data.total);
    } catch {
      setListError("No se pudo cargar la lista de proyectos.");
    } finally {
      setLoadingList(false);
    }
  }, [page, filterStatus, filterModality, filterProgram, filterPeriod]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Resetear página al cambiar filtros
  useEffect(() => {
    setPage(1);
  }, [filterStatus, filterModality, filterProgram, filterPeriod]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const modalityOptions = Object.entries(modalityMap).map(([id, name]) => ({
    id,
    name,
  }));
  const programOptions = Object.entries(programMap).map(([id, name]) => ({
    id,
    name,
  }));

  return (
    <div className="p-8">
      {/* Encabezado */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-usc-navy">Proyectos</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total} proyecto{total !== 1 ? "s" : ""} encontrado{total !== 1 ? "s" : ""}
          </p>
        </div>
        {/* Exportar — pendiente MVP */}
        <button
          disabled
          className="border border-gray-200 text-gray-400 text-sm px-4 py-2 rounded-lg cursor-not-allowed"
          title="Próximamente"
        >
          Exportar
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-5">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-usc-blue"
        >
          <option value="">Todos los estados</option>
          {FILTER_STATUSES.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={filterModality}
          onChange={(e) => setFilterModality(e.target.value)}
          disabled={!lookupsReady}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-usc-blue disabled:opacity-50"
        >
          <option value="">Todas las modalidades</option>
          {modalityOptions.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>

        <select
          value={filterProgram}
          onChange={(e) => setFilterProgram(e.target.value)}
          disabled={!lookupsReady}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-usc-blue disabled:opacity-50"
        >
          <option value="">Todos los programas</option>
          {programOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Periodo (ej. 2026-1)"
          value={filterPeriod}
          onChange={(e) => setFilterPeriod(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-usc-blue"
        />

        {(filterStatus || filterModality || filterProgram || filterPeriod) && (
          <button
            onClick={() => {
              setFilterStatus("");
              setFilterModality("");
              setFilterProgram("");
              setFilterPeriod("");
            }}
            className="text-sm text-gray-500 hover:text-gray-800 px-2 py-2"
          >
            × Limpiar filtros
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {listError ? (
          <p className="p-6 text-sm text-red-600">{listError}</p>
        ) : loadingList ? (
          <p className="p-6 text-sm text-gray-500">Cargando...</p>
        ) : projects.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">
            No hay proyectos con los filtros seleccionados.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left">
                <th className="px-5 py-3 font-semibold text-gray-600">Título</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Modalidad</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Programa</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Periodo</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {projects.map((p) => (
                <tr
                  key={p.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/admin/proyectos/${p.id}`)}
                >
                  <td className="px-5 py-3">
                    <span className="font-medium text-gray-800 line-clamp-2 max-w-xs block">
                      {p.title}
                    </span>
                    {p.plagiarism_suspended && (
                      <span className="text-xs text-red-500 font-medium">
                        ⚠ Plagio
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-600">
                    {modalityMap[p.modality_id] ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-gray-600 max-w-[180px]">
                    <span className="truncate block">
                      {programMap[p.academic_program_id] ?? "—"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-600">{p.period}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
          <span>
            Página {page} de {totalPages} — {total} resultado{total !== 1 ? "s" : ""}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
