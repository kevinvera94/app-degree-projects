# app-degree-projects

Sistema web para la gestión integral de trabajos de grado de la Facultad de Ingeniería de la Universidad Santiago de Cali (USC).

Cubre el ciclo de vida completo: inscripción de idea → anteproyecto → producto final → sustentación → acta.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React + Vite + TypeScript + Tailwind CSS |
| Backend | FastAPI (Python) |
| Base de datos | Supabase (PostgreSQL) |
| Autenticación | Supabase Auth (JWT HS256) |
| Storage | Supabase Storage |
| Deploy backend | Render |
| Deploy frontend | Vercel |

## Documentación

Ver [`specs/BRIEF.md`](specs/BRIEF.md) para la descripción completa del proyecto.

| Documento | Contenido |
|---|---|
| [`specs/BRIEF.md`](specs/BRIEF.md) | Descripción general, roles, módulos y reglas de negocio |
| [`specs/PRD.md`](specs/PRD.md) | Requerimientos funcionales por módulo |
| [`specs/ARCHITECTURE.md`](specs/ARCHITECTURE.md) | Arquitectura técnica (datos, API, auth, infra) |
| [`specs/TASKS.md`](specs/TASKS.md) | Plan de tareas por fases |

## Estructura del repositorio

```
app-degree-projects/
  specs/          ← documentación del proyecto
  frontend/       ← React + Vite
    src/
      components/
      pages/
      hooks/
      services/
      utils/
      types/
  backend/        ← FastAPI
    app/
      routers/
      models/
      schemas/
      services/
      core/
      utils/
```
