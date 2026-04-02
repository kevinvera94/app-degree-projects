import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import api from "../../services/api";

// ── Tipos ──────────────────────────────────────────────────────────────────

interface Modality {
  id: string;
  name: string;
  max_members: number;
  is_active: boolean;
}

interface AcademicProgram {
  id: string;
  name: string;
  level: string;
  is_active: boolean;
}

interface DateWindow {
  window_type: string;
  is_active: boolean;
  start_date: string;
  end_date: string;
}

interface StudentResult {
  id: string;
  full_name: string;
  email: string;
}

// ── Constantes ─────────────────────────────────────────────────────────────

const RESEARCH_LINES = [
  "Logística, operaciones, productividad y gestión de proyectos",
  "Instrumentación, automatización y sistemas inteligentes",
  "Gestión y control de la contaminación ambiental",
  "Arquitectura de Tecnología Informática",
  "Computación Ubicua, Urbana y Móvil",
  "Desarrollo de Sistemas Informáticos",
  "Redes Inalámbricas para la Inclusión Digital y el Desarrollo Económico",
];

const RESEARCH_GROUPS = [
  { value: "GIEIAM", label: "GIEIAM" },
  { value: "COMBA_ID", label: "COMBA I+D" },
];

const MAX_TITLE_LENGTH = 100;

function hasActiveWindow(windows: DateWindow[]): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return windows.some(
    (w) =>
      w.window_type === "inscripcion_idea" &&
      w.is_active &&
      w.start_date <= today &&
      w.end_date >= today,
  );
}

function nextOpeningDate(windows: DateWindow[]): string | null {
  const today = new Date().toISOString().slice(0, 10);
  const future = windows
    .filter((w) => w.window_type === "inscripcion_idea" && w.start_date > today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  return future[0]?.start_date ?? null;
}

function apiError(err: unknown): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data
    ?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d: { msg?: string }) => d.msg).join("; ");
  return "Ocurrió un error inesperado.";
}

// ── Componente ─────────────────────────────────────────────────────────────

export default function EstudianteInscribirIdea() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Datos de catálogos
  const [modalities, setModalities] = useState<Modality[]>([]);
  const [programs, setPrograms] = useState<AcademicProgram[]>([]);
  const [dateWindows, setDateWindows] = useState<DateWindow[]>([]);
  const [loadingCatalogs, setLoadingCatalogs] = useState(true);
  const [catalogError, setCatalogError] = useState("");

  // Campos del formulario
  const [title, setTitle] = useState("");
  const [modalityId, setModalityId] = useState("");
  const [programId, setProgramId] = useState("");
  const [researchLine, setResearchLine] = useState("");
  const [researchGroup, setResearchGroup] = useState("");
  const [suggestedDirector, setSuggestedDirector] = useState("");
  const [prerequisiteDecl, setPrerequisiteDecl] = useState(false);

  // Integrantes
  const [members, setMembers] = useState<StudentResult[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StudentResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Envío
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // ── Cargar catálogos ──────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      api.get<Modality[]>("/modalities"),
      api.get<AcademicProgram[]>("/academic-programs"),
      api.get<DateWindow[]>("/date-windows"),
    ])
      .then(([modRes, progRes, winRes]) => {
        setModalities(modRes.data.filter((m) => m.is_active));
        setPrograms(progRes.data.filter((p) => p.is_active));
        setDateWindows(winRes.data);
      })
      .catch(() => setCatalogError("No se pudieron cargar los datos. Recarga la página."))
      .finally(() => setLoadingCatalogs(false));
  }, []);

  // Agregar el estudiante actual como primer integrante cuando se carguen los datos
  useEffect(() => {
    if (!user || members.length > 0) return;
    setMembers([{ id: user.id, full_name: user.full_name, email: user.email }]);
  }, [user, members.length]);

  // ── Búsqueda de integrantes (debounce 400ms) ───────────────────────────────
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await api.get<StudentResult[]>("/users/search-students", {
          params: { q: searchQuery.trim() },
        });
        // Excluir integrantes ya agregados
        setSearchResults(data.filter((s) => !members.some((m) => m.id === s.id)));
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchQuery, members]);

  // ── Derivados ─────────────────────────────────────────────────────────────
  const selectedModality = modalities.find((m) => m.id === modalityId);
  const maxMembers = selectedModality?.max_members ?? 0;
  const windowActive = hasActiveWindow(dateWindows);
  const nextDate = nextOpeningDate(dateWindows);

  function addMember(student: StudentResult) {
    if (!selectedModality) return;
    if (members.length >= maxMembers) return;
    if (members.some((m) => m.id === student.id)) return;
    setMembers((prev) => [...prev, student]);
    setSearchQuery("");
    setSearchResults([]);
  }

  function removeMember(id: string) {
    if (user && id === user.id) return; // No puede quitarse a sí mismo
    setMembers((prev) => prev.filter((m) => m.id !== id));
  }

  // ── Validación ─────────────────────────────────────────────────────────────
  function validate(): string | null {
    if (!title.trim()) return "El nombre del trabajo es obligatorio.";
    if (title.length > MAX_TITLE_LENGTH) return `El nombre no puede superar ${MAX_TITLE_LENGTH} caracteres.`;
    if (!modalityId) return "Selecciona una modalidad.";
    if (!programId) return "Selecciona un programa académico.";
    if (!researchLine) return "Selecciona una línea de profundización.";
    if (!researchGroup) return "Selecciona un grupo de investigación.";
    if (members.length < 1) return "Debe haber al menos un integrante.";
    if (maxMembers > 0 && members.length > maxMembers)
      return `Esta modalidad permite máximo ${maxMembers} integrante${maxMembers === 1 ? "" : "s"}.`;
    if (!prerequisiteDecl) return "Debes declarar que cumples los requisitos previos.";
    return null;
  }

  // ── Envío ──────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");

    const validationError = validate();
    if (validationError) {
      setSubmitError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/projects", {
        title: title.trim(),
        modality_id: modalityId,
        academic_program_id: programId,
        research_line: researchLine,
        research_group: researchGroup,
        suggested_director: suggestedDirector.trim() || undefined,
        member_ids: members.map((m) => m.id),
        prerequisite_declaration: prerequisiteDecl,
      });
      navigate("/estudiante/dashboard", {
        state: { successMessage: "Idea inscrita exitosamente." },
      });
    } catch (err) {
      setSubmitError(apiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  // ── Renders ────────────────────────────────────────────────────────────────

  if (loadingCatalogs) {
    return (
      <div className="p-8 space-y-4">
        <div className="h-7 w-60 bg-gray-200 animate-pulse rounded" />
        <div className="h-64 bg-gray-100 animate-pulse rounded-xl" />
      </div>
    );
  }

  if (catalogError) {
    return (
      <div className="p-8">
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {catalogError}
        </p>
      </div>
    );
  }

  // Ventana cerrada
  if (!windowActive) {
    return (
      <div className="p-8 max-w-lg">
        <h1 className="text-2xl font-bold text-usc-navy mb-6">Inscribir idea</h1>
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
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Ventana cerrada</h2>
          <p className="text-sm text-gray-500">
            En este momento no hay una ventana activa para inscripción de ideas.
          </p>
          {nextDate && (
            <p className="text-sm text-gray-500 mt-2">
              Próxima apertura:{" "}
              <span className="font-semibold text-usc-navy">
                {new Date(nextDate + "T00:00:00").toLocaleDateString("es-CO", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-usc-navy mb-6">Inscribir idea</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── Información del trabajo ──────────────────────────────────── */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
          <h2 className="text-base font-semibold text-gray-800">Información del trabajo</h2>

          {/* Nombre del trabajo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del trabajo{" "}
              <span className="text-gray-400 font-normal">(máx. {MAX_TITLE_LENGTH} caracteres)</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE_LENGTH))}
              placeholder="Ej. Sistema de gestión de inventarios para PyMEs"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-usc-blue"
            />
            <p className={`text-xs mt-1 text-right ${title.length >= MAX_TITLE_LENGTH ? "text-red-500 font-semibold" : "text-gray-400"}`}>
              {title.length}/{MAX_TITLE_LENGTH}
            </p>
          </div>

          {/* Modalidad */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Modalidad</label>
            <select
              value={modalityId}
              onChange={(e) => { setModalityId(e.target.value); setMembers(members.slice(0, 1)); }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-usc-blue bg-white"
            >
              <option value="">Seleccionar modalidad</option>
              {modalities.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Programa académico */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Programa académico
            </label>
            <select
              value={programId}
              onChange={(e) => setProgramId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-usc-blue bg-white"
            >
              <option value="">Seleccionar programa</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Línea de profundización */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Línea de profundización
            </label>
            <select
              value={researchLine}
              onChange={(e) => setResearchLine(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-usc-blue bg-white"
            >
              <option value="">Seleccionar línea</option>
              {RESEARCH_LINES.map((line) => (
                <option key={line} value={line}>
                  {line}
                </option>
              ))}
            </select>
          </div>

          {/* Grupo de investigación */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Grupo de investigación
            </label>
            <div className="flex gap-4">
              {RESEARCH_GROUPS.map((g) => (
                <label key={g.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="researchGroup"
                    value={g.value}
                    checked={researchGroup === g.value}
                    onChange={() => setResearchGroup(g.value)}
                    className="accent-usc-blue"
                  />
                  <span className="text-sm text-gray-700">{g.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Director sugerido (opcional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Director sugerido{" "}
              <span className="text-gray-400 font-normal">(opcional — texto libre)</span>
            </label>
            <input
              type="text"
              value={suggestedDirector}
              onChange={(e) => setSuggestedDirector(e.target.value.slice(0, 150))}
              placeholder="Ej. Dr. Carlos Rodríguez"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-usc-blue"
            />
            <p className="text-xs text-gray-400 mt-1">
              Solo informativo. El Administrador asignará el director formal.
            </p>
          </div>
        </section>

        {/* ── Integrantes ───────────────────────────────────────────────── */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-800">Integrantes</h2>
            {selectedModality && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                Máx. {maxMembers} para esta modalidad
              </span>
            )}
          </div>

          {!selectedModality && (
            <p className="text-sm text-gray-400 italic">
              Selecciona una modalidad para habilitar el buscador.
            </p>
          )}

          {selectedModality && (
            <>
              {/* Lista actual */}
              <ul className="space-y-2">
                {members.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"
                  >
                    <div>
                      <span className="text-sm font-medium text-gray-800">{m.full_name}</span>
                      <span className="text-xs text-gray-500 ml-2">{m.email}</span>
                    </div>
                    {user && m.id !== user.id && (
                      <button
                        type="button"
                        onClick={() => removeMember(m.id)}
                        className="text-xs text-red-500 hover:text-red-700 ml-3 shrink-0"
                      >
                        Quitar
                      </button>
                    )}
                    {user && m.id === user.id && (
                      <span className="text-xs text-usc-blue shrink-0">Tú</span>
                    )}
                  </li>
                ))}
              </ul>

              {/* Buscador */}
              {members.length < maxMembers && (
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar estudiante por nombre o email…"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-usc-blue"
                  />
                  {searching && (
                    <span className="absolute right-3 top-2.5 text-xs text-gray-400">
                      Buscando…
                    </span>
                  )}
                  {searchResults.length > 0 && (
                    <ul className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden">
                      {searchResults.map((s) => (
                        <li key={s.id}>
                          <button
                            type="button"
                            onClick={() => addMember(s)}
                            className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm"
                          >
                            <span className="font-medium text-gray-800">{s.full_name}</span>
                            <span className="text-gray-400 ml-2">{s.email}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {!searching && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
                    <p className="mt-1 text-xs text-gray-400">
                      No se encontraron estudiantes activos con ese criterio.
                    </p>
                  )}
                </div>
              )}

              {members.length >= maxMembers && (
                <p className="text-xs text-gray-400 italic">
                  Se alcanzó el límite de integrantes para esta modalidad.
                </p>
              )}
            </>
          )}
        </section>

        {/* ── Declaración de requisitos ─────────────────────────────────── */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={prerequisiteDecl}
              onChange={(e) => setPrerequisiteDecl(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-usc-blue shrink-0"
            />
            <span className="text-sm text-gray-700 leading-relaxed">
              Declaro que cumplo los requisitos previos para inscribir un trabajo de grado: tener
              aprobado el{" "}
              <strong>70% de los créditos del plan de formación</strong> (pregrado) o el{" "}
              <strong>50% del plan de estudios</strong> (posgrado), y estar matriculado
              académicamente.
            </span>
          </label>
        </section>

        {/* ── Error y botón de envío ────────────────────────────────────── */}
        {submitError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {submitError}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="bg-usc-blue text-white text-sm font-semibold px-6 py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {submitting ? "Inscribiendo…" : "Inscribir idea"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/estudiante/dashboard")}
            className="text-sm text-gray-600 hover:text-gray-900 px-4 py-2.5"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
