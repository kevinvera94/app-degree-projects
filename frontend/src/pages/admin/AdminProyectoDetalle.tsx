import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DocenteSearchInput from "../../components/DocenteSearchInput";
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

  const [juror1, setJuror1] = useState(suggested1?.docente_id ?? "");
  const [juror2, setJuror2] = useState(suggested2?.docente_id ?? "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const stageLabel = stage === "anteproyecto" ? "Anteproyecto" : "Producto final";
  const isProductoFinal = stage === "producto_final";

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

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-usc-navy mb-1">
          Asignar jurados — {stageLabel}
        </h2>
        <p className="text-sm text-gray-500 mb-5">
          Selecciona Jurado 1 y Jurado 2 para esta etapa.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <DocenteSearchInput
            label="Jurado 1"
            required
            value={juror1}
            onChange={(id) => setJuror1(id)}
            excludeIds={juror2 ? [juror2] : []}
            suggested={suggested1 ? { id: suggested1.docente_id, full_name: suggested1.full_name } : undefined}
            changedWarning={changed1 || false}
          />
          <DocenteSearchInput
            label="Jurado 2"
            required
            value={juror2}
            onChange={(id) => setJuror2(id)}
            excludeIds={juror1 ? [juror1] : []}
            suggested={suggested2 ? { id: suggested2.docente_id, full_name: suggested2.full_name } : undefined}
            changedWarning={changed2 || false}
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
  const [juror3, setJuror3] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

        <form onSubmit={handleSubmit} className="space-y-4">
          <DocenteSearchInput
            label="Jurado 3"
            required
            value={juror3}
            onChange={(id) => setJuror3(id)}
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
              {loading ? "Asignando..." : "Asignar Jurado 3"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal: Programar sustentación ─────────────────────────────────────────

function ScheduleSustentationModal({
  projectId,
  onClose,
  onSuccess,
}: {
  projectId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [juror1, setJuror1] = useState("");
  const [juror2, setJuror2] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!juror1 || !juror2) {
      setError("Selecciona ambos jurados de sustentación.");
      return;
    }
    if (juror1 === juror2) {
      setError("El Jurado 1 y el Jurado 2 deben ser distintos.");
      return;
    }
    if (!scheduledDate || !scheduledTime || !location.trim()) {
      setError("Completa todos los campos de fecha, hora y lugar.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      // Asignar jurados de sustentación
      await api.post(`/projects/${projectId}/jurors`, {
        user_id: juror1,
        juror_number: 1,
        stage: "sustentacion",
      });
      await api.post(`/projects/${projectId}/jurors`, {
        user_id: juror2,
        juror_number: 2,
        stage: "sustentacion",
      });
      // Registrar sustentación
      await api.post(`/projects/${projectId}/sustentation`, {
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
        location: location.trim(),
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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-usc-navy mb-1">
          Programar sustentación
        </h2>
        <p className="text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded px-3 py-2 mb-5">
          La sustentación no cuenta con Jurado 3. Solo se asignan J1 y J2.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <DocenteSearchInput
            label="Jurado 1"
            required
            value={juror1}
            onChange={(id) => setJuror1(id)}
            excludeIds={juror2 ? [juror2] : []}
          />
          <DocenteSearchInput
            label="Jurado 2"
            required
            value={juror2}
            onChange={(id) => setJuror2(id)}
            excludeIds={juror1 ? [juror1] : []}
          />

          {/* Fecha y hora */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-usc-blue"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hora <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                required
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-usc-blue"
              />
            </div>
          </div>

          {/* Lugar */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lugar <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ej. Sala de conferencias B, Edificio de Ingenierías"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-usc-blue"
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
              className="px-4 py-2 text-sm bg-usc-blue text-white rounded-lg hover:bg-usc-navy disabled:opacity-60"
            >
              {loading ? "Registrando..." : "Programar sustentación"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal: Emitir acta ─────────────────────────────────────────────────────

function EmitActModal({
  projectId,
  onClose,
  onSuccess,
}: {
  projectId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [hasAuth, setHasAuth] = useState<boolean | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Verificar si ya hay autorización de biblioteca
  useEffect(() => {
    api
      .get<{ library_authorization: boolean | null }>(`/projects/${projectId}/act`)
      .then((res) => setHasAuth(res.data.library_authorization === true))
      .catch(() => setHasAuth(false))
      .finally(() => setCheckingAuth(false));
  }, [projectId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (file) {
        const formData = new FormData();
        formData.append("act_file", file);
        await api.post(`/projects/${projectId}/act`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        await api.post(`/projects/${projectId}/act`, {});
      }
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
        <h2 className="text-lg font-bold text-usc-navy mb-1">Emitir acta</h2>

        {checkingAuth ? (
          <p className="text-sm text-gray-400 py-4">Verificando autorización de biblioteca...</p>
        ) : !hasAuth ? (
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
              <p className="text-sm text-yellow-800 font-medium">
                El estudiante aún no ha diligenciado la autorización de biblioteca.
              </p>
              <p className="text-xs text-yellow-700 mt-1">
                El acta no puede emitirse hasta que el estudiante autorice la publicación.
              </p>
            </div>
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cerrar
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              Autorización de biblioteca diligenciada.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Archivo PDF del acta{" "}
                <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-usc-navy file:text-white hover:file:bg-usc-blue"
              />
              <p className="text-xs text-gray-400 mt-1">
                Puedes emitir el acta sin adjunto y subir el PDF posteriormente.
              </p>
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
                {loading ? "Emitiendo..." : "Emitir acta"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Modal: Aprobar idea ────────────────────────────────────────────────────

function ApproveIdeaModal({
  projectId,
  onClose,
  onSuccess,
}: {
  projectId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [director1, setDirector1] = useState("");
  const [director2, setDirector2] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

        <form onSubmit={handleConfirm} className="space-y-4">
          <DocenteSearchInput
            label="Director principal"
            required
            value={director1}
            onChange={(id) => setDirector1(id)}
            excludeIds={director2 ? [director2] : []}
          />
          <DocenteSearchInput
            label="Co-director"
            optional
            value={director2}
            onChange={(id) => setDirector2(id)}
            excludeIds={director1 ? [director1] : []}
            placeholder="Buscar co-director por nombre o email…"
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
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60"
            >
              {loading ? "Aprobando..." : "Confirmar aprobación"}
            </button>
          </div>
        </form>
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

// Retiro disponible en cualquier etapa posterior a la aprobación del anteproyecto
const RETIRO_ALLOWED_STATUSES = new Set([
  "en_desarrollo",
  "producto_final_entregado",
  "en_revision_jurados_producto_final",
  "correcciones_producto_final_solicitadas",
  "producto_final_corregido_entregado",
  "aprobado_para_sustentacion",
  "sustentacion_programada",
  "trabajo_aprobado",
  "reprobado_en_sustentacion",
  "acta_generada",
]);

// ── Modal: Retirar integrante ──────────────────────────────────────────────

function RetireMemberModal({
  projectId,
  memberId,
  memberName,
  onClose,
  onSuccess,
}: {
  projectId: string;
  memberId: string;
  memberName: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = reason.trim().length > 0 && file !== null && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError("");
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("reason", reason.trim());
      fd.append("attachment", file!);
      await api.patch(`/projects/${projectId}/members/${memberId}/remove`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onSuccess();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-1">
          Retirar integrante
        </h2>
        <p className="text-sm text-gray-500 mb-5">
          Retiro de <span className="font-medium text-gray-700">{memberName}</span>. Esta acción es definitiva.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Justificación <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Motivo del retiro..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-usc-blue resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Aval del director (PDF) <span className="text-red-500">*</span>
            </label>
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
            />
          </div>

          {!canSubmit && !loading && (
            <p className="text-xs text-gray-400">
              {!reason.trim() && !file
                ? "Debes ingresar la justificación y adjuntar el aval del director."
                : !reason.trim()
                ? "La justificación es obligatoria."
                : "El aval del director es obligatorio."}
            </p>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 border border-gray-200 rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Procesando..." : "Confirmar retiro"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal: Suspender por plagio ────────────────────────────────────────────

function SuspenderPlagioModal({
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
        action: "suspender_plagio",
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
        <h2 className="text-lg font-bold text-red-700 mb-1">Suspender por plagio</h2>

        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-5">
          <p className="text-sm font-semibold text-red-700 mb-0.5">
            ⚠ Esta acción es irreversible desde el sistema
          </p>
          <p className="text-sm text-red-600">
            El trabajo quedará suspendido y el CTG deberá remitir el caso al
            comité de ética y disciplina fuera del sistema.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Motivo de la suspensión <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe la evidencia o motivo por el que se suspende el trabajo..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
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
              disabled={loading}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !reason.trim()}
              className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Suspendiendo..." : "Confirmar suspensión"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal: Cancelar / Archivar proyecto ────────────────────────────────────

function CancelarProyectoModal({
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
        action: "cancelar",
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
        <h2 className="text-lg font-bold text-usc-navy mb-1">Cancelar / Archivar proyecto</h2>
        <p className="text-sm text-gray-500 mb-5">
          Úsate para trabajos abandonados. El motivo quedará registrado en el
          historial del proyecto.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Motivo de la cancelación <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe el motivo por el que se cancela o archiva el trabajo..."
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
              disabled={loading}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !reason.trim()}
              className="px-4 py-2 text-sm bg-gray-700 text-white rounded-lg hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Cancelando..." : "Confirmar cancelación"}
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
  const [suspendPlagioOpen, setSuspendPlagioOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [assignJurorsOpen, setAssignJurorsOpen] = useState(false);
  const [assignJ3Open, setAssignJ3Open] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [actOpen, setActOpen] = useState(false);
  const [retireMember, setRetireMember] = useState<{ id: string; name: string } | null>(null);

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
              {needsJ3 && !project.plagiarism_suspended && (
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
                  title="Verifica autorización de biblioteca al abrir"
                >
                  Emitir acta
                </button>
              )}
              {!project.plagiarism_suspended && (
                <button
                  onClick={() => setSuspendPlagioOpen(true)}
                  className="px-3 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                >
                  Suspender por plagio
                </button>
              )}
              {project.status !== "cancelado" && (
                <button
                  onClick={() => setCancelOpen(true)}
                  className="px-3 py-2 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar / Archivar
                </button>
              )}
            </div>
          )}
        </div>
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
                <th className="pb-2 font-semibold text-gray-600"></th>
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
                  <td className="py-2 text-right">
                    {m.is_active && RETIRO_ALLOWED_STATUSES.has(project.status) && (
                      <button
                        onClick={() => setRetireMember({ id: m.id, name: m.full_name })}
                        className="text-xs text-red-600 hover:underline font-medium"
                      >
                        Retirar
                      </button>
                    )}
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

      {/* Modal: Programar sustentación */}
      {scheduleOpen && (
        <ScheduleSustentationModal
          projectId={project.id}
          onClose={() => setScheduleOpen(false)}
          onSuccess={() => {
            setScheduleOpen(false);
            load();
          }}
        />
      )}

      {/* Modal: Emitir acta */}
      {actOpen && (
        <EmitActModal
          projectId={project.id}
          onClose={() => setActOpen(false)}
          onSuccess={() => {
            setActOpen(false);
            load();
          }}
        />
      )}

      {/* Modal: Retirar integrante */}
      {retireMember && (
        <RetireMemberModal
          projectId={project.id}
          memberId={retireMember.id}
          memberName={retireMember.name}
          onClose={() => setRetireMember(null)}
          onSuccess={() => {
            setRetireMember(null);
            load();
          }}
        />
      )}

      {/* Modal: Suspender por plagio */}
      {suspendPlagioOpen && (
        <SuspenderPlagioModal
          projectId={project.id}
          onClose={() => setSuspendPlagioOpen(false)}
          onSuccess={() => {
            setSuspendPlagioOpen(false);
            load();
          }}
        />
      )}

      {/* Modal: Cancelar / Archivar */}
      {cancelOpen && (
        <CancelarProyectoModal
          projectId={project.id}
          onClose={() => setCancelOpen(false)}
          onSuccess={() => {
            setCancelOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}
