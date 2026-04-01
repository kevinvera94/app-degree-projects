import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../services/api";

// ── Tipos ──────────────────────────────────────────────────────────────────

interface ProjectDetail {
  id: string;
  status: string;
  modality_id: string;
}

interface Modality {
  id: string;
  name: string;
  requires_ethics_approval: boolean;
  requires_business_plan_cert: boolean;
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

interface SubmissionResponse {
  id: string;
}

// ── Constantes ─────────────────────────────────────────────────────────────

type AttachmentKey =
  | "plantilla"
  | "carta_aval"
  | "reporte_similitud"
  | "aval_etica"
  | "certificacion_plan_negocio";

const ATTACHMENT_META: Record<AttachmentKey, { label: string; hint?: string }> = {
  plantilla: {
    label: "Documento corregido",
    hint: "Plantilla oficial con las correcciones aplicadas (PDF)",
  },
  carta_aval: {
    label: "Carta de aval del director",
    hint: "Debe indicar explícitamente que el reporte de similitud es ≤ 20%",
  },
  reporte_similitud: {
    label: "Reporte de similitud",
    hint: "Porcentaje máximo permitido: 20%",
  },
  aval_etica: {
    label: "Aval del comité de ética",
    hint: "Requerido para modalidad Investigación",
  },
  certificacion_plan_negocio: {
    label: "Certificación de inscripción del Plan de Negocio",
    hint: "Requerido para modalidad Innovación y Emprendimiento",
  },
};

const MAX_FILE_BYTES = 20 * 1024 * 1024;

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Días hábiles restantes desde requestedAtStr hasta el límite de deadlineDays.
 * Excluye fines de semana (festivos USC no disponibles en cliente).
 */
function businessDaysRemaining(requestedAtStr: string, deadlineDays = 10): number {
  const start = new Date(requestedAtStr);
  start.setHours(0, 0, 0, 0);

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

  let remaining = 0;
  const cursor = new Date(today);
  while (cursor <= deadline) {
    const d = cursor.getDay();
    if (d !== 0 && d !== 6) remaining++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return remaining;
}

function hasActiveWindow(windows: DateWindow[], windowType: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return windows.some(
    (w) =>
      w.window_type === windowType &&
      w.is_active &&
      w.start_date <= today &&
      w.end_date >= today,
  );
}

function apiError(err: unknown): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data
    ?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d: { msg?: string }) => d.msg).join("; ");
  return "Ocurrió un error inesperado.";
}

// Mapeo de status → metadatos de corrección
const CORRECTION_META: Record<
  string,
  { label: string; stage: string; windowType: string }
> = {
  correcciones_anteproyecto_solicitadas: {
    label: "correcciones del anteproyecto",
    stage: "correcciones_anteproyecto",
    windowType: "radicacion_anteproyecto",
  },
  correcciones_producto_final_solicitadas: {
    label: "correcciones del producto final",
    stage: "correcciones_producto_final",
    windowType: "radicacion_producto_final",
  },
};

// ── Subcomponente: fila de adjunto ─────────────────────────────────────────

function AttachmentRow({
  attachmentKey,
  file,
  onFileChange,
  disabled,
}: {
  attachmentKey: AttachmentKey;
  file: File | null;
  onFileChange: (key: AttachmentKey, file: File | null) => void;
  disabled: boolean;
}) {
  const meta = ATTACHMENT_META[attachmentKey];
  const inputId = `file-${attachmentKey}`;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    if (selected && selected.type !== "application/pdf") {
      alert("Solo se aceptan archivos PDF.");
      e.target.value = "";
      return;
    }
    if (selected && selected.size > MAX_FILE_BYTES) {
      alert("El archivo supera el límite de 20 MB.");
      e.target.value = "";
      return;
    }
    onFileChange(attachmentKey, selected);
  }

  return (
    <div className="flex items-start gap-4 py-4 border-b border-gray-100 last:border-0">
      <div className="mt-0.5 shrink-0">
        {file ? (
          <span className="text-success text-lg">✅</span>
        ) : (
          <span className="text-gray-300 text-lg">❌</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800">{meta.label}</p>
        {meta.hint && <p className="text-xs text-gray-500 mt-0.5">{meta.hint}</p>}
        {file && (
          <p className="text-xs text-usc-blue mt-1 truncate">
            📄 {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
          </p>
        )}
      </div>

      <div className="shrink-0">
        <input
          id={inputId}
          type="file"
          accept="application/pdf"
          className="sr-only"
          onChange={handleChange}
          disabled={disabled}
        />
        <label
          htmlFor={inputId}
          className={[
            "inline-block text-xs font-medium px-3 py-1.5 rounded-lg border cursor-pointer transition-colors",
            disabled
              ? "opacity-40 cursor-not-allowed border-gray-200 text-gray-400"
              : file
                ? "border-gray-300 text-gray-600 hover:bg-gray-50"
                : "border-usc-blue text-usc-blue hover:bg-blue-50",
          ].join(" ")}
        >
          {file ? "Cambiar" : "Seleccionar archivo"}
        </label>
      </div>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────

export default function EstudianteEntregarCorrecciones() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [modality, setModality] = useState<Modality | null>(null);
  const [correctionDaysLeft, setCorrectionDaysLeft] = useState<number | null>(null);
  const [windowActive, setWindowActive] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [files, setFiles] = useState<Partial<Record<AttachmentKey, File>>>({});
  const [step, setStep] = useState<"idle" | "creating" | "uploading" | "confirming">("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submitError, setSubmitError] = useState("");

  // ── Cargar datos ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!projectId) return;

    async function load() {
      try {
        const [projRes, modalitiesRes, windowsRes, historyRes] = await Promise.all([
          api.get<ProjectDetail>(`/projects/${projectId}`),
          api.get<Modality[]>("/modalities"),
          api.get<DateWindow[]>("/date-windows"),
          api.get<HistoryEvent[]>(`/projects/${projectId}/history`),
        ]);

        const proj = projRes.data;
        setProject(proj);

        const mod = modalitiesRes.data.find((m) => m.id === proj.modality_id) ?? null;
        setModality(mod);

        const meta = CORRECTION_META[proj.status];
        if (meta) {
          setWindowActive(hasActiveWindow(windowsRes.data, meta.windowType));

          // Calcular días restantes desde el evento de corrección más reciente
          const event = [...historyRes.data]
            .reverse()
            .find(
              (e) => e.type === "status_change" && e.new_status === proj.status,
            );
          if (event?.changed_at) {
            setCorrectionDaysLeft(businessDaysRemaining(event.changed_at));
          }
        }
      } catch {
        setLoadError("No se pudieron cargar los datos. Recarga la página.");
      } finally {
        setLoadingData(false);
      }
    }

    load();
  }, [projectId]);

  // ── Adjuntos requeridos según etapa y modalidad ─────────────────────────
  const correctionMeta = project ? CORRECTION_META[project.status] : null;

  const requiredKeys: AttachmentKey[] = (() => {
    if (!modality) return ["plantilla", "carta_aval", "reporte_similitud"];
    const keys: AttachmentKey[] = ["plantilla", "carta_aval", "reporte_similitud"];
    if (modality.requires_ethics_approval) keys.push("aval_etica");
    if (
      correctionMeta?.stage === "correcciones_producto_final" &&
      modality.requires_business_plan_cert
    ) {
      keys.push("certificacion_plan_negocio");
    }
    return keys;
  })();

  const allUploaded = requiredKeys.every((k) => !!files[k]);

  function handleFileChange(key: AttachmentKey, file: File | null) {
    setFiles((prev) => {
      if (file === null) {
        const updated = { ...prev };
        delete updated[key];
        return updated;
      }
      return { ...prev, [key]: file };
    });
  }

  // ── Envío — 3 pasos ────────────────────────────────────────────────────
  async function handleConfirm() {
    if (!projectId || !correctionMeta || !allUploaded) return;
    setSubmitError("");

    try {
      // Paso 1 — Crear radicación de correcciones
      setStep("creating");
      const { data: submission } = await api.post<SubmissionResponse>(
        `/projects/${projectId}/submissions`,
        { stage: correctionMeta.stage },
      );
      const submissionId = submission.id;

      // Paso 2 — Subir adjuntos
      setStep("uploading");
      const keys = requiredKeys.filter((k) => !!files[k]);
      let uploaded = 0;

      for (const key of keys) {
        const formData = new FormData();
        formData.append("attachment_type", key);
        formData.append("file", files[key] as File);
        await api.post(
          `/projects/${projectId}/submissions/${submissionId}/attachments`,
          formData,
          { headers: { "Content-Type": "multipart/form-data" } },
        );
        uploaded++;
        setUploadProgress(Math.round((uploaded / keys.length) * 100));
      }

      // Paso 3 — Confirmar
      setStep("confirming");
      await api.patch(`/projects/${projectId}/submissions/${submissionId}/confirm`);

      const successMsg =
        correctionMeta.stage === "correcciones_anteproyecto"
          ? "Correcciones del anteproyecto entregadas exitosamente."
          : "Correcciones del producto final entregadas exitosamente.";

      navigate("/estudiante/dashboard", { state: { successMessage: successMsg } });
    } catch (err) {
      setSubmitError(apiError(err));
      setStep("idle");
      setUploadProgress(0);
    }
  }

  // ── Renders ─────────────────────────────────────────────────────────────

  if (loadingData) {
    return (
      <div className="p-8 space-y-4">
        <div className="h-7 w-64 bg-gray-200 animate-pulse rounded" />
        <div className="h-48 bg-gray-100 animate-pulse rounded-xl" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-8">
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {loadError}
        </p>
      </div>
    );
  }

  // Estado incorrecto — no está en fase de correcciones
  if (project && !correctionMeta) {
    return (
      <div className="p-8 max-w-lg">
        <h1 className="text-2xl font-bold text-usc-navy mb-4">Entregar correcciones</h1>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
          <p className="text-sm text-gray-600">
            La entrega de correcciones solo está disponible cuando hay correcciones solicitadas.
            Estado actual: <strong>{project.status}</strong>.
          </p>
          <button
            onClick={() => navigate("/estudiante/dashboard")}
            className="mt-4 text-sm text-usc-blue hover:underline"
          >
            ← Volver al dashboard
          </button>
        </div>
      </div>
    );
  }

  // Plazo vencido y sin ventana activa — no se puede entregar
  if (correctionDaysLeft === 0 && !windowActive) {
    return (
      <div className="p-8 max-w-lg">
        <h1 className="text-2xl font-bold text-usc-navy mb-4">Entregar correcciones</h1>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-red-100 mx-auto mb-4 flex items-center justify-center">
            <svg
              className="w-7 h-7 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Plazo vencido</h2>
          <p className="text-sm text-gray-500">
            El plazo venció. La entrega estará disponible cuando se abra la siguiente
            ventana de radicación.
          </p>
          <button
            onClick={() => navigate("/estudiante/dashboard")}
            className="mt-4 text-sm text-usc-blue hover:underline"
          >
            ← Volver al dashboard
          </button>
        </div>
      </div>
    );
  }

  const isSubmitting = step !== "idle";
  const isUrgent = correctionDaysLeft !== null && correctionDaysLeft <= 2;

  return (
    <div className="p-8 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-usc-navy">Entregar correcciones</h1>
        {correctionMeta && (
          <p className="text-sm text-gray-500 mt-1 capitalize">{correctionMeta.label}</p>
        )}
      </div>

      {/* Banner de plazo */}
      {correctionDaysLeft !== null && (
        <div
          className={[
            "flex gap-3 rounded-xl border p-4",
            correctionDaysLeft === 0
              ? "bg-orange-50 border-orange-300 text-orange-800"
              : isUrgent
                ? "bg-red-50 border-red-300 text-red-800"
                : "bg-yellow-50 border-yellow-300 text-yellow-800",
          ].join(" ")}
        >
          <svg
            className="w-5 h-5 shrink-0 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-sm font-medium">
            {correctionDaysLeft === 0
              ? "El plazo ha vencido. Tu entrega quedará marcada como extemporánea."
              : `Tienes ${correctionDaysLeft} día${correctionDaysLeft === 1 ? "" : "s"} hábil${correctionDaysLeft === 1 ? "" : "es"} para entregar las correcciones.`}
          </p>
        </div>
      )}

      {/* Aviso carta de aval */}
      <div className="flex gap-3 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-sm text-yellow-800">
        <svg
          className="w-5 h-5 shrink-0 mt-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>
          La <strong>carta de aval</strong> debe indicar explícitamente que el reporte de
          similitud es <strong>≤ 20%</strong>, de acuerdo con el Art. 31° literal i de la
          Resolución 004/2025.
        </span>
      </div>

      {/* Lista de adjuntos */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-1">Documentos requeridos</h2>
        <p className="text-xs text-gray-500 mb-4">
          Solo se aceptan archivos PDF de máximo 20 MB.
        </p>

        {requiredKeys.map((key) => (
          <AttachmentRow
            key={key}
            attachmentKey={key}
            file={files[key] ?? null}
            onFileChange={handleFileChange}
            disabled={isSubmitting}
          />
        ))}
      </div>

      {/* Progreso de subida */}
      {isSubmitting && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
          {step === "creating" && "Creando radicación…"}
          {step === "uploading" && (
            <div className="space-y-2">
              <p>Subiendo documentos… {uploadProgress}%</p>
              <div className="w-full bg-blue-100 rounded-full h-1.5">
                <div
                  className="bg-usc-blue h-1.5 rounded-full transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
          {step === "confirming" && "Confirmando entrega…"}
        </div>
      )}

      {/* Error */}
      {submitError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {submitError}
        </p>
      )}

      {/* Botones */}
      <div className="flex gap-3">
        <button
          onClick={handleConfirm}
          disabled={!allUploaded || isSubmitting}
          className="bg-usc-blue text-white text-sm font-semibold px-6 py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Procesando…" : "Confirmar entrega"}
        </button>
        <button
          type="button"
          onClick={() => navigate("/estudiante/dashboard")}
          disabled={isSubmitting}
          className="text-sm text-gray-600 hover:text-gray-900 px-4 py-2.5 disabled:opacity-40"
        >
          Cancelar
        </button>
      </div>

      {!allUploaded && !isSubmitting && (
        <p className="text-xs text-gray-400">
          Selecciona todos los documentos obligatorios para habilitar la confirmación.
        </p>
      )}
    </div>
  );
}
