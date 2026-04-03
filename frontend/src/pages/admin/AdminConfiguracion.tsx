import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import api from "../../services/api";

// ── Constantes ─────────────────────────────────────────────────────────────

const LEVEL_LABELS: Record<string, string> = {
  tecnologico: "Tecnológico",
  profesional: "Profesional",
  especializacion: "Especialización",
  maestria_profundizacion: "Maestría prof.",
  maestria_investigacion: "Maestría inv.",
  doctorado: "Doctorado",
};
const ALL_LEVELS = Object.keys(LEVEL_LABELS);

const WINDOW_TYPE_LABELS: Record<string, string> = {
  inscripcion_idea: "Inscripción de idea",
  radicacion_anteproyecto: "Radicación anteproyecto",
  radicacion_producto_final: "Radicación producto final",
};

const PARAM_KEY = "usc_juror_alert_days";

// ── Tipos ──────────────────────────────────────────────────────────────────

interface AcademicProgram {
  id: string;
  name: string;
  level: string;
  faculty: string;
  is_active: boolean;
}

interface Modality {
  id: string;
  name: string;
  levels: string[];
  max_members: number;
  requires_sustentation: boolean;
  requires_ethics_approval: boolean;
  requires_business_plan_cert: boolean;
  is_active: boolean;
}

interface ModalityLimit {
  id: string;
  modality_id: string;
  level: string;
  max_members: number;
}

interface DateWindow {
  id: string;
  period: string;
  window_type: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function apiError(err: unknown): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })
    ?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  return "Ocurrió un error inesperado.";
}

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
        active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
      }`}
    >
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-usc-navy">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Cerrar modal"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── TAB 1: Programas académicos ────────────────────────────────────────────

function ProgramFormModal({
  prog,
  onClose,
  onSaved,
}: {
  prog: AcademicProgram | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(prog?.name ?? "");
  const [level, setLevel] = useState(prog?.level ?? "profesional");
  const [faculty, setFaculty] = useState(prog?.faculty ?? "");
  const [isActive, setIsActive] = useState(prog?.is_active ?? true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isEdit = prog !== null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isEdit) {
        await api.patch(`/academic-programs/${prog.id}`, {
          name,
          level,
          is_active: isActive,
        });
      } else {
        await api.post("/academic-programs", { name, level, faculty });
      }
      onSaved();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title={isEdit ? "Editar programa" : "Nuevo programa académico"}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nombre del programa
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-usc-blue"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nivel académico
          </label>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-usc-blue"
          >
            {ALL_LEVELS.map((l) => (
              <option key={l} value={l}>
                {LEVEL_LABELS[l]}
              </option>
            ))}
          </select>
        </div>
        {!isEdit && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Facultad
            </label>
            <input
              type="text"
              value={faculty}
              onChange={(e) => setFaculty(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-usc-blue"
              placeholder="Ej. Ingeniería"
            />
          </div>
        )}
        {isEdit && (
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded"
            />
            Activo
          </label>
        )}
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm bg-usc-blue text-white rounded-lg hover:bg-usc-navy disabled:opacity-60"
          >
            {loading ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ProgramasTab() {
  const [items, setItems] = useState<AcademicProgram[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [modalProg, setModalProg] = useState<AcademicProgram | "new" | null>(
    null
  );

  const fetch = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await api.get<AcademicProgram[]>("/academic-programs", { signal });
      setItems(res.data);
    } catch (err) {
      if (axios.isCancel(err)) return;
      setFetchError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch(controller.signal);
    return () => controller.abort();
  }, [fetch]);

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setModalProg("new")}
          className="bg-usc-blue text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-usc-navy transition-colors"
        >
          + Nuevo programa
        </button>
      </div>
      {fetchError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
          {fetchError}
        </p>
      )}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <p className="p-5 text-sm text-gray-500">Cargando...</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left">
                <th className="px-5 py-3 font-semibold text-gray-600">Nombre</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Nivel</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Facultad</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Estado</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-800">{p.name}</td>
                  <td className="px-5 py-3 text-gray-600">
                    {LEVEL_LABELS[p.level] ?? p.level}
                  </td>
                  <td className="px-5 py-3 text-gray-600">{p.faculty}</td>
                  <td className="px-5 py-3">
                    <ActiveBadge active={p.is_active} />
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => setModalProg(p)}
                      className="text-usc-blue hover:underline text-xs font-medium"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalProg !== null && (
        <ProgramFormModal
          prog={modalProg === "new" ? null : modalProg}
          onClose={() => setModalProg(null)}
          onSaved={() => {
            setModalProg(null);
            fetch(); // sin signal: el usuario sigue en el tab
          }}
        />
      )}
    </div>
  );
}

// ── TAB 2: Modalidades ─────────────────────────────────────────────────────

function ModalityFormModal({
  modality,
  onClose,
  onSaved,
}: {
  modality: Modality | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(modality?.name ?? "");
  const [levels, setLevels] = useState<string[]>(modality?.levels ?? []);
  const [maxMembers, setMaxMembers] = useState(modality?.max_members ?? 2);
  const [reqSust, setReqSust] = useState(modality?.requires_sustentation ?? true);
  const [reqEthics, setReqEthics] = useState(
    modality?.requires_ethics_approval ?? false
  );
  const [reqBusiness, setReqBusiness] = useState(
    modality?.requires_business_plan_cert ?? false
  );
  const [isActive, setIsActive] = useState(modality?.is_active ?? true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isEdit = modality !== null;

  function toggleLevel(l: string) {
    setLevels((prev) =>
      prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!isEdit && levels.length === 0) {
      setError("Selecciona al menos un nivel académico.");
      return;
    }
    setLoading(true);
    try {
      if (isEdit) {
        await api.patch(`/modalities/${modality.id}`, {
          name,
          max_members: maxMembers,
          is_active: isActive,
        });
      } else {
        await api.post("/modalities", {
          name,
          levels,
          max_members: maxMembers,
          requires_sustentation: reqSust,
          requires_ethics_approval: reqEthics,
          requires_business_plan_cert: reqBusiness,
        });
      }
      onSaved();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title={isEdit ? "Editar modalidad" : "Nueva modalidad"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nombre
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-usc-blue"
          />
        </div>

        {!isEdit && (
          <div>
            <p className="block text-sm font-medium text-gray-700 mb-2">
              Niveles académicos
            </p>
            <div className="grid grid-cols-2 gap-1">
              {ALL_LEVELS.map((l) => (
                <label key={l} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={levels.includes(l)}
                    onChange={() => toggleLevel(l)}
                    className="rounded"
                  />
                  {LEVEL_LABELS[l]}
                </label>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Máximo de integrantes por defecto
          </label>
          <input
            type="number"
            min={1}
            value={maxMembers}
            onChange={(e) => setMaxMembers(Number(e.target.value))}
            className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-usc-blue"
          />
        </div>

        {!isEdit && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Requisitos</p>
            {[
              {
                label: "Requiere sustentación",
                val: reqSust,
                set: setReqSust,
              },
              {
                label: "Requiere aval de ética",
                val: reqEthics,
                set: setReqEthics,
              },
              {
                label: "Requiere certificación de plan de negocios",
                val: reqBusiness,
                set: setReqBusiness,
              },
            ].map(({ label, val, set }) => (
              <label key={label} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={val}
                  onChange={(e) => set(e.target.checked)}
                  className="rounded"
                />
                {label}
              </label>
            ))}
          </div>
        )}

        {isEdit && (
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded"
            />
            Activo
          </label>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm bg-usc-blue text-white rounded-lg hover:bg-usc-navy disabled:opacity-60"
          >
            {loading ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ModalityLimitsRow({ modality }: { modality: Modality }) {
  const [limits, setLimits] = useState<ModalityLimit[]>([]);
  const [loading, setLoading] = useState(false);
  const [editLimit, setEditLimit] = useState<{
    level: string;
    current: number | null;
  } | null>(null);
  const [limitValue, setLimitValue] = useState(1);
  const [savingLevel, setSavingLevel] = useState<string | null>(null);

  const fetchLimits = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const res = await api.get<ModalityLimit[]>(
        `/modalities/${modality.id}/limits`,
        { signal }
      );
      setLimits(res.data);
    } catch (err) {
      if (axios.isCancel(err)) return;
      // error silencioso: la fila simplemente no mostrará límites
    } finally {
      setLoading(false);
    }
  }, [modality.id]);

  useEffect(() => {
    const controller = new AbortController();
    fetchLimits(controller.signal);
    return () => controller.abort();
  }, [fetchLimits]);

  async function handleUpsert(level: string, value: number) {
    setSavingLevel(level);
    try {
      await api.put(`/modalities/${modality.id}/limits/${level}`, {
        max_members: value,
      });
      setEditLimit(null);
      fetchLimits();
    } finally {
      setSavingLevel(null);
    }
  }

  async function handleDelete(level: string) {
    setSavingLevel(level);
    try {
      await api.delete(`/modalities/${modality.id}/limits/${level}`);
      fetchLimits();
    } finally {
      setSavingLevel(null);
    }
  }

  const limitMap = Object.fromEntries(limits.map((l) => [l.level, l.max_members]));

  return (
    <tr>
      <td colSpan={6} className="bg-gray-50 px-8 py-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Límites por nivel (sobreescribe el máximo por defecto)
        </p>
        {loading ? (
          <p className="text-sm text-gray-400">Cargando...</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="pb-2 font-medium w-64">Nivel</th>
                <th className="pb-2 font-medium">Máx. integrantes</th>
                <th className="pb-2 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {modality.levels.map((lvl) => {
                const current = limitMap[lvl];
                const isEditing = editLimit?.level === lvl;
                return (
                  <tr key={lvl}>
                    <td className="py-2 text-gray-700">
                      {LEVEL_LABELS[lvl] ?? lvl}
                    </td>
                    <td className="py-2">
                      {isEditing ? (
                        <input
                          type="number"
                          min={1}
                          value={limitValue}
                          onChange={(e) => setLimitValue(Number(e.target.value))}
                          className="w-20 border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-usc-blue"
                          autoFocus
                        />
                      ) : current !== undefined ? (
                        <span className="font-medium text-gray-800">{current}</span>
                      ) : (
                        <span className="text-gray-400 italic">
                          Por defecto ({modality.max_members})
                        </span>
                      )}
                    </td>
                    <td className="py-2">
                      <div className="flex gap-3">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => handleUpsert(lvl, limitValue)}
                              disabled={savingLevel === lvl}
                              className="text-xs text-green-600 hover:underline font-medium disabled:opacity-50"
                            >
                              Guardar
                            </button>
                            <button
                              onClick={() => setEditLimit(null)}
                              className="text-xs text-gray-500 hover:underline"
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                setEditLimit({ level: lvl, current: current ?? null });
                                setLimitValue(current ?? modality.max_members);
                              }}
                              className="text-xs text-usc-blue hover:underline font-medium"
                            >
                              {current !== undefined ? "Editar" : "Establecer"}
                            </button>
                            {current !== undefined && (
                              <button
                                onClick={() => handleDelete(lvl)}
                                disabled={savingLevel === lvl}
                                className="text-xs text-red-500 hover:underline disabled:opacity-50"
                              >
                                Eliminar
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </td>
    </tr>
  );
}

function ModalidadesTab() {
  const [items, setItems] = useState<Modality[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [modalMod, setModalMod] = useState<Modality | "new" | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetch = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await api.get<Modality[]>("/modalities", { signal });
      setItems(res.data);
    } catch (err) {
      if (axios.isCancel(err)) return;
      setFetchError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch(controller.signal);
    return () => controller.abort();
  }, [fetch]);

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setModalMod("new")}
          className="bg-usc-blue text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-usc-navy transition-colors"
        >
          + Nueva modalidad
        </button>
      </div>
      {fetchError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
          {fetchError}
        </p>
      )}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <p className="p-5 text-sm text-gray-500">Cargando...</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left">
                <th className="px-5 py-3 font-semibold text-gray-600">Nombre</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Niveles</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Máx.</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Sustentación</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Estado</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((m) => (
                <>
                  <tr
                    key={m.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() =>
                      setExpandedId((prev) => (prev === m.id ? null : m.id))
                    }
                  >
                    <td className="px-5 py-3 font-medium text-gray-800 flex items-center gap-2">
                      <span
                        className={`text-xs transition-transform ${
                          expandedId === m.id ? "rotate-90" : ""
                        }`}
                      >
                        ▶
                      </span>
                      {m.name}
                    </td>
                    <td className="px-5 py-3 text-gray-600 text-xs">
                      {m.levels.map((l) => LEVEL_LABELS[l] ?? l).join(", ")}
                    </td>
                    <td className="px-5 py-3 text-gray-600">{m.max_members}</td>
                    <td className="px-5 py-3 text-gray-600">
                      {m.requires_sustentation ? "Sí" : "No"}
                    </td>
                    <td className="px-5 py-3">
                      <ActiveBadge active={m.is_active} />
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setModalMod(m);
                        }}
                        className="text-usc-blue hover:underline text-xs font-medium"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                  {expandedId === m.id && <ModalityLimitsRow modality={m} />}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalMod !== null && (
        <ModalityFormModal
          modality={modalMod === "new" ? null : modalMod}
          onClose={() => setModalMod(null)}
          onSaved={() => {
            setModalMod(null);
            fetch();
          }}
        />
      )}
    </div>
  );
}

// ── TAB 3: Ventanas de fechas ──────────────────────────────────────────────

function VentanaFormModal({
  ventana,
  onClose,
  onSaved,
}: {
  ventana: DateWindow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [period, setPeriod] = useState(ventana?.period ?? "");
  const [windowType, setWindowType] = useState(
    ventana?.window_type ?? "inscripcion_idea"
  );
  const [startDate, setStartDate] = useState(ventana?.start_date ?? "");
  const [endDate, setEndDate] = useState(ventana?.end_date ?? "");
  const [isActive, setIsActive] = useState(ventana?.is_active ?? true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isEdit = ventana !== null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isEdit) {
        await api.patch(`/date-windows/${ventana.id}`, {
          period,
          window_type: windowType,
          start_date: startDate,
          end_date: endDate,
          is_active: isActive,
        });
      } else {
        await api.post("/date-windows", {
          period,
          window_type: windowType,
          start_date: startDate,
          end_date: endDate,
          is_active: isActive,
        });
      }
      onSaved();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title={isEdit ? "Editar ventana de fechas" : "Nueva ventana de fechas"}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Periodo académico
            </label>
            <input
              type="text"
              required
              placeholder="Ej. 2026-1"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-usc-blue"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de ventana
            </label>
            <select
              value={windowType}
              onChange={(e) => setWindowType(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-usc-blue"
            >
              {Object.entries(WINDOW_TYPE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha de inicio
            </label>
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-usc-blue"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha de cierre
            </label>
            <input
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-usc-blue"
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="rounded"
          />
          Ventana activa
        </label>
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm bg-usc-blue text-white rounded-lg hover:bg-usc-navy disabled:opacity-60"
          >
            {loading ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function VentanasTab() {
  const [items, setItems] = useState<DateWindow[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [modal, setModal] = useState<DateWindow | "new" | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetch = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await api.get<DateWindow[]>("/date-windows", { signal });
      setItems(res.data);
    } catch (err) {
      if (axios.isCancel(err)) return;
      setFetchError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch(controller.signal);
    return () => controller.abort();
  }, [fetch]);

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta ventana de fechas?")) return;
    setDeleteError(null);
    setDeleting(id);
    try {
      await api.delete(`/date-windows/${id}`);
      fetch();
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        setDeleteError(
          "No se puede eliminar: esta ventana ya tiene radicaciones asociadas."
        );
      } else {
        setDeleteError(apiError(err));
      }
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setModal("new")}
          className="bg-usc-blue text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-usc-navy transition-colors"
        >
          + Nueva ventana
        </button>
      </div>

      {fetchError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
          {fetchError}
        </p>
      )}
      {deleteError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
          {deleteError}
        </p>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <p className="p-5 text-sm text-gray-500">Cargando...</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left">
                <th className="px-5 py-3 font-semibold text-gray-600">Tipo</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Periodo</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Inicio</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Cierre</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Estado</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((v) => (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-800">
                    {WINDOW_TYPE_LABELS[v.window_type] ?? v.window_type}
                  </td>
                  <td className="px-5 py-3 text-gray-600">{v.period}</td>
                  <td className="px-5 py-3 text-gray-600">{v.start_date}</td>
                  <td className="px-5 py-3 text-gray-600">{v.end_date}</td>
                  <td className="px-5 py-3">
                    <ActiveBadge active={v.is_active} />
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-3">
                      <button
                        onClick={() => setModal(v)}
                        className="text-usc-blue hover:underline text-xs font-medium"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(v.id)}
                        disabled={deleting === v.id}
                        className="text-red-500 hover:underline text-xs disabled:opacity-50"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal !== null && (
        <VentanaFormModal
          ventana={modal === "new" ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            fetch();
          }}
        />
      )}
    </div>
  );
}

// ── TAB 4: Parámetros ──────────────────────────────────────────────────────

function ParametrosTab() {
  const [days, setDays] = useState<number>(
    parseInt(localStorage.getItem(PARAM_KEY) ?? "3", 10)
  );
  const [saved, setSaved] = useState(false);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    localStorage.setItem(PARAM_KEY, String(days));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="max-w-sm">
      <p className="text-sm text-gray-500 mb-5">
        Estos parámetros controlan el comportamiento de las alertas automáticas
        del sistema.
      </p>
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Días hábiles de alerta antes del vencimiento de jurado
          </label>
          <p className="text-xs text-gray-400 mb-2">
            El sistema alertará cuando queden N días hábiles para que venza el
            plazo de evaluación de un jurado.
          </p>
          <input
            type="number"
            min={1}
            max={30}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-usc-blue"
          />
          <span className="ml-2 text-sm text-gray-500">días</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="px-4 py-2 text-sm bg-usc-blue text-white rounded-lg hover:bg-usc-navy transition-colors"
          >
            Guardar parámetros
          </button>
          {saved && (
            <span className="text-sm text-green-600 font-medium">
              ¡Guardado!
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────

type Tab = "programas" | "modalidades" | "ventanas" | "parametros";

const TABS: { id: Tab; label: string }[] = [
  { id: "programas", label: "Programas académicos" },
  { id: "modalidades", label: "Modalidades" },
  { id: "ventanas", label: "Ventanas de fechas" },
  { id: "parametros", label: "Parámetros" },
];

export default function AdminConfiguracion() {
  const [activeTab, setActiveTab] = useState<Tab>("programas");

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-usc-navy mb-6">
        Configuración del sistema
      </h1>

      {/* Pestañas */}
      <div className="flex border-b border-gray-200 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={[
              "px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px",
              activeTab === tab.id
                ? "border-usc-blue text-usc-blue"
                : "border-transparent text-gray-500 hover:text-gray-800",
            ].join(" ")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      {activeTab === "programas" && <ProgramasTab />}
      {activeTab === "modalidades" && <ModalidadesTab />}
      {activeTab === "ventanas" && <VentanasTab />}
      {activeTab === "parametros" && <ParametrosTab />}
    </div>
  );
}
