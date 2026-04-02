/**
 * Vista de mensajería compartida entre Estudiante y Docente.
 * Ambos roles usan el mismo componente con distinto basePath.
 *
 * Flujo:
 *  1. Carga todos los proyectos del usuario (GET /projects/my)
 *  2. El usuario selecciona un proyecto → se carga el hilo (GET /projects/{id}/messages)
 *  3. Al abrir un hilo: marca los mensajes no leídos dirigidos al usuario actual
 *  4. Formulario de respuesta al pie + selector de destinatario
 */

import { useEffect, useRef, useState } from "react";
import api from "../../services/api";

// ── Tipos ──────────────────────────────────────────────────────────────────

interface ProjectSummary {
  id: string;
  title: string;
  status: string;
}

interface MessageRow {
  id: string;
  sender_display: string;
  content: string;
  is_read: boolean;
  sent_at: string;
}

interface DirectorInfo {
  docente_id: string;
  full_name: string;
  is_active: boolean;
}

interface JurorInfo {
  id: string;
  docente_id: string | null;
  full_name: string | null;
  juror_number: number;
  is_active: boolean;
}

interface MemberInfo {
  student_id: string;
  full_name: string;
  is_active: boolean;
}

interface ProjectDetail {
  id: string;
  directors: DirectorInfo[];
  jurors: JurorInfo[];
  members: MemberInfo[];
}

interface Recipient {
  id: string;
  display: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const isToday =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();

  if (isToday) {
    return d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}

function apiError(err: unknown): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data
    ?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d: { msg?: string }) => d.msg).join("; ");
  return "Ocurrió un error inesperado.";
}

// ── Componente: hilo de mensajes ───────────────────────────────────────────

function MessageThread({
  projectId,
  recipients,
  userRole,
  onUnreadChange,
}: {
  projectId: string;
  recipients: Recipient[];
  userRole: "estudiante" | "docente";
  onUnreadChange: () => void;
}) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [recipientId, setRecipientId] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Cargar mensajes y marcar no leídos
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await api.get<MessageRow[]>(`/projects/${projectId}/messages`);
        if (cancelled) return;

        const msgs = res.data;
        setMessages(msgs);

        // Marcar como leídos los mensajes no leídos recibidos por este usuario
        const unread = msgs.filter((m) => !m.is_read);
        for (const m of unread) {
          try {
            await api.patch(`/projects/${projectId}/messages/${m.id}/read`);
          } catch {
            // no bloquear si falla marcar uno
          }
        }
        if (unread.length > 0) onUnreadChange();
      } catch {
        // error silencioso — no bloquear la vista
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Scroll al final cuando llegan mensajes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Pre-seleccionar primer destinatario disponible
  useEffect(() => {
    if (recipients.length > 0 && !recipientId) {
      setRecipientId(recipients[0].id);
    }
  }, [recipients, recipientId]);

  async function handleSend() {
    if (!content.trim() || sending) return;
    setSendError("");
    setSending(true);
    try {
      const res = await api.post<MessageRow>(`/projects/${projectId}/messages`, {
        content: content.trim(),
        recipient_id: recipientId || null,
      });
      setMessages((prev) => [...prev, res.data]);
      setContent("");
    } catch (err) {
      setSendError(apiError(err));
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-usc-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Hilo de mensajes */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-gray-400 italic text-center mt-8">
            No hay mensajes en este trabajo. Sé el primero en escribir.
          </p>
        )}
        {messages.map((msg) => {
          return (
            <div key={msg.id} className="flex flex-col">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-semibold text-gray-700">
                  {msg.sender_display}
                </span>
                <span className="text-xs text-gray-400">{formatDate(msg.sent_at)}</span>
                {!msg.is_read && (
                  <span className="text-xs font-bold text-usc-blue">● nuevo</span>
                )}
              </div>
              <div className="mt-0.5 text-sm text-gray-800 bg-gray-50 rounded-lg px-3 py-2 max-w-xl">
                {msg.content}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Formulario de respuesta */}
      <div className="border-t border-gray-200 px-4 py-4 space-y-3 bg-white">
        {/* Selector de destinatario */}
        {recipients.length > 0 && (
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-gray-500 shrink-0">Para:</label>
            <select
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
              className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-usc-blue bg-white"
            >
              {recipients.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.display}
                </option>
              ))}
            </select>
          </div>
        )}

        {sendError && (
          <p className="text-xs text-red-600">{sendError}</p>
        )}

        <div className="flex gap-2 items-end">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder="Escribe un mensaje… (Enter para enviar, Shift+Enter para nueva línea)"
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-usc-blue resize-none"
          />
          <button
            onClick={handleSend}
            disabled={!content.trim() || sending}
            className="bg-usc-blue text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {sending ? "…" : "Enviar"}
          </button>
        </div>
        <p className="text-xs text-gray-400">
          {userRole === "estudiante"
            ? "Puedes escribir a tu Director o a tu Jurado. Los jurados son anónimos."
            : "Puedes escribir al Estudiante o al Administrador."}
        </p>
      </div>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────

export default function MensajesView({ userRole }: { userRole: "estudiante" | "docente" }) {

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [projectDetail, setProjectDetail] = useState<ProjectDetail | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);

  // Cargar lista de proyectos del usuario
  useEffect(() => {
    api
      .get<ProjectSummary[]>("/projects/my")
      .then((r) => setProjects(r.data))
      .catch(() => {})
      .finally(() => setLoadingProjects(false));
  }, []);

  // Al seleccionar proyecto, cargar su detalle para construir lista de destinatarios
  useEffect(() => {
    if (!selectedId) return;
    setProjectDetail(null);
    api
      .get<ProjectDetail>(`/projects/${selectedId}`)
      .then((r) => setProjectDetail(r.data))
      .catch(() => {});
  }, [selectedId]);

  // Construir lista de destinatarios según rol
  const recipients: Recipient[] = (() => {
    if (!projectDetail) return [];

    if (userRole === "estudiante") {
      const list: Recipient[] = [];
      // Directores activos
      for (const d of projectDetail.directors.filter((x) => x.is_active)) {
        list.push({ id: d.docente_id, display: `Director — ${d.full_name}` });
      }
      // Jurados activos (anónimos)
      for (const j of projectDetail.jurors.filter((x) => x.is_active && x.docente_id)) {
        list.push({
          id: j.docente_id!,
          display: `Jurado ${j.juror_number}`,
        });
      }
      return list;
    }

    // Docente (director o jurado)
    const list: Recipient[] = [];
    // Estudiantes activos
    for (const m of projectDetail.members.filter((x) => x.is_active)) {
      list.push({ id: m.student_id, display: `Estudiante — ${m.full_name}` });
    }
    // Admin: se envía sin recipient_id (broadcast) pero simplificamos con un valor especial
    // El backend acepta recipient_id = null → usamos cadena vacía para indicar "Admin/broadcast"
    // En realidad, el docente Director puede enviar al Admin — usamos null
    return list;
  })();

  function handleUnreadChange() {
    // Callback para propagar el cambio de mensajes no leídos al proyecto padre
  }

  if (loadingProjects) {
    return (
      <div className="p-8 space-y-3">
        <div className="h-7 w-48 bg-gray-200 animate-pulse rounded" />
        <div className="h-40 bg-gray-100 animate-pulse rounded-xl" />
      </div>
    );
  }

  return (
    <div className="h-full flex min-h-0" style={{ height: "calc(100vh - 4rem)" }}>
      {/* ── Panel izquierdo: lista de proyectos ─────────────────────── */}
      <aside className="w-72 border-r border-gray-200 flex flex-col bg-white shrink-0">
        <div className="px-4 py-4 border-b border-gray-100">
          <h1 className="text-base font-bold text-usc-navy">Mensajes</h1>
        </div>

        {projects.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-400 italic">
            No tienes trabajos de grado activos.
          </p>
        ) : (
          <ul className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {projects.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => setSelectedId(p.id)}
                  className={[
                    "w-full text-left px-4 py-3 transition-colors",
                    selectedId === p.id
                      ? "bg-blue-50 border-l-2 border-usc-blue"
                      : "hover:bg-gray-50 border-l-2 border-transparent",
                  ].join(" ")}
                >
                  <p
                    className={`text-sm font-medium leading-snug line-clamp-2 ${
                      selectedId === p.id ? "text-usc-blue" : "text-gray-800"
                    }`}
                  >
                    {p.title}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{p.status}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {/* ── Panel derecho: hilo de mensajes ──────────────────────────── */}
      <main className="flex-1 flex flex-col min-h-0 bg-white">
        {!selectedId ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <svg
                className="w-10 h-10 mx-auto mb-3 text-gray-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <p className="text-sm">Selecciona un proyecto para ver los mensajes</p>
            </div>
          </div>
        ) : (
          <>
            {/* Cabecera del hilo */}
            <div className="px-5 py-3 border-b border-gray-100 shrink-0">
              <p className="text-sm font-semibold text-gray-800 line-clamp-1">
                {projects.find((p) => p.id === selectedId)?.title}
              </p>
            </div>

            <MessageThread
              key={selectedId}
              projectId={selectedId}
              recipients={recipients}
              userRole={userRole}
              onUnreadChange={handleUnreadChange}
            />
          </>
        )}
      </main>
    </div>
  );
}
