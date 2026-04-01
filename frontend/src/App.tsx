import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/layout/AppLayout";
import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import DocenteProyectos from "./pages/docente/DocenteProyectos";
import EstudianteProyecto from "./pages/estudiante/EstudianteProyecto";

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
