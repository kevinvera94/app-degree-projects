# app-degree-projects

Sistema web para la gestión integral de trabajos de grado de la Facultad de Ingeniería de la Universidad Santiago de Cali (USC).

Cubre el ciclo de vida completo: inscripción de idea → anteproyecto → producto final → sustentación → acta de aprobación.

> Descripción completa del proceso, roles y reglas de negocio: [`specs/BRIEF.md`](specs/BRIEF.md)

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React + Vite + TypeScript + Tailwind CSS |
| Backend | FastAPI (Python 3.11) |
| Base de datos | Supabase (PostgreSQL) |
| Autenticación | Supabase Auth (JWT HS256) |
| Almacenamiento | Supabase Storage |
| Deploy backend | Render |
| Deploy frontend | Vercel |

---

## Requisitos previos

| Herramienta | Versión mínima |
|---|---|
| Python | 3.11 |
| Node.js | 18 |
| npm | 9 |
| Cuenta Supabase | — (proyecto gratuito es suficiente para dev) |
| Cuenta Render | — (solo para deploy) |
| Cuenta Vercel | — (solo para deploy) |

---

## Setup local

### 1. Clonar el repositorio

```bash
git clone https://github.com/kevinvera94/app-degree-projects.git
cd app-degree-projects
```

### 2. Configurar el backend

```bash
cd backend

# Crear y activar entorno virtual
python3 -m venv .venv
source .venv/bin/activate          # Linux / macOS
# .venv\Scripts\activate           # Windows

# Instalar dependencias
pip install -r requirements.txt

# Configurar variables de entorno
cp .env.example .env
# Editar .env con los valores reales del proyecto Supabase
```

Ver [`backend/.env.example`](backend/.env.example) para la descripción de cada variable.

Levantar el servidor de desarrollo:

```bash
uvicorn app.main:app --reload
# API disponible en http://localhost:8000
# Documentación interactiva: http://localhost:8000/docs
```

### 3. Configurar el frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con la URL del backend y las claves públicas de Supabase
```

Ver [`frontend/.env.example`](frontend/.env.example) para la descripción de cada variable.

Levantar el servidor de desarrollo:

```bash
npm run dev
# App disponible en http://localhost:5173
```

---

## Tests

### Backend (pytest)

```bash
cd backend
source .venv/bin/activate

# Correr toda la suite
pytest

# Con reporte de cobertura
pytest --cov=app --cov-report=html
# Reporte HTML generado en backend/htmlcov/index.html
```

### Frontend — tests E2E (Playwright)

```bash
cd frontend

# Instalar browsers de Playwright (solo la primera vez)
npx playwright install

# Correr la suite E2E (requiere backend y frontend levantados en local)
npm run test:e2e

# Ver reporte interactivo después de ejecutar
npm run test:e2e:report

# Modo UI (útil para depurar)
npm run test:e2e:ui
```

> Los tests E2E requieren credenciales reales en `frontend/e2e/.env.e2e`. Ver [`specs/tasks/FASE-11.md`](specs/tasks/FASE-11.md) para detalle de la configuración.

---

## Deploy

### Backend — Render

1. Crear un nuevo **Web Service** en [render.com](https://render.com) conectado al repositorio
2. Render detecta `render.yaml` automáticamente — revisar la configuración propuesta
3. Configurar las variables marcadas `sync: false` en el dashboard de Render (valores reales de Supabase)
4. Hacer deploy — verificar: `GET https://<servicio>.onrender.com/health` → `{"status": "ok"}`
5. Actualizar `ALLOWED_ORIGINS` con el dominio de Vercel una vez desplegado el frontend

Guía completa: [`specs/arch/INFRA.md`](specs/arch/INFRA.md)

### Frontend — Vercel

1. Importar el repositorio en [vercel.com](https://vercel.com)
2. Framework preset: **Vite** | Build command: `npm run build` | Output: `dist`
3. Configurar las tres variables de entorno (`VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
4. Deploy — la app queda disponible en el dominio asignado por Vercel

### URLs de producción

| Servicio | URL |
|---|---|
| Frontend | https://app-degree-projects.vercel.app |
| Backend | https://app-degree-projects.onrender.com |
| API Docs | https://app-degree-projects.onrender.com/docs |

---

## Documentación del proyecto

| Documento | Contenido |
|---|---|
| [`specs/BRIEF.md`](specs/BRIEF.md) | Fuente de verdad: descripción, roles, flujo completo y reglas de negocio |
| [`specs/PRD.md`](specs/PRD.md) | Requerimientos funcionales por módulo (MOD-01 a MOD-17) |
| [`specs/ARCHITECTURE.md`](specs/ARCHITECTURE.md) | Stack, principios técnicos y referencias a modelo de datos, API y auth |
| [`specs/arch/API.md`](specs/arch/API.md) | Contrato REST completo por router |
| [`specs/arch/DATA-MODEL.md`](specs/arch/DATA-MODEL.md) | Entidades, campos y relaciones de la base de datos |
| [`specs/arch/AUTH.md`](specs/arch/AUTH.md) | Estrategia JWT, roles y matriz de permisos |
| [`specs/arch/INFRA.md`](specs/arch/INFRA.md) | Variables de entorno, despliegue y estructura de carpetas |
| [`specs/arch/RNF.md`](specs/arch/RNF.md) | Requerimientos no funcionales |
| [`specs/TASKS.md`](specs/TASKS.md) | Plan de tareas por fases — estado del proyecto |
| [`specs/DESIGN.md`](specs/DESIGN.md) | Paleta de colores e identidad visual USC |

---

## Estructura del repositorio

```
app-degree-projects/
  specs/                ← documentación completa del proyecto
    prd/                ← requerimientos funcionales (MOD-01 … MOD-17)
    arch/               ← arquitectura técnica (API, datos, auth, infra, RNF)
    tasks/              ← detalle de tareas por fase
  frontend/             ← React + Vite + TypeScript
    src/
      components/       ← componentes reutilizables (ui/, layout/, forms/)
      pages/            ← vistas por rol (admin/, estudiante/, docente/, auth/)
      hooks/            ← custom hooks
      services/         ← llamadas a la API
      types/            ← tipos e interfaces TypeScript
      utils/            ← helpers de fechas, formato y validación
    e2e/                ← tests Playwright
  backend/              ← FastAPI (Python)
    app/
      routers/          ← endpoints REST por recurso
      schemas/          ← schemas Pydantic (request / response)
      services/         ← lógica de negocio
      models/           ← modelos SQLAlchemy
      core/             ← config, auth, database, dependencies
      utils/            ← cálculo de días hábiles, storage
      data/             ← festivos USC (usc_holidays.json)
    tests/              ← suite pytest
  render.yaml           ← configuración declarativa de Render
  CLAUDE.md             ← instrucciones para el agente Claude Code
```
