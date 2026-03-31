# TASKS.md — Plan de tareas del proyecto
> Índice de fases. Cada fase tiene su archivo de detalle en `specs/tasks/`.
> Convención: una tarea = una sesión de agente (atómica, verificable, independiente).
> Última actualización: 2026-03-29

---

## Estado actual

**Tarea activa:** —
**Fase activa:** FASE-08
**Próxima tarea:** `T-F08-07` — Implementar fichas individuales (estudiante y proyecto)

---

## Fases del proyecto

| Fase | Archivo | Descripción | Tareas | Estado |
|---|---|---|:---:|:---:|
| FASE-01 | [FASE-01.md](tasks/FASE-01.md) | Infraestructura y setup del proyecto | 8 | ✅ |
| FASE-02 | [FASE-02.md](tasks/FASE-02.md) | Base de datos: esquema y migraciones | 12 | ✅ |
| FASE-03 | [FASE-03.md](tasks/FASE-03.md) | Backend: Auth, usuarios y parámetros del sistema | 9 | ✅ |
| FASE-04 | [FASE-04.md](tasks/FASE-04.md) | Backend: Inscripción y evaluación de idea | 8 | ✅ |
| FASE-05 | [FASE-05.md](tasks/FASE-05.md) | Backend: Anteproyecto (radicación, evaluación, correcciones) | 10 | ✅ |
| FASE-06 | [FASE-06.md](tasks/FASE-06.md) | Backend: Producto final y evaluación | 11 | ✅ |
| FASE-07 | [FASE-07.md](tasks/FASE-07.md) | Backend: Sustentación, acta y plagio | 9 | ✅ |
| FASE-08 | [FASE-08.md](tasks/FASE-08.md) | Backend: Mensajería, historial y reportes | 11 | 🔄 |
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
- `T-F04-01` — Implementar inscripción de idea (`POST /projects`) — 2026-03-29
- `T-F04-02` — Listado y detalle de proyectos (`GET /projects`, `/my`, `/{id}`) — 2026-03-29
- `T-F04-03` — Aprobación de idea con asignación de director — 2026-03-29
- `T-F04-04` — Implementar rechazo de idea — 2026-03-29
- `T-F04-05` — Gestión de integrantes (`GET/POST /projects/{id}/members`) — 2026-03-29
- `T-F04-06` — Retiro de integrante (`PATCH /members/{id}/remove`, multipart+Storage) — 2026-03-29
- `T-F04-07` — Cancelación de proyecto (action=cancelar) — 2026-03-29
- `T-F04-08` — Tests de integración: inscripción y evaluación de idea — 2026-03-29
- `T-F05-01` — Implementar radicación de anteproyecto y adjuntos (`POST /submissions`, `PATCH /confirm`) — 2026-03-29
- `T-F05-02` — Implementar asignación de jurados al anteproyecto (`POST/GET/DELETE /projects/{id}/jurors`) — 2026-03-29
- `T-F05-03` — Implementar registro de calificación de jurado (anteproyecto) — 2026-03-30
- `T-F05-04` — Implementar lógica de resultado del anteproyecto (evaluate_anteproyecto_result) — 2026-03-30
- `T-F05-05` — Implementar asignación y registro de Jurado 3 (anteproyecto) — 2026-03-30
- `T-F05-06` — Implementar entrega de correcciones del anteproyecto — 2026-03-30
- `T-F05-07` — Implementar lógica de bloqueo por incumplimiento de correcciones — 2026-03-30
- `T-F05-08` — Implementar segunda revisión del anteproyecto — 2026-03-30
- `T-F05-09` — Implementar historial de radicaciones y adjuntos — 2026-03-30
- `T-F05-10` — Tests de integración: flujo completo del anteproyecto — 2026-03-30
- `T-F06-01` — Implementar radicación de producto final — 2026-03-30
- `T-F06-02` — Implementar asignación de jurados al producto final — 2026-03-30
- `T-F06-03` — Implementar registro de calificación del producto final — 2026-03-30
- `T-F06-04` — Implementar lógica de resultado del producto final — 2026-03-30
- `T-F06-05` — Implementar Jurado 3 para producto final — 2026-03-30
- `T-F06-06` — Implementar correcciones del producto final — 2026-03-30
- `T-F06-07` — Implementar segunda revisión del producto final — 2026-03-30
- `T-F06-08` — Implementar suspensión por plagio — 2026-03-30
- `T-F06-09` — Tests de integración: producto final y correcciones — 2026-03-30
- `T-F06-10` — Implementar señales de estado para el Administrador — 2026-03-30
- `T-F06-11` — Implementar reporte de correcciones sin respuesta — 2026-03-30
- `T-F07-01` — Implementar registro de sustentación — 2026-03-30
- `T-F07-02` — Implementar registro de calificaciones de sustentación — 2026-03-30
- `T-F07-03` — Implementar restricción de Jurado 3 en sustentación — 2026-03-30
- `T-F07-04` — Implementar autorización de biblioteca — 2026-03-30
- `T-F07-05` — Implementar emisión del acta — 2026-03-30
- `T-F07-06` — Implementar asignación de jurados para sustentación — 2026-03-30
- `T-F07-07` — Tests de integración: sustentación y acta — 2026-03-30
- `T-F07-08` — Implementar reporte de jurados con calificaciones extemporáneas — 2026-03-30
- `T-F07-09` — Implementar alerta de vencimiento próximo de jurados — 2026-03-30
- `T-F08-01` — Implementar bandeja de mensajes (`GET/POST /projects/{id}/messages`) — 2026-03-30
- `T-F08-02` — Implementar marcar mensaje como leído — 2026-03-30
- `T-F08-03` — Implementar conteo de mensajes no leídos para badge en UI — 2026-03-30
- `T-F08-04` — Implementar historial de cambios de estado — 2026-03-30
- `T-F08-05` — Implementar reportes principales de proyectos — 2026-03-30
- `T-F08-06` — Implementar reporte de carga docente — 2026-03-30

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
