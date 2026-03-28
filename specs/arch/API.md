# API.md — Endpoints REST
> Contrato de la API. Todos los endpoints requieren `Authorization: Bearer <JWT>`.
> Login y logout se realizan desde el frontend directamente con el SDK de Supabase Auth — no son endpoints del backend.
> Base URL: `/api/v1`
> Última actualización: 2026-03-28

---

## Convenciones

- Respuestas exitosas: `200 OK` (GET/PUT/PATCH), `201 Created` (POST), `204 No Content` (DELETE)
- Errores: `400` validación, `401` sin autenticación, `403` sin permiso, `404` no encontrado, `409` conflicto de estado
- Paginación: `?page=1&size=20` en listados
- Fechas: ISO 8601 (`2026-03-28T15:00:00Z`)

---

## `/auth`

> Login y logout son llamadas al **SDK de Supabase Auth desde el frontend** (`supabase.auth.signInWithPassword()`, `supabase.auth.signOut()`). No se exponen como endpoints del backend.

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| GET | `/auth/me` | Perfil del usuario autenticado (datos del sistema + rol) | Todos |

---

## `/users`

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| GET | `/users` | Listar usuarios (filtros: rol, activo) | Administrador |
| POST | `/users` | Crear usuario y asignar rol | Administrador |
| GET | `/users/{id}` | Detalle de usuario | Administrador |
| PATCH | `/users/{id}` | Editar datos o rol | Administrador |
| PATCH | `/users/{id}/deactivate` | Desactivar acceso | Administrador |

---

## `/academic-programs`

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| GET | `/academic-programs` | Listar programas | Todos |
| POST | `/academic-programs` | Crear programa | Administrador |
| PATCH | `/academic-programs/{id}` | Editar programa | Administrador |

---

## `/modalities`

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| GET | `/modalities` | Listar modalidades con configuración | Todos |
| POST | `/modalities` | Crear modalidad | Administrador |
| PATCH | `/modalities/{id}` | Editar modalidad (ej. max_members) | Administrador |

---

## `/date-windows`

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| GET | `/date-windows` | Listar ventanas de fechas | Todos |
| POST | `/date-windows` | Crear ventana de fechas | Administrador |
| PATCH | `/date-windows/{id}` | Editar o activar/desactivar ventana | Administrador |
| DELETE | `/date-windows/{id}` | Eliminar ventana (solo si no tiene radicaciones) | Administrador |

---

## `/projects`

### Gestión general

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| GET | `/projects` | Listar trabajos (filtros: estado, modalidad, periodo, programa) | Administrador |
| GET | `/projects/my` | Trabajos del usuario autenticado | Docente, Estudiante |
| POST | `/projects` | Inscribir idea (dentro de ventana activa) | Estudiante |
| GET | `/projects/{id}` | Detalle completo del trabajo | Todos (con pertenencia) |
| PATCH | `/projects/{id}/status` | Cambiar estado (aprobar, rechazar, suspender) | Administrador |

### Integrantes

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| GET | `/projects/{id}/members` | Listar integrantes | Todos (con pertenencia) |
| POST | `/projects/{id}/members` | Agregar integrante (solo antes de anteproyecto aprobado) | Administrador |
| PATCH | `/projects/{id}/members/{memberId}/remove` | Retirar integrante (requiere adjunto con justificación + aval director, multipart/form-data) | Administrador |

### Directores

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| GET | `/projects/{id}/directors` | Listar directores asignados | Todos (con pertenencia) |
| POST | `/projects/{id}/directors` | Asignar director | Administrador |
| DELETE | `/projects/{id}/directors/{directorId}` | Remover director | Administrador |

### Jurados

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| GET | `/projects/{id}/jurors` | Listar jurados (anonimizados para Estudiante) | Todos (con pertenencia) |
| POST | `/projects/{id}/jurors` | Asignar jurado | Administrador |
| DELETE | `/projects/{id}/jurors/{jurorId}` | Remover jurado | Administrador |

---

## `/projects/{id}/submissions`

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| GET | `/projects/{id}/submissions` | Historial de radicaciones | Todos (con pertenencia) |
| POST | `/projects/{id}/submissions` | Crear radicación (valida ventana activa) | Estudiante |
| GET | `/projects/{id}/submissions/{subId}` | Detalle de radicación con adjuntos | Todos (con pertenencia) |

### Adjuntos de una radicación

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| POST | `/projects/{id}/submissions/{subId}/attachments` | Subir adjunto (multipart/form-data) | Estudiante |
| GET | `/projects/{id}/submissions/{subId}/attachments/{attId}` | Descargar/ver adjunto | Todos (con pertenencia) |
| DELETE | `/projects/{id}/submissions/{subId}/attachments/{attId}` | Eliminar adjunto (antes de confirmar radicación) | Estudiante |

---

## `/projects/{id}/evaluations`

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| GET | `/projects/{id}/evaluations` | Listar calificaciones (anonimizadas para Estudiante) | Todos (con pertenencia) |
| POST | `/projects/{id}/evaluations` | Registrar calificación (marca extemporánea si procede) | Docente (Jurado asignado) |
| GET | `/projects/{id}/evaluations/{evalId}` | Detalle de calificación | Administrador, Docente |

---

## `/projects/{id}/sustentation`

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| GET | `/projects/{id}/sustentation` | Detalle de sustentación | Todos (con pertenencia) |
| POST | `/projects/{id}/sustentation` | Registrar fecha, hora y lugar | Administrador |
| PATCH | `/projects/{id}/sustentation` | Registrar calificación de la sustentación | Docente (Jurado asignado), Administrador |

---

## `/projects/{id}/act`

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| GET | `/projects/{id}/act` | Detalle del acta | Todos (con pertenencia) |
| POST | `/projects/{id}/act` | Emitir acta (requiere autorización biblioteca) | Administrador |

---

## `/projects/{id}/extemporaneous-window`

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| POST | `/projects/{id}/extemporaneous-window` | Habilitar ventana extemporánea individual | Administrador |
| DELETE | `/projects/{id}/extemporaneous-window` | Revocar ventana extemporánea | Administrador |

---

## `/projects/{id}/messages`

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| GET | `/projects/{id}/messages` | Bandeja de mensajes del trabajo | Todos (con pertenencia) |
| POST | `/projects/{id}/messages` | Enviar mensaje | Todos (con pertenencia) |
| PATCH | `/projects/{id}/messages/{msgId}/read` | Marcar como leído | Todos (con pertenencia) |

---

## `/projects/{id}/history`

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| GET | `/projects/{id}/history` | Historial de cambios de estado | Todos (con pertenencia) |

---

## `/reports`

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| GET | `/reports/jurors/late` | Jurados con calificaciones extemporáneas | Administrador |
| GET | `/reports/jurors/expiring` | Jurados con plazo próximo a vencer (`?days=N`) | Administrador |
| GET | `/reports/projects` | Proyectos por estado, modalidad, programa, periodo | Administrador |
| GET | `/reports/projects/pending-review` | Proyectos pendientes de evaluación | Administrador |
| GET | `/reports/projects/pending-corrections` | Proyectos con correcciones sin respuesta | Administrador |
| GET | `/reports/docentes/{id}/workload` | Carga de un docente (director + jurado) | Administrador |
| GET | `/reports/students/{id}` | Estado e historial del trabajo de un estudiante | Administrador |
