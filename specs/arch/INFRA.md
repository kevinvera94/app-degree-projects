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
# Formato: { "2026-1": ["2026-01-01","2026-03-23"], "2026-2": ["2026-07-01","2026-12-25"] }
# Claves = periodo académico. Se actualiza al inicio de cada periodo.
# Si el archivo no existe o está vacío, solo se excluyen fines de semana.
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

## Variables de entorno por entorno de despliegue

### Backend — Render

Configurar en el dashboard de Render → servicio → **Environment**.

| Variable | Requerida | Descripción |
|---|:---:|---|
| `DATABASE_URL` | ✅ | Connection string PostgreSQL (Supabase pooler, puerto 6543) |
| `SUPABASE_URL` | ✅ | URL del proyecto Supabase |
| `SUPABASE_ANON_KEY` | ✅ | Clave pública anon |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Clave de servicio (solo backend, nunca exponer) |
| `SUPABASE_JWT_SECRET` | ✅ | Secreto JWT de Supabase (Settings → API → JWT Secret) |
| `SUPABASE_STORAGE_BUCKET` | ✅ | Nombre del bucket: `degree-projects-docs` |
| `APP_ENV` | ✅ | `production` |
| `SECRET_KEY` | ✅ | Mínimo 32 chars, generado con `secrets.token_hex(32)` |
| `ALLOWED_ORIGINS` | ✅ | Dominio de Vercel: `https://<proyecto>.vercel.app` |
| `JUROR_EXPIRY_ALERT_DAYS` | — | Días hábiles de alerta antes del vencimiento (default: 3) |
| `JUROR_EVALUATION_DEADLINE_DAYS` | — | Plazo primera evaluación (default: 15) |
| `JUROR_SECOND_REVIEW_DEADLINE_DAYS` | — | Plazo segunda revisión (default: 10) |
| `STUDENT_CORRECTION_DEADLINE_DAYS` | — | Plazo correcciones estudiante (default: 10) |
| `USC_HOLIDAYS_FILE` | — | Ruta al JSON de festivos (default: `app/data/usc_holidays.json`) |

> **`USC_HOLIDAYS_FILE` en Render:** el archivo `backend/app/data/usc_holidays.json`
> está commiteado en el repositorio y se incluye automáticamente en el build de Render.
> No requiere configuración adicional — la variable puede omitirse o mantener el valor
> por defecto. Para actualizar festivos basta con editar el archivo y hacer push.

### Frontend — Vercel

Configurar en el dashboard de Vercel → proyecto → **Settings → Environment Variables**.
Aplicar al entorno **Production** (y Preview si se desea).

| Variable | Requerida | Descripción |
|---|:---:|---|
| `VITE_API_BASE_URL` | ✅ | URL del backend en Render: `https://<servicio>.onrender.com/api/v1` |
| `VITE_SUPABASE_URL` | ✅ | URL del proyecto Supabase (mismo valor que el backend) |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Clave pública anon (nunca la `service_role_key`) |

> ⚠️ Las variables `VITE_*` son embebidas en el bundle en build time — no incluir
> ninguna clave secreta (`SERVICE_ROLE_KEY`, `JWT_SECRET`, etc.).

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
- **Build command:** `pip install -r requirements-prod.txt`
- **Start command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Root directory:** `backend`
- **Variables de entorno:** configuradas en el dashboard de Render (ver tabla arriba o `render.yaml`)
- **Health check:** `GET /health`
- **Configuración declarativa:** `render.yaml` en la raíz del repositorio

### URLs de producción

| Servicio | URL |
|---|---|
| **Backend (Render)** | `https://app-degree-projects.onrender.com` |
| **Frontend (Vercel)** | *(pendiente — T-F11-07)* |

### Pasos de deploy en Render

1. Ir a [render.com](https://render.com) → **New** → **Web Service**
2. Conectar el repositorio de GitHub
3. Render detecta `render.yaml` automáticamente — revisar la configuración
4. Configurar las variables marcadas `sync: false` en el dashboard (valores reales de Supabase)
5. Click **Create Web Service** → esperar el build
6. Verificar: `GET https://<url>/health` → `{"status": "ok"}`
7. Actualizar `ALLOWED_ORIGINS` en Render con el dominio de Vercel una vez desplegado el frontend

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

- Acceso: **privado** — URLs firmadas con expiración de **1 hora** (Supabase Signed URLs)
- Solo el backend genera URLs firmadas; el cliente nunca accede directamente al bucket
- **Límite de tamaño por archivo:** 20 MB. Tipos aceptados: `.pdf` únicamente
- Validación de tipo y tamaño se realiza en el backend antes de subir a Storage

---

## Consideraciones para multi-facultad (futuro)

- Agregar `faculty_id` a: `academic_programs`, `modalities`, `date_windows`, `thesis_projects`
- Los usuarios administradores tendrán un `faculty_id` de alcance
- El bucket de Storage se puede particionar por `{faculty_id}/{project_id}/`
- No requiere reescritura estructural, solo agregar el campo y los filtros correspondientes
