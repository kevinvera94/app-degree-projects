# FASE-11 — Testing, integración y deploy
> Parte del plan de tareas. Ver índice en `specs/TASKS.md`.
> Objetivo: garantizar la calidad del sistema mediante pruebas automatizadas, validar la integración end-to-end y desplegar el sistema en los entornos de producción (Vercel + Render).

---

## Notas de fase

- Los tests unitarios y de integración del backend ya se crean en cada fase (FASE-03 a FASE-08). Esta fase cubre la configuración del entorno de tests, el reporte de cobertura y los tests E2E de regresión.
- El deploy es manual para el MVP; no se configura CI/CD automático en esta fase.

---

## Tareas

### T-F11-01 — Configurar entorno de tests del backend (pytest)
- **Módulo(s):** Todos
- **Referencias:** `specs/arch/INFRA.md`
- **Descripción:** Configurar pytest con base de datos de test aislada y fixtures comunes.
- **Criterios de aceptación:**
  - [x] `pytest` y `httpx` instalados (para `TestClient` de FastAPI)
  - [x] `conftest.py` en `backend/tests/` con fixtures: `test_client`, `db_session`, `admin_token`, `docente_token`, `estudiante_token`
  - [x] BD de test separada (AsyncMock para tests unitarios puros; sin BD real requerida)
  - [x] Comando `pytest` desde `backend/` corre todos los tests y reporta resultados (91 passed)
  - [ ] Cobertura mínima objetivo: 70% de líneas del backend (actual: 65% — se cierra en T-F11-02)
  - [x] `pytest.ini` o `pyproject.toml` con configuración de test (directorio, patrones)
- **Dependencias:** T-F08-11
- **Estado:** ✅ Completada

---

### T-F11-02 — Ejecutar y corregir todos los tests del backend
- **Módulo(s):** Todos
- **Referencias:** —
- **Descripción:** Ejecutar la suite completa de tests del backend y corregir los fallos encontrados antes de pasar al deploy.
- **Criterios de aceptación:**
  - [ ] `pytest` pasa al 100% (0 fallos, 0 errores)
  - [ ] Tests cubiertos (de fases anteriores): `test_config.py`, `test_ideas.py`, `test_anteproyecto.py`, `test_producto_final.py`, `test_sustentacion.py`, `test_messaging_reports.py`
  - [ ] Reporte de cobertura generado con `pytest --cov`
  - [ ] Cobertura ≥ 70% en servicios de negocio críticos: `business_days.py`, servicios de evaluación, servicios de notificaciones
- **Dependencias:** T-F11-01
- **Estado:** ⬜ Pendiente

---

### T-F11-03 — Configurar entorno de tests E2E (Playwright)
- **Módulo(s):** Todos
- **Referencias:** —
- **Descripción:** Configurar Playwright para tests E2E contra el entorno de desarrollo local.
- **Criterios de aceptación:**
  - [ ] `@playwright/test` instalado en `frontend/`
  - [ ] `playwright.config.ts` configurado para correr contra `localhost:5173` (backend en `localhost:8000`)
  - [ ] Fixtures de autenticación por rol: `adminPage`, `docentePage`, `estudiantePage`
  - [ ] Comando `npx playwright test` desde `frontend/` corre la suite
  - [ ] CI-ready: tests pueden ejecutarse en modo headless
- **Dependencias:** T-F10-13
- **Estado:** ⬜ Pendiente

---

### T-F11-04 — Ejecutar y corregir todos los tests E2E
- **Módulo(s):** Todos
- **Referencias:** —
- **Descripción:** Ejecutar la suite completa de tests E2E (creados en FASE-09 y FASE-10) y corregir los fallos.
- **Criterios de aceptación:**
  - [ ] Todos los tests E2E definidos en T-F09-16 y T-F10-13 pasan al 100%
  - [ ] Happy path completo (inscripción → acta generada) pasa sin errores
  - [ ] Anonimato de jurados verificado en todos los escenarios E2E
  - [ ] Tests E2E de Diplomado tecnológico (sin sustentación) pasan correctamente
  - [ ] Reporte de resultados guardado en `frontend/playwright-report/`
- **Dependencias:** T-F11-03
- **Estado:** ⬜ Pendiente

---

### T-F11-05 — Preparar variables de entorno de producción
- **Módulo(s):** —
- **Referencias:** `specs/arch/INFRA.md`
- **Descripción:** Configurar las variables de entorno para los entornos de producción en Render (backend) y Vercel (frontend).
- **Criterios de aceptación:**
  - [ ] Variables de entorno configuradas en Render (backend): `SUPABASE_URL`, `SUPABASE_JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_STORAGE_BUCKET`, `DATABASE_URL`, `USC_HOLIDAYS_FILE`, `ALLOWED_ORIGINS`, `APP_ENV`, `SECRET_KEY`, `JUROR_EXPIRY_ALERT_DAYS`
  - [ ] Variables de entorno configuradas en Vercel (frontend): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL` (URL de Render)
  - [ ] `ALLOWED_ORIGINS` en backend incluye el dominio de Vercel
  - [ ] El archivo `USC_HOLIDAYS_FILE` está disponible en el entorno de Render (como variable de entorno con JSON incrustado o path de archivo incluido en el build)
  - [ ] Documentado en `specs/arch/INFRA.md` el listado de variables por entorno (sin valores reales)
- **Dependencias:** T-F11-02
- **Estado:** ⬜ Pendiente

---

### T-F11-06 — Deploy del backend en Render
- **Módulo(s):** —
- **Referencias:** `specs/arch/INFRA.md`
- **Descripción:** Desplegar el backend FastAPI en Render y verificar que todos los endpoints responden correctamente.
- **Criterios de aceptación:**
  - [ ] Servicio creado en Render con tipo "Web Service"
  - [ ] Build command: `pip install -r requirements.txt`
  - [ ] Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
  - [ ] `GET https://<render-url>/health` → `200 { "status": "ok" }`
  - [ ] `GET https://<render-url>/docs` → Swagger UI accesible
  - [ ] `GET https://<render-url>/api/v1/auth/me` con JWT válido → respuesta correcta (verificar que la BD de producción es accesible)
  - [ ] URL del backend documentada en `specs/arch/INFRA.md`
- **Dependencias:** T-F11-05
- **Estado:** ⬜ Pendiente

---

### T-F11-07 — Deploy del frontend en Vercel
- **Módulo(s):** —
- **Referencias:** `specs/arch/INFRA.md`
- **Descripción:** Desplegar el frontend React en Vercel y verificar el flujo de autenticación en producción.
- **Criterios de aceptación:**
  - [ ] Proyecto creado en Vercel conectado al repositorio de GitHub
  - [ ] Framework preset: Vite
  - [ ] Build command: `npm run build`
  - [ ] Output directory: `dist`
  - [ ] Variables de entorno de producción configuradas en Vercel (T-F11-05)
  - [ ] `https://<vercel-url>` carga la pantalla de login sin errores en consola
  - [ ] Login con usuario administrador funciona correctamente en producción
  - [ ] URL del frontend documentada en `specs/arch/INFRA.md`
- **Dependencias:** T-F11-06
- **Estado:** ⬜ Pendiente

---

### T-F11-08 — Prueba de smoke test en producción
- **Módulo(s):** Todos
- **Referencias:** —
- **Descripción:** Prueba manual del flujo completo en el entorno de producción para verificar que backend y frontend funcionan integrados.
- **Criterios de aceptación:**
  - [ ] Login como Admin en producción ✅
  - [ ] Crear usuario Docente y Estudiante en producción ✅
  - [ ] Crear ventana de fechas activa ✅
  - [ ] Estudiante inscribe idea → Admin aprueba → Estudiante radica anteproyecto ✅
  - [ ] Admin asigna jurados → Jurado registra calificación → Transición de estado correcta ✅
  - [ ] Subida y descarga de archivos en Supabase Storage funciona en producción ✅
  - [ ] Mensajería funciona entre roles ✅
  - [ ] No hay errores CORS en producción ✅
- **Dependencias:** T-F11-07
- **Estado:** ⬜ Pendiente

---

### T-F11-09 — Documentación de operación y README final
- **Módulo(s):** —
- **Referencias:** `specs/BRIEF.md`, `specs/ARCHITECTURE.md`
- **Descripción:** Actualizar el README del proyecto con instrucciones de setup, desarrollo y deploy para nuevos integrantes del equipo.
- **Criterios de aceptación:**
  - [ ] `README.md` en la raíz con secciones:
    - Descripción del proyecto (enlace a `specs/BRIEF.md`)
    - Stack tecnológico
    - Requisitos previos (Python, Node, cuenta Supabase)
    - Setup local paso a paso (backend y frontend)
    - Variables de entorno requeridas (enlace a `.env.example`)
    - Cómo correr los tests (`pytest`, `playwright test`)
    - Cómo hacer deploy (Render + Vercel)
    - Enlace a la documentación de specs (`specs/TASKS.md`, `specs/PRD.md`, `specs/ARCHITECTURE.md`)
  - [ ] `README.md` en `backend/` con comandos de desarrollo
  - [ ] `README.md` en `frontend/` con comandos de desarrollo
- **Dependencias:** T-F11-08
- **Estado:** ⬜ Pendiente
