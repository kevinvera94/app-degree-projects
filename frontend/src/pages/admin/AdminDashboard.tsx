import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";

// ── Tipos ──────────────────────────────────────────────────────────────────

interface PendingReviewItem {
  project_id: string;
  title: string;
  status: string;
  period: string;
  days_elapsed: number;
}

interface PendingCorrectionItem {
  project_id: string;
  title: string;
  status: string;
  deadline_date: string;
  days_remaining: number;
}

interface ExpiringJurorItem {
  project_id: string;
  title: string;
  juror_name: string;
  stage: string;
  deadline_date: string;
  business_days_remaining: number;
}

interface DashboardData {
  totalActive: number;
  pendingReviewCount: number;
  pendingCorrectionsCount: number;
  upcomingSustentations: number;
  pendingReview: PendingReviewItem[];
  expiringJurors: ExpiringJurorItem[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  anteproyecto_pendiente_evaluacion: "Anteproyecto — pendiente evaluación",
  producto_final_entregado: "Producto final entregado",
  en_revision_jurados_producto_final: "En revisión de jurados (PF)",
  correcciones_anteproyecto_solicitadas: "Correcciones anteproyecto",
  correcciones_producto_final_solicitadas: "Correcciones producto final",
};

const STAGE_LABELS: Record<string, string> = {
  anteproyecto: "Anteproyecto",
  producto_final: "Producto final",
  sustentacion: "Sustentación",
};

function StatCard({
  label,
  value,
  color,
  loading,
}: {
  label: string;
  value: number;
  color: string;
  loading: boolean;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      {loading ? (
        <div className="h-8 w-16 bg-gray-100 animate-pulse rounded" />
      ) : (
        <p className={`text-3xl font-bold ${color}`}>{value}</p>
      )}
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const alertDays = parseInt(
      localStorage.getItem("usc_juror_alert_days") ?? "3",
      10
    );

    Promise.all([
      api.get<{ total: number }>("/reports/projects", {
        params: { size: 1 },
      }),
      api.get<{ total: number }>("/reports/projects", {
        params: { project_status: "sustentacion_programada", size: 1 },
      }),
      api.get<PendingReviewItem[]>("/reports/projects/pending-review"),
      api.get<PendingCorrectionItem[]>("/reports/projects/pending-corrections"),
      api.get<ExpiringJurorItem[]>(`/reports/jurors/expiring`, {
        params: { days: alertDays },
      }),
    ])
      .then(([allRes, sustRes, reviewRes, correctionsRes, expiringRes]) => {
        setData({
          totalActive: allRes.data.total,
          upcomingSustentations: sustRes.data.total,
          pendingReviewCount: reviewRes.data.length,
          pendingCorrectionsCount: correctionsRes.data.length,
          pendingReview: reviewRes.data,
          expiringJurors: expiringRes.data,
        });
      })
      .catch(() => setError("No se pudo cargar el dashboard. Verifica la conexión."))
      .finally(() => setLoading(false));
  }, []);

  const stats = [
    {
      label: "Proyectos activos",
      value: data?.totalActive ?? 0,
      color: "text-usc-navy",
    },
    {
      label: "Pendientes de evaluación",
      value: data?.pendingReviewCount ?? 0,
      color: "text-info",
    },
    {
      label: "Correcciones sin respuesta",
      value: data?.pendingCorrectionsCount ?? 0,
      color: "text-warning",
    },
    {
      label: "Sustentaciones programadas",
      value: data?.upcomingSustentations ?? 0,
      color: "text-success",
    },
  ];

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-2xl font-bold text-usc-navy">Dashboard</h1>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <StatCard
            key={s.label}
            label={s.label}
            value={s.value}
            color={s.color}
            loading={loading}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Alertas de vencimiento de jurados */}
        <section>
          <h2 className="text-base font-semibold text-gray-800 mb-3">
            Alertas de vencimiento — jurados
          </h2>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {loading ? (
              <p className="p-5 text-sm text-gray-400">Cargando...</p>
            ) : !data || data.expiringJurors.length === 0 ? (
              <p className="p-5 text-sm text-gray-400">
                Sin jurados próximos a vencer.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left">
                    <th className="px-4 py-3 font-semibold text-gray-600">Proyecto</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Jurado</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Etapa</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Vence</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Días</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.expiringJurors.map((item, i) => (
                    <tr
                      key={i}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() =>
                        navigate(`/admin/proyectos/${item.project_id}`)
                      }
                    >
                      <td className="px-4 py-3 font-medium text-gray-800 max-w-[160px] truncate">
                        {item.title}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{item.juror_name}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {STAGE_LABELS[item.stage] ?? item.stage}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{item.deadline_date}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full ${
                            item.business_days_remaining <= 1
                              ? "bg-red-100 text-red-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {item.business_days_remaining}d
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Pendientes de revisión */}
        <section>
          <h2 className="text-base font-semibold text-gray-800 mb-3">
            Pendientes de revisión
          </h2>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {loading ? (
              <p className="p-5 text-sm text-gray-400">Cargando...</p>
            ) : !data || data.pendingReview.length === 0 ? (
              <p className="p-5 text-sm text-gray-400">
                No hay proyectos pendientes de asignación.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left">
                    <th className="px-4 py-3 font-semibold text-gray-600">Proyecto</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Estado</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Periodo</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Días</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.pendingReview.map((item) => (
                    <tr
                      key={item.project_id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() =>
                        navigate(`/admin/proyectos/${item.project_id}`)
                      }
                    >
                      <td className="px-4 py-3 font-medium text-gray-800 max-w-[180px] truncate">
                        {item.title}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {STATUS_LABELS[item.status] ?? item.status}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{item.period}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-bold ${
                            item.days_elapsed > 5
                              ? "text-red-600"
                              : "text-gray-500"
                          }`}
                        >
                          {item.days_elapsed}d
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
