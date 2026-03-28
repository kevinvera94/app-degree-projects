# INFRA.md — Infraestructura y despliegue
> Variables de entorno, entornos, despliegue y estructura de carpetas del código.
> Última actualización: 2026-03-28

---

## Entornos

| Entorno | Frontend | Backend | BD |
|---|---|---|---|
| **Desarrollo** | `localhost:5173` (Vite dev server) | `localhost:8000` (uvicorn --reload) | PostgreSQL local o Supabase dev project |
| **Producción** | Vercel (deploy automático desde `main`) | Render (deploy automático desde `main`) | Supabase prod project |

---

## Variables de entorno

### Backend (`backend/.env`)

```env
# Base de datos
DATABASE_URL=postgresql+asyncpg://user:password@host:port/dbname

# Supabase
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # solo backend, nunca exponer al cliente
SUPABASE_JWT_SECRET=your-jwt-secret

# Storage
SUPABASE_STORAGE_BUCKET=degree-projects-docs

# App
APP_ENV=development                # development | production
SECRET_KEY=your-secret-key
ALLOWED_ORIGINS=http://localhost:5173,https://your-app.vercel.app

# Configuración de plazos (días hábiles)
# Días hábiles = días calendario - fines de semana - festivos del calendario académico USC
JUROR_EVALUATION_DEADLINE_DAYS=15
JUROR_SECOND_REVIEW_DEADLINE_DAYS=10
STUDENT_CORRECTION_DEADLINE_DAYS=10
JUROR_EXPIRY_ALERT_DAYS=3          # días hábiles antes del vencimiento para alertar

# Festivos USC (archivo JSON con fechas del calendario académico)
# Formato: ["2026-01-01", "2026-03-23", ...] — se actualiza cada periodo académico
USC_HOLIDAYS_FILE=config/usc_holidays.json
```

### Frontend (`frontend/.env`)

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

> ⚠️ Nunca exponer `SUPABASE_SERVICE_ROLE_KEY` ni `SECRET_KEY` al cliente.

---

## Estructura de carpetas — Backend (FastAPI)

```
backend/
  app/
    main.py                  ← instancia FastAPI, registro de routers, CORS
    core/
      config.py              ← carga de variables de entorno (pydantic-settings)
      security.py            ← validación JWT, funciones de hashing
      dependencies.py        ← get_current_user, require_admin, require_project_member
      database.py            ← engine asyncpg, sesión async
    routers/
      auth.py
      users.py
      academic_programs.py
      modalities.py
      date_windows.py
      projects.py
      submissions.py
      evaluations.py
      sustentations.py
      acts.py
      messages.py
      history.py
      reports.py
      extemporaneous_windows.py
    models/                  ← SQLAlchemy ORM models (tablas)
      user.py
      project.py
      submission.py
      evaluation.py
      sustentation.py
      act.py
      message.py
      ...
    schemas/                 ← Pydantic schemas (request/response)
      user.py
      project.py
      submission.py
      evaluation.py
      ...
    services/                ← lógica de negocio
      project_service.py     ← máquina de estados, validaciones de flujo
      evaluation_service.py  ← lógica de calificaciones, Jurado 3, extemporáneo
      submission_service.py  ← validación de ventanas, adjuntos obligatorios
      report_service.py      ← consultas de reportes
      message_service.py     ← intermediación y anonimato de jurados
    utils/
      date_utils.py          ← cálculo de días hábiles
      file_utils.py          ← interacción con Supabase Storage
  requirements.txt
  Dockerfile
  .env
  .env.example
```

---

## Estructura de carpetas — Frontend (React + Vite)

```
frontend/
  src/
    components/              ← componentes reutilizables
      ui/                    ← botones, inputs, modales, tablas
      layout/                ← sidebar, navbar, page wrapper
      forms/                 ← formularios por módulo
    pages/                   ← una carpeta por módulo/rol
      auth/
      admin/
      docente/
      estudiante/
    hooks/                   ← custom hooks (useAuth, useProject, useDateWindow…)
    services/                ← llamadas a la API (axios/fetch wrappers)
    types/                   ← TypeScript types e interfaces
    utils/                   ← helpers de fechas, formato, validación
    routes/                  ← definición de rutas con React Router
    context/                 ← AuthContext, etc.
  index.html
  vite.config.ts
  .env
  .env.example
```

---

## Despliegue — Vercel (Frontend)

- **Trigger:** push a `main`
- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Variables de entorno:** configuradas en el dashboard de Vercel
- **Routing:** SPA → `rewrites: [{ "source": "/(.*)", "destination": "/index.html" }]`

---

## Despliegue — Render (Backend)

- **Trigger:** push a `main`
- **Runtime:** Python 3.11+
- **Start command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Variables de entorno:** configuradas en el dashboard de Render
- **Health check:** `GET /health`

---

## Supabase Storage — Organización de buckets

```
Bucket: degree-projects-docs/
  {project_id}/
    anteproyecto/
      {submission_id}/
        plantilla.pdf
        carta_aval.pdf
        reporte_similitud.pdf
        aval_etica.pdf            (si aplica)
    producto_final/
      {submission_id}/
        plantilla.pdf
        carta_aval.pdf
        reporte_similitud.pdf
        certificacion_plan_negocio.pdf   (si aplica)
        carta_impacto.pdf                (si aplica)
    actas/
      acta_{project_id}.pdf
```

- Acceso: **privado** — URLs firmadas con expiración (Supabase Signed URLs)
- Solo el backend genera URLs firmadas; el cliente nunca accede directamente al bucket

---

## Consideraciones para multi-facultad (futuro)

- Agregar `faculty_id` a: `academic_programs`, `modalities`, `date_windows`, `thesis_projects`
- Los usuarios administradores tendrán un `faculty_id` de alcance
- El bucket de Storage se puede particionar por `{faculty_id}/{project_id}/`
- No requiere reescritura estructural, solo agregar el campo y los filtros correspondientes
