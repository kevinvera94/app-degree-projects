import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/layout/AppLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import DocenteProyectos from "./pages/docente/DocenteProyectos";
import EstudianteProyecto from "./pages/estudiante/EstudianteProyecto";

// Login se implementa en T-F09-02; placeholder mientras tanto
function LoginPlaceholder() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow p-8 max-w-sm w-full text-center">
        <div className="w-12 h-12 bg-usc-navy rounded-full mx-auto mb-4" />
        <h1 className="text-xl font-bold text-usc-navy mb-1">
          USC — Trabajos de Grado
        </h1>
        <p className="text-gray-500 text-sm">
          Página de login — próximamente (T-F09-02)
        </p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Ruta pública */}
      <Route path="/login" element={<LoginPlaceholder />} />

      {/* Rutas protegidas — Administrador */}
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute role="administrador">
            <AppLayout>
              <Routes>
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route index element={<Navigate to="dashboard" replace />} />
              </Routes>
            </AppLayout>
          </ProtectedRoute>
        }
      />

      {/* Rutas protegidas — Docente */}
      <Route
        path="/docente/*"
        element={
          <ProtectedRoute role="docente">
            <AppLayout>
              <Routes>
                <Route path="proyectos" element={<DocenteProyectos />} />
                <Route index element={<Navigate to="proyectos" replace />} />
              </Routes>
            </AppLayout>
          </ProtectedRoute>
        }
      />

      {/* Rutas protegidas — Estudiante */}
      <Route
        path="/estudiante/*"
        element={
          <ProtectedRoute role="estudiante">
            <AppLayout>
              <Routes>
                <Route path="proyecto" element={<EstudianteProyecto />} />
                <Route index element={<Navigate to="proyecto" replace />} />
              </Routes>
            </AppLayout>
          </ProtectedRoute>
        }
      />

      {/* Ruta raíz → login */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
