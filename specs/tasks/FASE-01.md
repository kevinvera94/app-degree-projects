# FASE-01 — Infraestructura y setup del proyecto
> Parte del plan de tareas. Ver índice en `specs/TASKS.md`.
> Objetivo: dejar el repositorio con estructura de carpetas, tooling y entornos configurados para que backend y frontend puedan desarrollarse sin fricciones.

---

## Tareas

### T-F01-01 — Inicializar estructura de carpetas del proyecto
- **Módulo(s):** —
- **Referencias:** `specs/ARCHITECTURE.md` (sección Estructura de carpetas)
- **Descripción:** Crear la estructura de directorios definitiva: `frontend/`, `backend/`, con sus subcarpetas según la convención de arquitectura. Inicializar `README.md` con descripción básica del proyecto.
- **Criterios de aceptación:**
  - [ ] Carpetas `frontend/src/{components,pages,hooks,services,utils,types}` creadas
  - [ ] Carpetas `backend/app/{routers,models,schemas,services,core,utils}` creadas
  - [ ] `README.md` en la raíz con nombre del proyecto, stack y enlace a `specs/BRIEF.md`
  - [ ] `.gitignore` actualizado con patrones para Python (`.venv`, `__pycache__`, `.env`) y Node (`node_modules`, `dist`, `.env.local`)
- **Dependencias:** —
- **Estado:** ⬜ Pendiente

---

### T-F01-02 — Configurar proyecto backend (FastAPI)
- **Módulo(s):** —
- **Referencias:** `specs/arch/INFRA.md`
- **Descripción:** Inicializar proyecto Python con `uv` o `pip`. Instalar dependencias base: `fastapi`, `uvicorn`, `pydantic`, `python-jose`, `asyncpg`, `supabase-py`, `python-multipart`, `black`, `flake8`. Crear `requirements.txt` o `pyproject.toml`.
- **Criterios de aceptación:**
  - [ ] `backend/requirements.txt` (o `pyproject.toml`) con todas las dependencias listadas
  - [ ] `backend/app/main.py` con instancia de FastAPI, CORS configurado para `localhost:5173` y ruta de health check `GET /health → 200 { "status": "ok" }`
  - [ ] Servidor arranca con `uvicorn app.main:app --reload` sin errores
  - [ ] `black` y `flake8` configurados (archivos `pyproject.toml` / `.flake8`)
- **Dependencias:** T-F01-01
- **Estado:** ⬜ Pendiente

---

### T-F01-03 — Configurar proyecto frontend (React + Vite)
- **Módulo(s):** —
- **Referencias:** `specs/arch/INFRA.md`, `specs/DESIGN.md`
- **Descripción:** Inicializar proyecto React con Vite. Instalar dependencias base: `react-router-dom`, `axios`, `@supabase/supabase-js`, `tailwindcss` (o librería de estilos acordada). Configurar paleta de colores USC.
- **Criterios de aceptación:**
  - [ ] `frontend/package.json` con todas las dependencias
  - [ ] Vite arranca en `localhost:5173` sin errores
  - [ ] Ruta de prueba `/` muestra página básica
  - [ ] Paleta USC configurada en Tailwind (o CSS variables): `--usc-navy: #0D2B5E`, `--usc-blue: #1B6BB5`, `--usc-gold: #C9A840`, `--usc-gold-light: #F0D269`, `--usc-warning: #F59E0B`
  - [ ] ESLint + Prettier configurados con reglas básicas
- **Dependencias:** T-F01-01
- **Estado:** ⬜ Pendiente

---

### T-F01-04 — Configurar Supabase (proyecto + Auth + Storage)
- **Módulo(s):** MOD-01
- **Referencias:** `specs/arch/INFRA.md`, `specs/arch/AUTH.md`
- **Descripción:** Crear proyecto en Supabase (o verificar que existe). Habilitar Auth con proveedor email/password. Crear bucket de Storage `attachments` con política de acceso privado (solo URLs firmadas). Obtener y documentar `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`.
- **Criterios de aceptación:**
  - [ ] Proyecto Supabase creado y accesible
  - [ ] Auth habilitado con email/password
  - [ ] Bucket `attachments` creado con acceso privado
  - [ ] Variables documentadas en `specs/arch/INFRA.md` (sin valores reales; solo nombres de variables)
  - [ ] Archivo `.env.example` en `backend/` y `frontend/` con todas las variables necesarias (sin valores reales)
- **Dependencias:** T-F01-01
- **Estado:** ⬜ Pendiente

---

### T-F01-05 — Configurar variables de entorno locales
- **Módulo(s):** —
- **Referencias:** `specs/arch/INFRA.md`
- **Descripción:** Crear archivos `.env` locales (no comiteados) para backend y frontend con los valores reales de Supabase y configuración de desarrollo.
- **Criterios de aceptación:**
  - [ ] `backend/.env` con: `SUPABASE_URL`, `SUPABASE_JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `USC_HOLIDAYS_FILE`
  - [ ] `frontend/.env.local` con: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL=http://localhost:8000/api/v1`
  - [ ] Backend puede conectarse a la BD de Supabase desde local
  - [ ] Frontend puede inicializar el cliente Supabase desde local
- **Dependencias:** T-F01-04
- **Estado:** ⬜ Pendiente

---

### T-F01-06 — Configurar middleware de autenticación JWT en FastAPI
- **Módulo(s):** MOD-01
- **Referencias:** `specs/arch/AUTH.md` (sección Dependencias de seguridad)
- **Descripción:** Implementar las dependencias de seguridad de FastAPI: `get_current_user`, `require_admin`, `require_docente`, `require_project_member`. Verificar JWT HS256 con `SUPABASE_JWT_SECRET`. Extraer `sub`, `role`, `email` del token.
- **Criterios de aceptación:**
  - [ ] `backend/app/core/dependencies.py` con las 4 funciones de seguridad documentadas en AUTH.md
  - [ ] Request sin JWT → `401 Unauthorized`
  - [ ] Request con JWT de rol equivocado → `403 Forbidden`
  - [ ] Request con JWT válido → usuario extraído correctamente
  - [ ] Tests unitarios de `get_current_user` con tokens válidos e inválidos
- **Dependencias:** T-F01-02, T-F01-05
- **Estado:** ⬜ Pendiente

---

### T-F01-07 — Crear utilidad de cálculo de días hábiles
- **Módulo(s):** MOD-06, MOD-07, MOD-10, MOD-11, MOD-17
- **Referencias:** `specs/arch/INFRA.md` (sección USC_HOLIDAYS_FILE), `specs/BRIEF.md` §9
- **Descripción:** Implementar `backend/app/utils/business_days.py` con función `add_business_days(start_date, days, period)` que excluye fines de semana y festivos del calendario USC según el archivo `USC_HOLIDAYS_FILE` configurable por periodo.
- **Criterios de aceptación:**
  - [ ] Función `add_business_days(start: date, n: int, period: str) -> date` implementada
  - [ ] Función `count_business_days_between(start: date, end: date, period: str) -> int` implementada
  - [ ] Función `is_overdue(deadline: date, submitted_at: datetime, period: str) -> bool` implementada
  - [ ] Carga de `USC_HOLIDAYS_FILE` JSON por periodo (formato documentado en INFRA.md)
  - [ ] Tests unitarios con fechas que crucen festivos y fines de semana
- **Dependencias:** T-F01-02
- **Estado:** ⬜ Pendiente

---

### T-F01-08 — Crear archivo de festivos USC (USC_HOLIDAYS_FILE)
- **Módulo(s):** MOD-06, MOD-07, MOD-10, MOD-11
- **Referencias:** `specs/arch/INFRA.md` (sección USC_HOLIDAYS_FILE)
- **Descripción:** Crear el archivo JSON de festivos USC para los periodos académicos 2025-1, 2025-2 y 2026-1, siguiendo el formato definido en INFRA.md (festivos nacionales de Colombia + días no hábiles propios de la USC).
- **Criterios de aceptación:**
  - [ ] Archivo `backend/app/data/usc_holidays.json` creado con periodos 2025-1, 2025-2 y 2026-1
  - [ ] Incluye festivos nacionales de Colombia según Ley 51/1983 y normas concordantes
  - [ ] Ruta del archivo configurada en `USC_HOLIDAYS_FILE` (variable de entorno)
  - [ ] La utilidad `business_days.py` lo carga correctamente
- **Dependencias:** T-F01-07
- **Estado:** ⬜ Pendiente
