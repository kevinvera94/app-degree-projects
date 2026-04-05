import { useCallback, useEffect, useState } from "react";
import api from "../../services/api";
import DocenteSearchInput from "../../components/DocenteSearchInput";

// ── Tipos ──────────────────────────────────────────────────────────────────

type Tab = "extemporaneos" | "vencimiento" | "carga" | "ficha";

interface LateEvaluationItem {
  docente_name: string;
  project_title: string;
  stage: string;
  deadline_date: string;
  submitted_at: string;
  days_late: number;
}

interface ExpiringEvaluationItem {
  docente_name: string;
  project_title: string;
  stage: string;
  deadline_date: string;
  business_days_remaining: number;
}

interface WorkloadProjectItem {
  project_id: string;
  title: string;
  status: string;
  role: string;
  juror_number: number | null;
}

interface WorkloadResponse {
  director_projects: WorkloadProjectItem[];
  juror_projects: WorkloadProjectItem[];
  total_active: number;
}

interface DocenteOption {
  id: string;
  full_name: string;
  email: string;
}

interface StudentUserInfo {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
}

interface StudentSubmissionItem {
  id: string;
  stage: string;
  status: string;
  submitted_at: string | null;
}

interface StudentEvaluationItem {
  juror_number: number;
  stage: string;
  score: number | null;
  submitted_at: string | null;
  is_extemporaneous: boolean;
}

interface StudentStatusHistoryItem {
  previous_status: string | null;
  new_status: string;
  changed_at: string;
}

interface StudentProjectInfo {
  id: string;
  title: string;
  status: string;
  period: string;
  submissions: StudentSubmissionItem[];
  evaluations: StudentEvaluationItem[];
  history: StudentStatusHistoryItem[];
}

interface StudentReportResponse {
  user_info: StudentUserInfo;
  project: StudentProjectInfo | null;
}

interface PaginatedUsers {
  items: DocenteOption[];
  total: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return iso.split("T")[0];
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function StageLabel({ stage }: { stage: string }) {
  const map: Record<string, string> = {
    anteproyecto: "Anteproyecto",
    producto_final: "Producto final",
    sustentacion: "Sustentación",
  };
  return <span>{map[stage] ?? stage}</span>;
}

// ── Pestaña: Jurados extemporáneos ─────────────────────────────────────────

function TabExtemporaneos() {
  const [items, setItems] = useState<LateEvaluationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    api
      .get<LateEvaluationItem[]>("/reports/jurors/late")
      .then((r) => setItems(r.data))
      .catch(() => setError("No se pudo cargar el reporte."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-gray-500 py-6">Cargando...</p>;
  if (error) return <p className="text-sm text-red-600 py-6">{error}</p>;
  if (items.length === 0)
    return (
      <p className="text-sm text-gray-500 py-6">
        No hay calificaciones extemporáneas registradas.
      </p>
    );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-left">
            <th className="px-5 py-3 font-semibold text-gray-600">Docente</th>
            <th className="px-5 py-3 font-semibold text-gray-600">Trabajo</th>
            <th className="px-5 py-3 font-semibold text-gray-600">Etapa</th>
            <th className="px-5 py-3 font-semibold text-gray-600">Plazo</th>
            <th className="px-5 py-3 font-semibold text-gray-600">Entregado</th>
            <th className="px-5 py-3 font-semibold text-gray-600 text-right">
              Días tarde
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((item, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="px-5 py-3 text-gray-800 font-medium">
                {item.docente_name}
              </td>
              <td className="px-5 py-3 text-gray-600 max-w-[220px]">
                <span className="line-clamp-2 block">{item.project_title}</span>
              </td>
              <td className="px-5 py-3 text-gray-600">
                <StageLabel stage={item.stage} />
              </td>
              <td className="px-5 py-3 text-gray-600">
                {formatDate(item.deadline_date)}
              </td>
              <td className="px-5 py-3 text-gray-600">
                {formatDateTime(item.submitted_at)}
              </td>
              <td className="px-5 py-3 text-right">
                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                  +{item.days_late} día{item.days_late !== 1 ? "s" : ""}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Pestaña: Vencimiento próximo ───────────────────────────────────────────

function TabVencimiento() {
  const storedDays = Number(
    localStorage.getItem("usc_juror_alert_days") ?? "3"
  );
  const [days, setDays] = useState(storedDays);
  const [items, setItems] = useState<ExpiringEvaluationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetch = useCallback(() => {
    setLoading(true);
    setError("");
    api
      .get<ExpiringEvaluationItem[]>("/reports/jurors/expiring", {
        params: { days },
      })
      .then((r) => setItems(r.data))
      .catch(() => setError("No se pudo cargar el reporte."))
      .finally(() => setLoading(false));
  }, [days]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return (
    <div className="space-y-4">
      {/* Control N días */}
      <div className="flex items-center gap-3">
        <label className="text-sm text-gray-600">Mostrar jurados con plazo en</label>
        <input
          type="number"
          min={1}
          max={30}
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="w-20 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-usc-blue"
        />
        <span className="text-sm text-gray-600">días hábiles o menos</span>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Cargando...</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">
          No hay jurados con plazo próximo a vencer con los criterios dados.
        </p>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left">
                <th className="px-5 py-3 font-semibold text-gray-600">
                  Docente
                </th>
                <th className="px-5 py-3 font-semibold text-gray-600">
                  Trabajo
                </th>
                <th className="px-5 py-3 font-semibold text-gray-600">
                  Etapa
                </th>
                <th className="px-5 py-3 font-semibold text-gray-600">
                  Plazo
                </th>
                <th className="px-5 py-3 font-semibold text-gray-600 text-right">
                  Días restantes
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-5 py-3 text-gray-800 font-medium">
                    {item.docente_name}
                  </td>
                  <td className="px-5 py-3 text-gray-600 max-w-[220px]">
                    <span className="line-clamp-2 block">
                      {item.project_title}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-600">
                    <StageLabel stage={item.stage} />
                  </td>
                  <td className="px-5 py-3 text-gray-600">
                    {formatDate(item.deadline_date)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                        item.business_days_remaining <= 1
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {item.business_days_remaining} día
                      {item.business_days_remaining !== 1 ? "s" : ""}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Pestaña: Carga docente ─────────────────────────────────────────────────

interface DocenteInfo {
  id: string;
  full_name: string;
  email: string;
}

function TabCargaDocente() {
  const [selectedId, setSelectedId] = useState("");
  const [selectedDocente, setSelectedDocente] = useState<DocenteInfo | null>(null);
  const [workload, setWorkload] = useState<WorkloadResponse | null>(null);
  const [loadingWorkload, setLoadingWorkload] = useState(false);
  const [error, setError] = useState("");

  function handleDocenteChange(id: string, docente: DocenteInfo | null) {
    setSelectedId(id);
    setSelectedDocente(docente);
    setWorkload(null);
    setError("");
    if (!id) return;
    setLoadingWorkload(true);
    api
      .get<WorkloadResponse>(`/reports/docentes/${id}/workload`)
      .then((r) => setWorkload(r.data))
      .catch(() => setError("No se pudo cargar la carga docente."))
      .finally(() => setLoadingWorkload(false));
  }

  function WorkloadTable({
    rows,
    label,
  }: {
    rows: WorkloadProjectItem[];
    label: string;
  }) {
    if (rows.length === 0)
      return (
        <p className="text-sm text-gray-500 px-4 py-3">
          Sin proyectos activos como {label.toLowerCase()}.
        </p>
      );
    return (
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-left">
            <th className="px-4 py-2 font-semibold text-gray-600">Título</th>
            <th className="px-4 py-2 font-semibold text-gray-600">Estado</th>
            {label === "Jurado" && (
              <th className="px-4 py-2 font-semibold text-gray-600">
                N° jurado
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r) => (
            <tr key={r.project_id} className="hover:bg-gray-50">
              <td className="px-4 py-2 text-gray-700 max-w-[260px]">
                <span className="line-clamp-2 block">{r.title}</span>
              </td>
              <td className="px-4 py-2 text-gray-500 text-xs">{r.status}</td>
              {label === "Jurado" && (
                <td className="px-4 py-2 text-gray-600">
                  J{r.juror_number ?? "—"}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <div className="grid grid-cols-[300px_1fr] gap-6">
      {/* Panel izquierdo: buscador de docente */}
      <div>
        <DocenteSearchInput
          value={selectedId}
          onChange={handleDocenteChange}
          label="Docente"
          placeholder="Buscar por nombre o email…"
        />
      </div>

      {/* Panel derecho: carga */}
      <div>
        {!selectedId && (
          <p className="text-sm text-gray-400 mt-8">
            Busca y selecciona un docente para ver su carga.
          </p>
        )}
        {loadingWorkload && (
          <p className="text-sm text-gray-500 mt-8">Cargando...</p>
        )}
        {error && <p className="text-sm text-red-600 mt-8">{error}</p>}
        {workload && selectedDocente && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div>
                <p className="font-semibold text-gray-800">
                  {selectedDocente.full_name}
                </p>
                <p className="text-sm text-gray-500">{selectedDocente.email}</p>
              </div>
              <span className="ml-auto text-sm font-medium bg-usc-navy text-white px-3 py-1 rounded-full">
                {workload.total_active} activo{workload.total_active !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <p className="px-4 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b border-gray-200">
                Como Director ({workload.director_projects.length})
              </p>
              <WorkloadTable rows={workload.director_projects} label="Director" />
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <p className="px-4 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b border-gray-200">
                Como Jurado ({workload.juror_projects.length})
              </p>
              <WorkloadTable rows={workload.juror_projects} label="Jurado" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Pestaña: Ficha estudiante ──────────────────────────────────────────────

function TabFichaEstudiante() {
  const [query, setQuery] = useState("");
  const [students, setStudents] = useState<DocenteOption[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [report, setReport] = useState<StudentReportResponse | null>(null);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [reportError, setReportError] = useState("");

  function handleSearch() {
    if (!query.trim()) return;
    setLoadingSearch(true);
    setSearchError("");
    setStudents([]);
    setSelectedId("");
    setReport(null);
    api
      .get<PaginatedUsers>("/users", {
        params: { role: "estudiante", search: query.trim(), size: 30 },
      })
      .then((r) => {
        setStudents(r.data.items);
        if (r.data.items.length === 0)
          setSearchError("No se encontraron estudiantes con ese criterio.");
      })
      .catch(() => setSearchError("Error al buscar estudiantes."))
      .finally(() => setLoadingSearch(false));
  }

  function handleSelect(id: string) {
    setSelectedId(id);
    setReport(null);
    setReportError("");
    if (!id) return;
    setLoadingReport(true);
    api
      .get<StudentReportResponse>(`/reports/students/${id}`)
      .then((r) => setReport(r.data))
      .catch(() => setReportError("No se pudo cargar la ficha del estudiante."))
      .finally(() => setLoadingReport(false));
  }

  function StatusBadge({ status }: { status: string }) {
    const greenSet = new Set([
      "trabajo_aprobado",
      "acta_generada",
      "aprobado_para_sustentacion",
    ]);
    const redSet = new Set([
      "idea_rechazada",
      "anteproyecto_reprobado",
      "producto_final_reprobado",
      "reprobado_en_sustentacion",
      "suspendido_por_plagio",
      "cancelado",
    ]);
    const cls = greenSet.has(status)
      ? "bg-green-100 text-green-700"
      : redSet.has(status)
      ? "bg-red-100 text-red-700"
      : "bg-blue-100 text-blue-700";
    return (
      <span
        className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}
      >
        {status.replace(/_/g, " ")}
      </span>
    );
  }

  return (
    <div className="space-y-5">
      {/* Buscador */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Nombre o email del estudiante"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-usc-blue"
        />
        <button
          onClick={handleSearch}
          disabled={loadingSearch || !query.trim()}
          className="px-4 py-2 bg-usc-blue text-white text-sm rounded-lg hover:bg-usc-navy transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loadingSearch ? "Buscando..." : "Buscar"}
        </button>
      </div>

      {searchError && <p className="text-sm text-red-600">{searchError}</p>}

      {/* Resultados de búsqueda */}
      {students.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <p className="px-4 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b border-gray-200">
            {students.length} resultado{students.length !== 1 ? "s" : ""}
          </p>
          <ul className="divide-y divide-gray-100">
            {students.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => handleSelect(s.id)}
                  className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition-colors ${
                    selectedId === s.id ? "bg-blue-50 font-medium" : ""
                  }`}
                >
                  <span className="text-gray-800">{s.full_name}</span>
                  <span className="text-gray-400 ml-2 text-xs">{s.email}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {loadingReport && (
        <p className="text-sm text-gray-500">Cargando ficha...</p>
      )}
      {reportError && <p className="text-sm text-red-600">{reportError}</p>}

      {/* Ficha del estudiante */}
      {report && (
        <div className="space-y-4">
          {/* Datos personales */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-gray-800 text-base">
                  {report.user_info.full_name}
                </p>
                <p className="text-sm text-gray-500">{report.user_info.email}</p>
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  report.user_info.is_active
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {report.user_info.is_active ? "Activo" : "Inactivo"}
              </span>
            </div>
          </div>

          {report.project === null ? (
            <p className="text-sm text-gray-500">
              Este estudiante no tiene un trabajo de grado registrado.
            </p>
          ) : (
            <>
              {/* Info del proyecto */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <p className="font-semibold text-gray-800">
                    {report.project.title}
                  </p>
                  <StatusBadge status={report.project.status} />
                </div>
                <p className="text-sm text-gray-500">
                  Periodo: {report.project.period}
                </p>
              </div>

              {/* Calificaciones */}
              {report.project.evaluations.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <p className="px-4 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b border-gray-200">
                    Calificaciones
                  </p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-left">
                        <th className="px-4 py-2 font-semibold text-gray-600">
                          Etapa
                        </th>
                        <th className="px-4 py-2 font-semibold text-gray-600">
                          Jurado
                        </th>
                        <th className="px-4 py-2 font-semibold text-gray-600 text-right">
                          Nota
                        </th>
                        <th className="px-4 py-2 font-semibold text-gray-600">
                          Fecha
                        </th>
                        <th className="px-4 py-2 font-semibold text-gray-600">
                          Estado
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {report.project.evaluations.map((ev, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-600">
                            <StageLabel stage={ev.stage} />
                          </td>
                          <td className="px-4 py-2 text-gray-600">
                            J{ev.juror_number}
                          </td>
                          <td className="px-4 py-2 text-right font-semibold text-gray-800">
                            {ev.score !== null ? ev.score.toFixed(1) : "—"}
                          </td>
                          <td className="px-4 py-2 text-gray-500 text-xs">
                            {ev.submitted_at
                              ? formatDateTime(ev.submitted_at)
                              : "—"}
                          </td>
                          <td className="px-4 py-2">
                            {ev.is_extemporaneous ? (
                              <span className="text-xs text-red-600 font-medium">
                                Extemporánea
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">
                                A tiempo
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Radicaciones */}
              {report.project.submissions.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <p className="px-4 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b border-gray-200">
                    Radicaciones
                  </p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-left">
                        <th className="px-4 py-2 font-semibold text-gray-600">
                          Etapa
                        </th>
                        <th className="px-4 py-2 font-semibold text-gray-600">
                          Estado
                        </th>
                        <th className="px-4 py-2 font-semibold text-gray-600">
                          Fecha
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {report.project.submissions.map((sub) => (
                        <tr key={sub.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-600">
                            <StageLabel stage={sub.stage} />
                          </td>
                          <td className="px-4 py-2 text-gray-500 text-xs">
                            {sub.status}
                          </td>
                          <td className="px-4 py-2 text-gray-500 text-xs">
                            {sub.submitted_at
                              ? formatDateTime(sub.submitted_at)
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Historial de estados */}
              {report.project.history.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <p className="px-4 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b border-gray-200">
                    Historial de estados
                  </p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-left">
                        <th className="px-4 py-2 font-semibold text-gray-600">
                          Estado anterior
                        </th>
                        <th className="px-4 py-2 font-semibold text-gray-600">
                          Estado nuevo
                        </th>
                        <th className="px-4 py-2 font-semibold text-gray-600">
                          Fecha
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {report.project.history.map((h, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-400 text-xs">
                            {h.previous_status?.replace(/_/g, " ") ?? "—"}
                          </td>
                          <td className="px-4 py-2 text-gray-700 text-xs">
                            {h.new_status.replace(/_/g, " ")}
                          </td>
                          <td className="px-4 py-2 text-gray-500 text-xs">
                            {formatDateTime(h.changed_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: "extemporaneos", label: "Jurados extemporáneos" },
  { id: "vencimiento", label: "Vencimiento próximo" },
  { id: "carga", label: "Carga docente" },
  { id: "ficha", label: "Ficha estudiante" },
];

export default function AdminReportes() {
  const [activeTab, setActiveTab] = useState<Tab>("extemporaneos");

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-usc-navy">Reportes</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Informes del sistema de trabajos de grado
        </p>
      </div>

      {/* Pestañas */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? "border-usc-blue text-usc-blue"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      {activeTab === "extemporaneos" && <TabExtemporaneos />}
      {activeTab === "vencimiento" && <TabVencimiento />}
      {activeTab === "carga" && <TabCargaDocente />}
      {activeTab === "ficha" && <TabFichaEstudiante />}
    </div>
  );
}
