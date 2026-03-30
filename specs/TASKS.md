# TASKS.md — Plan de tareas del proyecto
> Índice de fases. Cada fase tiene su archivo de detalle en `specs/tasks/`.
> Convención: una tarea = una sesión de agente (atómica, verificable, independiente).
> Última actualización: 2026-03-29

---

## Estado actual

**Tarea activa:** —
**Fase activa:** FASE-03
**Próxima tarea:** `T-F04-01` — Primera tarea de FASE-04: Backend inscripción y evaluación de idea

---

## Fases del proyecto

| Fase | Archivo | Descripción | Tareas | Estado |
|---|---|---|:---:|:---:|
| FASE-01 | [FASE-01.md](tasks/FASE-01.md) | Infraestructura y setup del proyecto | 8 | ✅ |
| FASE-02 | [FASE-02.md](tasks/FASE-02.md) | Base de datos: esquema y migraciones | 12 | ✅ |
| FASE-03 | [FASE-03.md](tasks/FASE-03.md) | Backend: Auth, usuarios y parámetros del sistema | 9 | ✅ |
| FASE-04 | [FASE-04.md](tasks/FASE-04.md) | Backend: Inscripción y evaluación de idea | 8 | ⬜ |
| FASE-05 | [FASE-05.md](tasks/FASE-05.md) | Backend: Anteproyecto (radicación, evaluación, correcciones) | 10 | ⬜ |
| FASE-06 | [FASE-06.md](tasks/FASE-06.md) | Backend: Producto final y evaluación | 11 | ⬜ |
| FASE-07 | [FASE-07.md](tasks/FASE-07.md) | Backend: Sustentación, acta y plagio | 9 | ⬜ |
| FASE-08 | [FASE-08.md](tasks/FASE-08.md) | Backend: Mensajería, historial y reportes | 11 | ⬜ |
| FASE-09 | [FASE-09.md](tasks/FASE-09.md) | Frontend: Base, autenticación y panel de administrador | 16 | ⬜ |
| FASE-10 | [FASE-10.md](tasks/FASE-10.md) | Frontend: Vistas de estudiante y docente | 13 | ⬜ |
| FASE-11 | [FASE-11.md](tasks/FASE-11.md) | Testing, integración y deploy | 9 | ⬜ |

**Total tareas:** 116

---

## Leyenda de estado

| Símbolo | Significado |
|---|---|
| ⬜ | Pendiente |
| 🔄 | En progreso |
| ✅ | Completada |
| ⏸ | Bloqueada (esperando dependencia) |

---

## Completadas

- `T-F01-01` — Inicializar estructura de carpetas del proyecto — 2026-03-29
- `T-F01-02` — Configurar proyecto backend (FastAPI) — 2026-03-29
- `T-F01-03` — Configurar proyecto frontend (React + Vite) — 2026-03-29
- `T-F01-04` — Configurar Supabase (proyecto + Auth + Storage) — 2026-03-29
- `T-F01-05` — Configurar variables de entorno locales — 2026-03-29
- `T-F01-06` — Configurar middleware de autenticación JWT en FastAPI — 2026-03-29
- `T-F01-07` — Crear utilidad de cálculo de días hábiles — 2026-03-29
- `T-F01-08` — Crear archivo de festivos USC (USC_HOLIDAYS_FILE) — 2026-03-29
- `T-F02-01` a `T-F02-12` — FASE-02: Base de datos (ENUMs, tablas, índices) — 2026-03-29
- `T-F03-01` — Implementar `GET /auth/me` — 2026-03-29
- `T-F03-02` — Implementar CRUD de usuarios (`/users`) — 2026-03-29
- `T-F03-03` — Implementar desactivación de docentes (`PATCH /users/{id}/deactivate`) — 2026-03-29
- `T-F03-04` — Implementar CRUD de programas académicos (`/academic-programs`) — 2026-03-29
- `T-F03-05` — Implementar CRUD de modalidades y límites (`/modalities`) — 2026-03-29
- `T-F03-06` — Implementar CRUD de ventanas de fechas (`/date-windows`) — 2026-03-29
- `T-F03-07` — Implementar ventanas extemporáneas (`/projects/{id}/extemporaneous-window`) — 2026-03-29
- `T-F03-08` — Implementar recuperación de contraseña (Supabase Auth) — 2026-03-29
- `T-F03-09` — Tests de integración: endpoints de users y configuración — 2026-03-29

---

## Notas de planificación

- Las fases FASE-01 a FASE-08 corresponden al **backend** (FastAPI + BD).
- Las fases FASE-09 a FASE-10 corresponden al **frontend** (React + Vite).
- FASE-11 cubre **testing** (unitario + integración) y **deploy** (Vercel + Render).
- Dentro de cada fase, las tareas deben ejecutarse en el orden listado salvo que se indique lo contrario.
- Las reglas de negocio de cada tarea se documentan en `specs/prd/` (MOD-XX).
- Los contratos de API están en `specs/arch/API.md`.
- Las entidades de BD están en `specs/arch/DATA-MODEL.md`.
- Los valores enum están en `specs/arch/ENUMS.md`.
