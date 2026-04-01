import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../services/api";

// ── Tipos ──────────────────────────────────────────────────────────────────

interface ProjectItem {
  id: string;
  title: string;
  status: string;
  period: string;
}

interface PaginatedProjects {
  items: ProjectItem[];
  total: number;
  page: number;
  size: number;
}

interface Message {
  id: string;
  sender_display: string;
  content: string;
  is_read: boolean;
  sent_at: string;
}

interface Recipient {
  id: string | null; // null = broadcast a todos
  label: string;
}

interface ProjectMember {
  student_id: string;
  full_name: string;
  is_active: boolean;
}

interface ProjectDirector {
  docente_id: string;
  full_name: string;
  is_active: boolean;
}

interface ProjectJuror {
  docente_id: string;
  full_name: string;
  juror_number: number;
  stage: string;
  is_active: boolean;
}

interface ProjectDetail {
  id: string;
  title: string;
  members: ProjectMember[];
  directors: ProjectDirector[];
  jurors: ProjectJuror[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function apiError(err: unknown): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })
    ?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  return "Ocurrió un error inesperado.";
}

function buildRecipients(detail: ProjectDetail): Recipient[] {
  const opts: Recipient[] = [{ id: null, label: "Todos (broadcast)" }];

  // Integrantes activos
  for (const m of detail.members.filter((x) => x.is_active)) {
    opts.push({ id: m.student_id, label: `${m.full_name} (Integrante)` });
  }

  // Directores activos
  for (const d of detail.directors.filter((x) => x.is_active)) {
    if (!opts.find((o) => o.id === d.docente_id)) {
      opts.push({ id: d.docente_id, label: `${d.full_name} (Director)` });
    }
  }

  // Jurados activos — sin duplicar por docente_id
  const seenJurors = new Set<string>();
  for (const j of detail.jurors.filter((x) => x.is_active)) {
    if (!seenJurors.has(j.docente_id)) {
      seenJurors.add(j.docente_id);
      opts.push({
        id: j.docente_id,
        label: `${j.full_name} (Jurado ${j.juror_number})`,
      });
    }
  }

  return opts;
}

// ── Componente principal ───────────────────────────────────────────────────

export default function AdminMensajes() {
  const [searchParams] = useSearchParams();
  const preselectedId = searchParams.get("proyecto");

  // Listado de proyectos (panel izquierdo)
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  // Proyecto seleccionado
  const [selectedId, setSelectedId] = useState<string | null>(preselectedId);
  const [projectDetail, setProjectDetail] = useState<ProjectDetail | null>(null);

  // Mensajes del proyecto seleccionado
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messagesError, setMessagesError] = useState("");

  // Formulario de composición
  const [content, setContent] = useState("");
  const [recipientId, setRecipientId] = useState<string | "broadcast">("broadcast");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  // Auto-scroll al final del hilo
  const threadEndRef = useRef<HTMLDivElement>(null);

  // ── Cargar proyectos ─────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get<PaginatedProjects>("/projects", {
          params: { page: 1, size: 100 },
        });
        setProjects(data.items);
      } catch {
        // lista vacía si falla
      } finally {
        setLoadingProjects(false);
      }
    }
    load();
  }, []);

  // ── Cargar mensajes y detalle al seleccionar proyecto ────────────────────

  const loadMessages = useCallback(async (projectId: string) => {
    setLoadingMessages(true);
    setMessagesError("");
    setMessages([]);
    try {
      const [msgRes, detailRes] = await Promise.all([
        api.get<Message[]>(`/projects/${projectId}/messages`),
        api.get<ProjectDetail>(`/projects/${projectId}`),
      ]);
      // API retorna DESC; invertimos para mostrar cronológicamente
      setMessages([...msgRes.data].reverse());
      setProjectDetail(detailRes.data);
    } catch (err) {
      setMessagesError(apiError(err));
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    loadMessages(selectedId);
    // Reiniciar formulario al cambiar proyecto
    setContent("");
    setRecipientId("broadcast");
    setSendError("");
  }, [selectedId, loadMessages]);

  // ── Marcar no leídos como leídos ─────────────────────────────────────────

  useEffect(() => {
    if (!selectedId || messages.length === 0) return;
    const unread = messages.filter((m) => !m.is_read);
    for (const msg of unread) {
      api
        .patch(`/projects/${selectedId}/messages/${msg.id}/read`)
        .catch(() => {
          // silencioso: solo el receptor puede marcar — ignorar 403
        });
    }
  }, [selectedId, messages]);

  // ── Scroll al último mensaje ──────────────────────────────────────────────

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Enviar mensaje ────────────────────────────────────────────────────────

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId || !content.trim()) return;
    setSending(true);
    setSendError("");
    try {
      await api.post(`/projects/${selectedId}/messages`, {
        content: content.trim(),
        recipient_id: recipientId === "broadcast" ? undefined : recipientId,
      });
      setContent("");
      // Recargar mensajes
      await loadMessages(selectedId);
    } catch (err) {
      setSendError(apiError(err));
    } finally {
      setSending(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const recipients: Recipient[] = projectDetail
    ? buildRecipients(projectDetail)
    : [{ id: null, label: "Todos (broadcast)" }];

  const selectedProject = projects.find((p) => p.id === selectedId);

  return (
    <div className="flex h-[calc(100vh-0px)] overflow-hidden bg-gray-50">
      {/* ── Panel izquierdo: lista de proyectos ── */}
      <aside className="w-72 shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-4 py-4 border-b border-gray-200">
          <h1 className="text-base font-semibold text-gray-800">Mensajes</h1>
          <p className="text-xs text-gray-500 mt-0.5">Selecciona un proyecto</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingProjects ? (
            <p className="text-sm text-gray-400 p-4">Cargando proyectos…</p>
          ) : projects.length === 0 ? (
            <p className="text-sm text-gray-400 p-4">Sin proyectos registrados.</p>
          ) : (
            <ul>
              {projects.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => setSelectedId(p.id)}
                    className={[
                      "w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors",
                      selectedId === p.id ? "bg-blue-50 border-l-4 border-l-usc-blue" : "",
                    ].join(" ")}
                  >
                    <p
                      className={`text-sm font-medium leading-snug line-clamp-2 ${
                        selectedId === p.id ? "text-usc-blue" : "text-gray-800"
                      }`}
                    >
                      {p.title}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{p.period}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* ── Panel derecho: hilo de mensajes ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedId ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            Selecciona un proyecto para ver sus mensajes.
          </div>
        ) : (
          <>
            {/* Cabecera del proyecto seleccionado */}
            <div className="bg-white border-b border-gray-200 px-6 py-3 shrink-0">
              <p className="text-sm font-semibold text-gray-800 line-clamp-1">
                {selectedProject?.title ?? "Proyecto"}
              </p>
              <p className="text-xs text-gray-400">{selectedProject?.period}</p>
            </div>

            {/* Hilo de mensajes */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {loadingMessages && (
                <p className="text-sm text-gray-400 text-center">Cargando mensajes…</p>
              )}
              {messagesError && (
                <p className="text-sm text-red-600 text-center">{messagesError}</p>
              )}
              {!loadingMessages && !messagesError && messages.length === 0 && (
                <p className="text-sm text-gray-400 text-center">
                  Sin mensajes aún en este proyecto.
                </p>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={[
                    "rounded-xl px-4 py-3 max-w-2xl shadow-sm border",
                    msg.is_read
                      ? "bg-white border-gray-200"
                      : "bg-blue-50 border-blue-200",
                  ].join(" ")}
                >
                  <div className="flex items-baseline justify-between gap-4 mb-1">
                    <span
                      className={`text-xs font-semibold ${
                        msg.is_read ? "text-gray-600" : "text-usc-blue"
                      }`}
                    >
                      {msg.sender_display}
                    </span>
                    <span className="text-xs text-gray-400 shrink-0">
                      {formatTime(msg.sent_at)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                    {msg.content}
                  </p>
                  {!msg.is_read && (
                    <span className="inline-block mt-1.5 text-[11px] font-semibold text-usc-blue bg-blue-100 rounded-full px-2 py-0.5">
                      No leído
                    </span>
                  )}
                </div>
              ))}
              <div ref={threadEndRef} />
            </div>

            {/* Formulario de composición */}
            <div className="bg-white border-t border-gray-200 px-6 py-4 shrink-0">
              <form onSubmit={handleSend} className="space-y-3">
                {/* Selector de destinatario */}
                <div className="flex items-center gap-3">
                  <label
                    htmlFor="recipient"
                    className="text-xs font-medium text-gray-600 shrink-0"
                  >
                    Para:
                  </label>
                  <select
                    id="recipient"
                    value={recipientId}
                    onChange={(e) => setRecipientId(e.target.value)}
                    className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-usc-blue"
                  >
                    {recipients.map((r) => (
                      <option key={r.id ?? "broadcast"} value={r.id ?? "broadcast"}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Área de texto */}
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Escribe un mensaje…"
                  rows={3}
                  className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-usc-blue"
                />

                {sendError && (
                  <p className="text-xs text-red-600">{sendError}</p>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={sending || !content.trim()}
                    className="bg-usc-blue text-white text-sm font-medium px-5 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sending ? "Enviando…" : "Enviar mensaje"}
                  </button>
                </div>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
