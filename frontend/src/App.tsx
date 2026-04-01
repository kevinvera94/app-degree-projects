import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/layout/AppLayout";
import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsuarios from "./pages/admin/AdminUsuarios";
import AdminConfiguracion from "./pages/admin/AdminConfiguracion";
import AdminProyectos from "./pages/admin/AdminProyectos";
import AdminProyectoDetalle from "./pages/admin/AdminProyectoDetalle";
import AdminReportes from "./pages/admin/AdminReportes";
import AdminMensajes from "./pages/admin/AdminMensajes";
import DocenteProyectos from "./pages/docente/DocenteProyectos";
import EstudianteProyecto from "./pages/estudiante/EstudianteProyecto";
import EstudianteDashboard from "./pages/estudiante/EstudianteDashboard";
import EstudianteInscribirIdea from "./pages/estudiante/EstudianteInscribirIdea";
import EstudianteRadicarAnteproyecto from "./pages/estudiante/EstudianteRadicarAnteproyecto";

export default function App() {
  return (
    <Routes>
      {/* Rutas públicas */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/auth/reset-password" element={<ResetPasswordPage />} />

      {/* Rutas protegidas — Administrador */}
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute role="administrador">
            <AppLayout>
              <Routes>
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="usuarios" element={<AdminUsuarios />} />
                <Route path="configuracion" element={<AdminConfiguracion />} />
                <Route path="proyectos" element={<AdminProyectos />} />
                <Route path="proyectos/:id" element={<AdminProyectoDetalle />} />
                <Route path="reportes" element={<AdminReportes />} />
                <Route path="mensajes" element={<AdminMensajes />} />
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
                <Route path="dashboard" element={<EstudianteDashboard />} />
                <Route path="inscribir-idea" element={<EstudianteInscribirIdea />} />
                <Route path="proyectos/:id/radicar-anteproyecto" element={<EstudianteRadicarAnteproyecto />} />
                <Route path="proyecto" element={<EstudianteProyecto />} />
                <Route index element={<Navigate to="dashboard" replace />} />
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
