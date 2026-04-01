import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../services/api";

// ── Tipos ──────────────────────────────────────────────────────────────────

interface Member {
  id: string;
  student_id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  joined_at: string;
}

interface Director {
  id: string;
  docente_id: string;
  full_name: string;
  order: number;
  is_active: boolean;
  assigned_at: string;
}

interface Juror {
  id?: string;
  docente_id?: string;
  full_name?: string;
  juror_number: number;
  stage: string;
  is_active: boolean;
  assigned_at?: string;
}

interface Submission {
  id: string;
  stage: string;
  submitted_at: string;
  status: string;
  revision_number: number;
  is_extemporaneous: boolean;
}

interface Evaluation {
  id: string;
  juror_id?: string;
  juror_name?: string;
  juror_number: number;
  stage: string;
  revision_number: number;
  score: number | null;
  observations: string | null;
  submitted_at: string | null;
  due_date?: string;
  is_extemporaneous?: boolean;
}

interface HistoryEvent {
  type: "status_change" | "document_uploaded" | "evaluation_submitted";
  // status_change
  previous_status?: string;
  new_status?: string;
  changed_by_name?: string;
  reason?: string;
  changed_at?: string;
  // document_uploaded
  attachment_type?: string;
  file_name?: string;
  stage?: string;
  uploaded_by_name?: string;
  uploaded_at?: string;
  // evaluation_submitted
  juror_number?: number;
  score?: number;
  submitted_at?: string;
  is_extemporaneous?: boolean;
  juror_name?: string;
}

interface ProjectDetail {
  id: string;
  title: string;
  modality_id: string;
  academic_program_id: string;
  research_group: string;
  research_line: string;
  suggested_director: string | null;
  period: string;
  status: string;
  has_company_link: boolean;
  plagiarism_suspended: boolean;
  created_at: string;
  updated_at: string;
  members: Member[];
  directors: Director[];
  jurors: Juror[];
  submissions: Submission[];
  suggested_jurors: { juror_number: number; docente_id: string; full_name: string }[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; classes: string }> = {
  pendiente_evaluacion_idea: { label: "Pendiente evaluación idea", classes: "bg-blue-100 text-blue-700" },
  idea_aprobada: { label: "Idea aprobada", classes: "bg-blue-100 text-blue-700" },
  idea_rechazada: { label: "Idea rechazada", classes: "bg-red-100 text-red-700" },
  anteproyecto_pendiente_evaluacion: { label: "Anteproyecto — pendiente evaluación", classes: "bg-blue-100 text-blue-700" },
  anteproyecto_reprobado: { label: "Anteproyecto reprobado", classes: "bg-red-100 text-red-700" },
  correcciones_anteproyecto_solicitadas: { label: "Correcciones anteproyecto", classes: "bg-yellow-100 text-yellow-700" },
  anteproyecto_corregido_entregado: { label: "Correcciones entregadas", classes: "bg-blue-100 text-blue-700" },
  en_desarrollo: { label: "En desarrollo", classes: "bg-gray-100 text-gray-600" },
  producto_final_entregado: { label: "Producto final entregado", classes: "bg-blue-100 text-blue-700" },
  en_revision_jurados_producto_final: { label: "En revisión jurados (PF)", classes: "bg-blue-100 text-blue-700" },
  correcciones_producto_final_solicitadas: { label: "Correcciones producto final", classes: "bg-yellow-100 text-yellow-700" },
  producto_final_corregido_entregado: { label: "Correcciones PF entregadas", classes: "bg-blue-100 text-blue-700" },
  producto_final_reprobado: { label: "PF reprobado", classes: "bg-red-100 text-red-700" },
  aprobado_para_sustentacion: { label: "Aprobado para sustentación", classes: "bg-green-100 text-green-700" },
  sustentacion_programada: { label: "Sustentación programada", classes: "bg-green-100 text-green-700" },
  trabajo_aprobado: { label: "Trabajo aprobado", classes: "bg-green-100 text-green-700" },
  reprobado_en_sustentacion: { label: "Reprobado en sustentación", classes: "bg-red-100 text-red-700" },
  acta_generada: { label: "Acta generada", classes: "bg-green-100 text-green-700" },
  suspendido_por_plagio: { label: "Suspendido por plagio", classes: "bg-red-100 text-red-700" },
  cancelado: { label: "Cancelado", classes: "bg-gray-100 text-gray-500" },
};

const STAGE_LABELS: Record<string, string> = {
  anteproyecto: "Anteproyecto",
  producto_final: "Producto final",
  sustentacion: "Sustentación",
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, classes: "bg-gray-100 text-gray-500" };
  return (
    <span className={`text-sm font-semibold px-3 py-1 rounded-full ${meta.classes}`}>
      {meta.label}
    </span>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <h2 className="text-base font-semibold text-gray-800 mb-4">{title}</h2>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-4 text-sm py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-gray-500 w-44 shrink-0">{label}</span>
      <span className="text-gray-800 font-medium">{value}</span>
    </div>
  );
}

function apiError(err: unknown): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  return "Ocurrió un error inesperado.";
}

// ── Componente de ventana extemporánea ─────────────────────────────────────

function VentanaExtForm({
  projectId,
  onSuccess,
}: {
  projectId: string;
  onSuccess: () => void;
}) {
  const [windowType, setWindowType] = useState("radicacion_anteproyecto");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post(`/projects/${projectId}/extemporaneous-window`, {
        window_type: windowType,
        valid_until: validUntil,
        notes: notes || undefined,
      });
      onSuccess();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke() {
    if (!confirm("¿Revocar la ventana extemporánea activa?")) return;
    setError("");
    setLoading(true);
    try {
      await api.delete(`/projects/${projectId}/extemporaneous-window`);
      onSuccess();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleCreate} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
          <select
            value={windowType}
            onChange={(e) => setWindowType(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-usc-blue"
          >
            <option value="inscripcion_idea">Inscripción de idea</option>
            <option value="radicacion_anteproyecto">Radicación anteproyecto</option>
            <option value="radicacion_producto_final">Radicación producto final</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Válida hasta</label>
          <input
            type="date"
            required
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-usc-blue"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Notas (opcional)</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Motivo de la prórroga"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-usc-blue"
        />
      </div>
      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 text-sm bg-usc-blue text-white rounded-lg hover:bg-usc-navy transition-colors disabled:opacity-60"
        >
          {loading ? "Guardando..." : "Habilitar ventana"}
        </button>
        <button
          type="button"
          onClick={handleRevoke}
          disabled={loading}
          className="px-4 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-60"
        >
          Revocar ventana activa
        </button>
      </div>
    </form>
  );
}

// ── Historial de eventos ───────────────────────────────────────────────────

function HistoryEventRow({ event }: { event: HistoryEvent }) {
  if (event.type === "status_change") {
    return (
      <div className="flex gap-3 text-sm">
        <div className="w-1.5 h-1.5 rounded-full bg-usc-blue mt-2 shrink-0" />
        <div>
          <p className="text-gray-800">
            Estado cambió de{" "}
            <span className="font-medium">{STATUS_META[event.previous_status ?? ""]?.label ?? event.previous_status ?? "—"}</span>
            {" "}→{" "}
            <span className="font-medium">{STATUS_META[event.new_status ?? ""]?.label ?? event.new_status}</span>
          </p>
          {event.reason && (
            <p className="text-gray-500 text-xs mt-0.5">"{event.reason}"</p>
          )}
          <p className="text-gray-400 text-xs mt-0.5">
            {event.changed_by_name} · {event.changed_at?.slice(0, 10)}
          </p>
        </div>
      </div>
    );
  }
  if (event.type === "document_uploaded") {
    return (
      <div className="flex gap-3 text-sm">
        <div className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-2 shrink-0" />
        <div>
          <p className="text-gray-800">
            Documento subido:{" "}
            <span className="font-medium">{event.file_name}</span>
            {" "}({event.attachment_type} — {STAGE_LABELS[event.stage ?? ""] ?? event.stage})
          </p>
          <p className="text-gray-400 text-xs mt-0.5">
            {event.uploaded_by_name} · {event.uploaded_at?.slice(0, 10)}
          </p>
        </div>
      </div>
    );
  }
  if (event.type === "evaluation_submitted") {
    return (
      <div className="flex gap-3 text-sm">
        <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 shrink-0" />
        <div>
          <p className="text-gray-800">
            Calificación registrada — Jurado {event.juror_number}
            {event.juror_name && ` (${event.juror_name})`}:{" "}
            <span className="font-medium">{event.score?.toFixed(1)}</span>
            {" "}({STAGE_LABELS[event.stage ?? ""] ?? event.stage})
            {event.is_extemporaneous && (
              <span className="text-yellow-600 ml-1 text-xs font-medium">[Extemporánea]</span>
            )}
          </p>
          <p className="text-gray-400 text-xs mt-0.5">
            {event.submitted_at?.slice(0, 10)}
          </p>
        </div>
      </div>
    );
  }
  return null;
}

// ── Modal: Asignar Jurado 1 y 2 ───────────────────────────────────────────

function AssignJurorsModal({
  projectId,
  stage,
  suggestedJurors,
  onClose,
  onSuccess,
}: {
  projectId: string;
  stage: string;
  suggestedJurors: { juror_number: number; docente_id: string; full_name: string }[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const suggested1 = suggestedJurors.find((j) => j.juror_number === 1);
  const suggested2 = suggestedJurors.find((j) => j.juror_number === 2);

  const [docentes, setDocentes] = useState<Docente[]>([]);
  const [juror1, setJuror1] = useState(suggested1?.docente_id ?? "");
  const [juror2, setJuror2] = useState(suggested2?.docente_id ?? "");
  const [search1, setSearch1] = useState("");
  const [search2, setSearch2] = useState("");
  const [loadingDocentes, setLoadingDocentes] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const stageLabel = stage === "anteproyecto" ? "Anteproyecto" : "Producto final";
  const isProductoFinal = stage === "producto_final";

  useEffect(() => {
    api
      .get<{ items: Docente[] }>("/users", {
        params: { role: "docente", is_active: "true", size: 200 },
      })
      .then((res) => setDocentes(res.data.items))
      .finally(() => setLoadingDocentes(false));
  }, []);

  const filtered1 = docentes.filter(
    (d) =>
      d.id !== juror2 &&
      (search1 === "" || d.full_name.toLowerCase().includes(search1.toLowerCase()))
  );
  const filtered2 = docentes.filter(
    (d) =>
      d.id !== juror1 &&
      (search2 === "" || d.full_name.toLowerCase().includes(search2.toLowerCase()))
  );

  const changed1 = isProductoFinal && suggested1 && juror1 !== suggested1.docente_id;
  const changed2 = isProductoFinal && suggested2 && juror2 !== suggested2.docente_id;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!juror1 || !juror2) {
      setError("Debes seleccionar ambos jurados.");
      return;
    }
    if (juror1 === juror2) {
      setError("El Jurado 1 y el Jurado 2 deben ser distintos.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await api.post(`/projects/${projectId}/jurors`, {
        user_id: juror1,
        juror_number: 1,
        stage,
      });
      await api.post(`/projects/${projectId}/jurors`, {
        user_id: juror2,
        juror_number: 2,
        stage,
      });
      onSuccess();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }

  function DocenteSelect({
    label,
    value,
    onChange,
    search,
    onSearch,
    filtered,
    suggested,
    changed,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    search: string;
    onSearch: (v: string) => void;
    filtered: Docente[];
    suggested?: { docente_id: string; full_name: string };
    changed?: boolean;
  }) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label} <span className="text-red-500">*</span>
        </label>
        {suggested && (
          <p className="text-xs text-blue-600 mb-1">
            Sugerido: <strong>{suggested.full_name}</strong>
          </p>
        )}
        <input
          type="text"
          placeholder="Buscar por nombre..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="w-full border border-gray-200 rounded-t-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-usc-blue"
        />
        <select
          size={5}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border border-l-gray-200 border-r-gray-200 border-b-gray-200 rounded-b-lg px-1 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-usc-blue"
        >
          <option value="">— Seleccionar —</option>
          {filtered.map((d) => (
            <option key={d.id} value={d.id}>
              {d.full_name}
              {isProductoFinal && suggested?.docente_id === d.id ? " ★ Sugerido" : ""}
            </option>
          ))}
        </select>
        {changed && (
          <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-2 py-1 mt-1">
            Se registrará el cambio respecto al jurado del anteproyecto para trazabilidad.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-usc-navy mb-1">
          Asignar jurados — {stageLabel}
        </h2>
        <p className="text-sm text-gray-500 mb-5">
          Selecciona Jurado 1 y Jurado 2 para esta etapa.
        </p>

        {loadingDocentes ? (
          <p className="text-sm text-gray-400 py-4">Cargando docentes...</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <DocenteSelect
              label="Jurado 1"
              value={juror1}
              onChange={setJuror1}
              search={search1}
              onSearch={setSearch1}
              filtered={filtered1}
              suggested={suggested1}
              changed={changed1 || false}
            />
            <DocenteSelect
              label="Jurado 2"
              value={juror2}
              onChange={setJuror2}
              search={search2}
              onSearch={setSearch2}
              filtered={filtered2}
              suggested={suggested2}
              changed={changed2 || false}
            />

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
                {loading ? "Asignando..." : "Asignar jurados"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Modal: Asignar Jurado 3 ────────────────────────────────────────────────

function AssignJuror3Modal({
  projectId,
  stage,
  onClose,
  onSuccess,
}: {
  projectId: string;
  stage: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [docentes, setDocentes] = useState<Docente[]>([]);
  const [juror3, setJuror3] = useState("");
  const [search, setSearch] = useState("");
  const [loadingDocentes, setLoadingDocentes] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .get<{ items: Docente[] }>("/users", {
        params: { role: "docente", is_active: "true", size: 200 },
      })
      .then((res) => setDocentes(res.data.items))
      .finally(() => setLoadingDocentes(false));
  }, []);

  const filtered = docentes.filter(
    (d) => search === "" || d.full_name.toLowerCase().includes(search.toLowerCase())
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!juror3) {
      setError("Selecciona un docente para el Jurado 3.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await api.post(`/projects/${projectId}/jurors`, {
        user_id: juror3,
        juror_number: 3,
        stage,
      });
      onSuccess();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold text-usc-navy mb-1">Asignar Jurado 3</h2>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 mb-5">
          <p className="text-xs text-yellow-700 font-medium">
            Los jurados J1 y J2 presentaron decisiones divergentes (uno aprobó y el otro
            reprobó). El Jurado 3 actúa como desempate y solo puede <strong>aprobar</strong> o{" "}
            <strong>reprobar</strong> — no emite nota numérica.
          </p>
        </div>

        {loadingDocentes ? (
          <p className="text-sm text-gray-400 py-4">Cargando docentes...</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Jurado 3 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Buscar por nombre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full border border-gray-200 rounded-t-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-usc-blue"
              />
              <select
                size={5}
                value={juror3}
                onChange={(e) => setJuror3(e.target.value)}
                className="w-full border border-l-gray-200 border-r-gray-200 border-b-gray-200 rounded-b-lg px-1 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-usc-blue"
              >
                <option value="">— Seleccionar —</option>
                {filtered.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.full_name}
                  </option>
                ))}
              </select>
            </div>

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
                {loading ? "Asignando..." : "Asignar Jurado 3"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Modal: Aprobar idea ────────────────────────────────────────────────────

interface Docente {
  id: string;
  full_name: string;
  email: string;
}

function ApproveIdeaModal({
  projectId,
  onClose,
  onSuccess,
}: {
  projectId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [docentes, setDocentes] = useState<Docente[]>([]);
  const [director1, setDirector1] = useState("");
  const [director2, setDirector2] = useState("");
  const [loadingDocentes, setLoadingDocentes] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .get<{ items: Docente[] }>("/users", {
        params: { role: "docente", is_active: "true", size: 200 },
      })
      .then((res) => setDocentes(res.data.items))
      .finally(() => setLoadingDocentes(false));
  }, []);

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!director1) {
      setError("Selecciona al menos un director.");
      return;
    }
    if (director2 && director2 === director1) {
      setError("El director principal y el co-director deben ser distintos.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      // Asignar director(es) primero
      await api.post(`/projects/${projectId}/directors`, {
        user_id: director1,
        order: 1,
      });
      if (director2) {
        await api.post(`/projects/${projectId}/directors`, {
          user_id: director2,
          order: 2,
        });
      }
      // Luego cambiar estado
      await api.patch(`/projects/${projectId}/status`, { action: "aprobar" });
      onSuccess();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold text-usc-navy mb-1">Aprobar idea</h2>
        <p className="text-sm text-gray-500 mb-5">
          Selecciona el director principal (obligatorio) y opcionalmente un co-director.
        </p>

        {loadingDocentes ? (
          <p className="text-sm text-gray-400 py-4">Cargando docentes...</p>
        ) : (
          <form onSubmit={handleConfirm} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Director principal <span className="text-red-500">*</span>
              </label>
              <select
                value={director1}
                onChange={(e) => setDirector1(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-usc-blue"
              >
                <option value="">— Seleccionar docente —</option>
                {docentes.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Co-director{" "}
                <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <select
                value={director2}
                onChange={(e) => setDirector2(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-usc-blue"
              >
                <option value="">— Sin co-director —</option>
                {docentes
                  .filter((d) => d.id !== director1)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name}
                    </option>
                  ))}
              </select>
            </div>

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
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60"
              >
                {loading ? "Aprobando..." : "Confirmar aprobación"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Modal: Rechazar idea ───────────────────────────────────────────────────

function RejectIdeaModal({
  projectId,
  onClose,
  onSuccess,
}: {
  projectId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      setError("El motivo es obligatorio.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await api.patch(`/projects/${projectId}/status`, {
        action: "rechazar",
        reason: reason.trim(),
      });
      onSuccess();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold text-usc-navy mb-1">Rechazar idea</h2>
        <p className="text-sm text-gray-500 mb-5">
          El motivo será registrado en el historial y visible para el estudiante.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Motivo del rechazo <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe el motivo por el que se rechaza la idea..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-usc-blue resize-none"
            />
          </div>

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
              className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60"
            >
              {loading ? "Rechazando..." : "Confirmar rechazo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────

export default function AdminProyectoDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [modalityName, setModalityName] = useState("—");
  const [programName, setProgramName] = useState("—");

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Modales de acción
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [assignJurorsOpen, setAssignJurorsOpen] = useState(false);
  const [assignJ3Open, setAssignJ3Open] = useState(false);
  const [_scheduleOpen, setScheduleOpen] = useState(false);
  const [_actOpen, setActOpen] = useState(false);

  // Acciones simples
  const [actionError, setActionError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadError("");
    try {
      const [projRes, evalRes, histRes] = await Promise.all([
        api.get<ProjectDetail>(`/projects/${id}`),
        api.get<Evaluation[]>(`/projects/${id}/evaluations`),
        api.get<HistoryEvent[]>(`/projects/${id}/history`),
      ]);
      const proj = projRes.data;
      setProject(proj);
      setEvaluations(evalRes.data);
      setHistory(histRes.data);

      // Resolver nombres desde los catálogos
      const [modRes, progRes] = await Promise.all([
        api.get<{ id: string; name: string }[]>("/modalities"),
        api.get<{ id: string; name: string }[]>("/academic-programs"),
      ]);
      setModalityName(
        modRes.data.find((m) => m.id === proj.modality_id)?.name ?? "—"
      );
      setProgramName(
        progRes.data.find((p) => p.id === proj.academic_program_id)?.name ?? "—"
      );
    } catch {
      setLoadError("No se pudo cargar el proyecto.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleStatusAction(action: string, reason?: string) {
    if (!id) return;
    setActionError("");
    setActionLoading(true);
    try {
      await api.patch(`/projects/${id}/status`, { action, reason });
      await load();
    } catch (err) {
      setActionError(apiError(err));
    } finally {
      setActionLoading(false);
    }
  }

  async function confirmAndAct(action: string, confirmMsg: string, needsReason = false) {
    if (needsReason) {
      const reason = prompt("Ingresa el motivo (obligatorio):");
      if (!reason?.trim()) return;
      await handleStatusAction(action, reason.trim());
    } else {
      if (!confirm(confirmMsg)) return;
      await handleStatusAction(action);
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-gray-500 text-sm">Cargando proyecto...</p>
      </div>
    );
  }

  if (loadError || !project) {
    return (
      <div className="p-8">
        <p className="text-red-600 text-sm">{loadError || "Proyecto no encontrado."}</p>
        <button
          onClick={() => navigate("/admin/proyectos")}
          className="mt-4 text-sm text-usc-blue hover:underline"
        >
          ← Volver a proyectos
        </button>
      </div>
    );
  }

  const isClosed = ["acta_generada", "cancelado", "reprobado_en_sustentacion"].includes(
    project.status
  );

  // Detectar divergencia: J1 y J2 calificaron en la misma etapa y no hay J3
  const divergentStage = (() => {
    for (const stage of ["anteproyecto", "producto_final"]) {
      const stageEvals = evaluations.filter((e) => e.stage === stage && e.score !== null);
      const j1 = stageEvals.find((e) => e.juror_number === 1);
      const j2 = stageEvals.find((e) => e.juror_number === 2);
      if (!j1 || !j2) continue;
      const approved = (s: number) => s >= 3.0;
      if (approved(j1.score!) !== approved(j2.score!)) {
        const hasJ3 = project.jurors.some(
          (j) => j.juror_number === 3 && j.stage === stage && j.is_active
        );
        if (!hasJ3) return stage;
      }
    }
    return null;
  })();
  const needsJ3 = divergentStage !== null;

  return (
    <div className="p-8 space-y-6 max-w-5xl">
      {/* Cabecera */}
      <div>
        <button
          onClick={() => navigate("/admin/proyectos")}
          className="text-sm text-gray-500 hover:text-gray-800 mb-3 flex items-center gap-1"
        >
          ← Proyectos
        </button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-usc-navy leading-snug">
              {project.title}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <StatusBadge status={project.status} />
              <span className="text-sm text-gray-500">Periodo {project.period}</span>
              {project.plagiarism_suspended && (
                <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                  ⚠ Plagio
                </span>
              )}
            </div>
          </div>

          {/* Acciones contextuales */}
          {!isClosed && (
            <div className="flex flex-wrap gap-2 shrink-0">
              {project.status === "pendiente_evaluacion_idea" && (
                <>
                  <button
                    onClick={() => setApproveOpen(true)}
                    className="px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Aprobar idea
                  </button>
                  <button
                    onClick={() => setRejectOpen(true)}
                    className="px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Rechazar idea
                  </button>
                </>
              )}
              {(project.status === "anteproyecto_pendiente_evaluacion" ||
                project.status === "producto_final_entregado") && (
                <button
                  onClick={() => setAssignJurorsOpen(true)}
                  className="px-3 py-2 text-sm bg-usc-blue text-white rounded-lg hover:bg-usc-navy transition-colors"
                >
                  Asignar jurados
                </button>
              )}
              {needsJ3 && (
                <button
                  onClick={() => setAssignJ3Open(true)}
                  className="px-3 py-2 text-sm bg-usc-blue text-white rounded-lg hover:bg-usc-navy transition-colors"
                >
                  Asignar Jurado 3
                </button>
              )}
              {project.status === "aprobado_para_sustentacion" && (
                <button
                  onClick={() => setScheduleOpen(true)}
                  className="px-3 py-2 text-sm bg-usc-blue text-white rounded-lg hover:bg-usc-navy transition-colors"
                >
                  Programar sustentación
                </button>
              )}
              {project.status === "trabajo_aprobado" && (
                <button
                  onClick={() => setActOpen(true)}
                  className="px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Emitir acta
                </button>
              )}
              {!project.plagiarism_suspended && (
                <button
                  onClick={() => confirmAndAct("suspender_plagio", "", true)}
                  disabled={actionLoading}
                  className="px-3 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-60"
                >
                  Suspender por plagio
                </button>
              )}
              <button
                onClick={() => confirmAndAct("cancelar", "¿Cancelar este proyecto?", true)}
                disabled={actionLoading}
                className="px-3 py-2 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
        {actionError && (
          <p className="mt-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {actionError}
          </p>
        )}
      </div>

      {/* Información general */}
      <SectionCard title="Información general">
        <InfoRow label="Modalidad" value={modalityName} />
        <InfoRow label="Programa académico" value={programName} />
        <InfoRow label="Grupo de investigación" value={project.research_group} />
        <InfoRow label="Línea de investigación" value={project.research_line} />
        {project.suggested_director && (
          <InfoRow label="Director sugerido" value={project.suggested_director} />
        )}
        <InfoRow
          label="Vínculo empresarial"
          value={project.has_company_link ? "Sí" : "No"}
        />
        <InfoRow
          label="Registrado"
          value={new Date(project.created_at).toLocaleDateString("es-CO")}
        />
        <InfoRow
          label="Última actualización"
          value={new Date(project.updated_at).toLocaleDateString("es-CO")}
        />
      </SectionCard>

      {/* Integrantes */}
      <SectionCard title={`Integrantes (${project.members.length})`}>
        {project.members.length === 0 ? (
          <p className="text-sm text-gray-400">Sin integrantes registrados.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-gray-200">
                <th className="pb-2 font-semibold text-gray-600">Nombre</th>
                <th className="pb-2 font-semibold text-gray-600">Email</th>
                <th className="pb-2 font-semibold text-gray-600">Estado</th>
                <th className="pb-2 font-semibold text-gray-600">Ingresó</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {project.members.map((m) => (
                <tr key={m.id}>
                  <td className="py-2 font-medium text-gray-800">{m.full_name}</td>
                  <td className="py-2 text-gray-600">{m.email}</td>
                  <td className="py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                      {m.is_active ? "Activo" : "Retirado"}
                    </span>
                  </td>
                  <td className="py-2 text-gray-500">
                    {new Date(m.joined_at).toLocaleDateString("es-CO")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>

      {/* Directores */}
      <SectionCard title="Director(es)">
        {project.directors.length === 0 ? (
          <p className="text-sm text-gray-400">Sin director asignado.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-gray-200">
                <th className="pb-2 font-semibold text-gray-600">Nombre</th>
                <th className="pb-2 font-semibold text-gray-600">Rol</th>
                <th className="pb-2 font-semibold text-gray-600">Estado</th>
                <th className="pb-2 font-semibold text-gray-600">Asignado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {project.directors.map((d) => (
                <tr key={d.id}>
                  <td className="py-2 font-medium text-gray-800">{d.full_name}</td>
                  <td className="py-2 text-gray-600">
                    {d.order === 1 ? "Director principal" : "Co-director"}
                  </td>
                  <td className="py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${d.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                      {d.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="py-2 text-gray-500">
                    {new Date(d.assigned_at).toLocaleDateString("es-CO")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>

      {/* Jurados */}
      <SectionCard title="Jurados">
        {project.jurors.length === 0 ? (
          <p className="text-sm text-gray-400">Sin jurados asignados.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-gray-200">
                <th className="pb-2 font-semibold text-gray-600">Jurado</th>
                <th className="pb-2 font-semibold text-gray-600">Nombre</th>
                <th className="pb-2 font-semibold text-gray-600">Etapa</th>
                <th className="pb-2 font-semibold text-gray-600">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {project.jurors.map((j, i) => (
                <tr key={j.id ?? i}>
                  <td className="py-2 text-gray-600">J{j.juror_number}</td>
                  <td className="py-2 font-medium text-gray-800">
                    {j.full_name ?? "—"}
                  </td>
                  <td className="py-2 text-gray-500">
                    {STAGE_LABELS[j.stage] ?? j.stage}
                  </td>
                  <td className="py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${j.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                      {j.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>

      {/* Radicaciones */}
      <SectionCard title="Radicaciones">
        {project.submissions.length === 0 ? (
          <p className="text-sm text-gray-400">Sin radicaciones.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-gray-200">
                <th className="pb-2 font-semibold text-gray-600">Etapa</th>
                <th className="pb-2 font-semibold text-gray-600">Revisión</th>
                <th className="pb-2 font-semibold text-gray-600">Fecha</th>
                <th className="pb-2 font-semibold text-gray-600">Estado</th>
                <th className="pb-2 font-semibold text-gray-600">Ext.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {project.submissions.map((s) => (
                <tr key={s.id}>
                  <td className="py-2 text-gray-700">
                    {STAGE_LABELS[s.stage] ?? s.stage}
                  </td>
                  <td className="py-2 text-gray-600 text-center">{s.revision_number}</td>
                  <td className="py-2 text-gray-600">
                    {new Date(s.submitted_at).toLocaleDateString("es-CO")}
                  </td>
                  <td className="py-2 text-gray-600">{s.status}</td>
                  <td className="py-2">
                    {s.is_extemporaneous && (
                      <span className="text-xs text-yellow-600 font-medium">Sí</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>

      {/* Evaluaciones */}
      <SectionCard title="Evaluaciones">
        {evaluations.length === 0 ? (
          <p className="text-sm text-gray-400">Sin evaluaciones registradas.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-gray-200">
                <th className="pb-2 font-semibold text-gray-600">Jurado</th>
                <th className="pb-2 font-semibold text-gray-600">Nombre</th>
                <th className="pb-2 font-semibold text-gray-600">Etapa</th>
                <th className="pb-2 font-semibold text-gray-600">Nota</th>
                <th className="pb-2 font-semibold text-gray-600">Fecha</th>
                <th className="pb-2 font-semibold text-gray-600">Ext.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {evaluations.map((e) => (
                <tr key={e.id}>
                  <td className="py-2 text-gray-600">J{e.juror_number}</td>
                  <td className="py-2 font-medium text-gray-800">
                    {e.juror_name ?? "—"}
                  </td>
                  <td className="py-2 text-gray-500">
                    {STAGE_LABELS[e.stage] ?? e.stage}
                  </td>
                  <td className="py-2">
                    {e.score !== null ? (
                      <span className={`font-bold ${e.score >= 3.0 ? "text-green-700" : "text-red-600"}`}>
                        {e.score.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-gray-400">Pendiente</span>
                    )}
                  </td>
                  <td className="py-2 text-gray-500">
                    {e.submitted_at
                      ? new Date(e.submitted_at).toLocaleDateString("es-CO")
                      : "—"}
                  </td>
                  <td className="py-2">
                    {e.is_extemporaneous && (
                      <span className="text-xs text-yellow-600 font-medium">Sí</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>

      {/* Ventana extemporánea */}
      <SectionCard title="Ventana extemporánea">
        <p className="text-sm text-gray-500 mb-4">
          Habilita una prórroga individual para este proyecto fuera del periodo ordinario.
          Si ya existe una ventana activa, usar "Revocar ventana activa".
        </p>
        <VentanaExtForm projectId={project.id} onSuccess={load} />
      </SectionCard>

      {/* Historial */}
      <SectionCard title="Historial de eventos">
        {history.length === 0 ? (
          <p className="text-sm text-gray-400">Sin eventos registrados.</p>
        ) : (
          <div className="space-y-3">
            {history.map((event, i) => (
              <HistoryEventRow key={i} event={event} />
            ))}
          </div>
        )}
      </SectionCard>

      {/* Modal: Aprobar idea */}
      {approveOpen && (
        <ApproveIdeaModal
          projectId={project.id}
          onClose={() => setApproveOpen(false)}
          onSuccess={() => {
            setApproveOpen(false);
            load();
          }}
        />
      )}

      {/* Modal: Rechazar idea */}
      {rejectOpen && (
        <RejectIdeaModal
          projectId={project.id}
          onClose={() => setRejectOpen(false)}
          onSuccess={() => {
            setRejectOpen(false);
            load();
          }}
        />
      )}

      {/* Modal: Asignar jurados J1/J2 */}
      {assignJurorsOpen && (
        <AssignJurorsModal
          projectId={project.id}
          stage={
            project.status === "producto_final_entregado"
              ? "producto_final"
              : "anteproyecto"
          }
          suggestedJurors={project.suggested_jurors ?? []}
          onClose={() => setAssignJurorsOpen(false)}
          onSuccess={() => {
            setAssignJurorsOpen(false);
            load();
          }}
        />
      )}

      {/* Modal: Asignar Jurado 3 */}
      {assignJ3Open && divergentStage && (
        <AssignJuror3Modal
          projectId={project.id}
          stage={divergentStage}
          onClose={() => setAssignJ3Open(false)}
          onSuccess={() => {
            setAssignJ3Open(false);
            load();
          }}
        />
      )}

      {/* Placeholders T-F09-10 a T-F09-11: scheduleOpen, actOpen */}
    </div>
  );
}
