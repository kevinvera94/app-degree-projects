# FASE-08 — Backend: Mensajería, historial y reportes
> Parte del plan de tareas. Ver índice en `specs/TASKS.md`.
> Módulos cubiertos: MOD-15, MOD-16, MOD-17.
> Objetivo: implementar la bandeja de mensajes asíncrona con anonimato de jurados, los endpoints de historial de trazabilidad, y los reportes restantes del sistema.

---

## Notas de fase

- Los mensajes automáticos generados por el sistema en fases anteriores (notificaciones de cambio de estado, calificaciones, correcciones) **ya utilizan** la tabla `messages` (nombre exacto en DATA-MODEL). Esta fase implementa los endpoints de lectura y escritura manual.
- El anonimato del jurado en mensajería se implementa en el campo `sender_display` de la tabla, no en la capa de presentación.

---

## Tareas

### T-F08-01 — Implementar bandeja de mensajes (`GET/POST /projects/{id}/messages`)
- **Módulo(s):** MOD-15
- **Referencias:** `specs/arch/API.md` §/projects/{id}/messages, RF-15-01..RF-15-09
- **Descripción:** Endpoints para leer y enviar mensajes de la bandeja de un trabajo de grado.
- **Criterios de aceptación:**
  - [ ] `GET /api/v1/projects/{id}/messages` → `200` lista de mensajes del trabajo, ordenados por `created_at` DESC (todos con pertenencia)
  - [ ] Cada mensaje incluye: `id`, `sender_display`, `content`, `is_read`, `created_at`
  - [ ] El campo `sender_display` muestra el nombre real si el emisor es Administrador o Director; muestra "Jurado 1" o "Jurado 2" si es Jurado (determinado por `project_jurors`)
  - [ ] `POST /api/v1/projects/{id}/messages` body: `{ content, recipient_id? }` → `201` (todos con pertenencia)
  - [ ] Valida que el emisor tenga pertenencia activa en el proyecto → `403`
  - [ ] Valida reglas de mensajería por rol (RF-15-02..RF-15-07): Estudiante → Director o Jurado; Director → Estudiante o Admin; Jurado → Estudiante; Admin → cualquiera → `403` si la combinación emisor/receptor no está permitida
  - [ ] Al enviar: si el receptor es el Estudiante y el emisor es Jurado, `sender_display = "Jurado N"` (anonimato)
  - [ ] Mensaje creado en `project_messages` con `is_read = false` para el receptor
- **Dependencias:** T-F02-11, T-F04-01
- **Estado:** ⬜ Pendiente

---

### T-F08-02 — Implementar marcar mensaje como leído
- **Módulo(s):** MOD-15
- **Referencias:** `specs/arch/API.md` §/projects/{id}/messages, RF-15-01
- **Descripción:** El receptor puede marcar un mensaje como leído.
- **Criterios de aceptación:**
  - [ ] `PATCH /api/v1/projects/{id}/messages/{msgId}/read` → `200` (todos con pertenencia)
  - [ ] Solo el receptor del mensaje puede marcarlo como leído → `403` si el solicitante no es el `recipient_id`
  - [ ] Actualiza `project_messages.is_read = true`
  - [ ] Si el mensaje ya está leído: idempotente → `200`
- **Dependencias:** T-F08-01
- **Estado:** ⬜ Pendiente

---

### T-F08-03 — Implementar conteo de mensajes no leídos para badge en UI
- **Módulo(s):** MOD-15
- **Referencias:** RF-15-09
- **Descripción:** Endpoint auxiliar que retorna el número de mensajes no leídos del usuario autenticado, para mostrar el badge en la interfaz.
- **Criterios de aceptación:**
  - [ ] `GET /api/v1/messages/unread-count` → `200 { "unread": N }` (todos los roles)
  - [ ] Cuenta mensajes en `project_messages` donde `recipient_id = current_user.id` Y `is_read = false`
  - [ ] Respuesta eficiente (COUNT query, no traer todos los mensajes)
- **Dependencias:** T-F08-02
- **Estado:** ⬜ Pendiente

---

### T-F08-04 — Implementar historial de cambios de estado (`GET /projects/{id}/history`)
- **Módulo(s):** MOD-16
- **Referencias:** `specs/arch/API.md` §/projects/{id}/history, RF-16-01..RF-16-06
- **Descripción:** Endpoint que retorna el historial cronológico de todos los eventos de un proyecto: cambios de estado, documentos adjuntos y calificaciones.
- **Criterios de aceptación:**
  - [ ] `GET /api/v1/projects/{id}/history` → `200` lista ordenada por fecha ASC (todos con pertenencia)
  - [ ] Incluye eventos de `project_status_history`: `{ type: "status_change", previous_status, new_status, changed_by_name, reason, changed_at }`
  - [ ] Incluye eventos de `attachments`: `{ type: "document_uploaded", attachment_type, file_name, stage, uploaded_by_name, uploaded_at }`
  - [ ] Incluye eventos de `evaluations`: `{ type: "evaluation_submitted", juror_number, score, stage, submitted_at, is_extemporaneous }` — sin revelar `juror_id` al Estudiante
  - [ ] Administrador ve el historial completo de cualquier trabajo
  - [ ] Estudiante ve el historial de su propio trabajo (sin identidad de jurados)
  - [ ] Docente ve el historial de trabajos donde tiene función asignada (Director o Jurado)
- **Dependencias:** T-F04-01, T-F05-01
- **Estado:** ⬜ Pendiente

---

### T-F08-05 — Implementar reportes principales de proyectos
- **Módulo(s):** MOD-17
- **Referencias:** `specs/arch/API.md` §/reports, RF-17-01..RF-17-03
- **Descripción:** Reportes de proyectos para el Administrador: listado general con filtros, pendientes de evaluación, correcciones sin respuesta.
- **Criterios de aceptación:**
  - [ ] `GET /api/v1/reports/projects` con filtros `status`, `modality_id`, `academic_program_id`, `academic_period`, `docente_id` → `200` lista paginada (solo Administrador)
  - [ ] `GET /api/v1/reports/projects/pending-review` → `200` (ya implementado en T-F06-10, verificar aquí)
  - [ ] `GET /api/v1/reports/projects/pending-corrections` → `200` (ya implementado en T-F06-11, verificar aquí)
- **Dependencias:** T-F06-11
- **Estado:** ⬜ Pendiente

---

### T-F08-06 — Implementar reporte de carga docente
- **Módulo(s):** MOD-17
- **Referencias:** `specs/arch/API.md` §/reports, RF-17-06, RF-17-07
- **Descripción:** Reportes de carga de trabajo de un docente: trabajos activos como Director y como Jurado.
- **Criterios de aceptación:**
  - [ ] `GET /api/v1/reports/docentes/{id}/workload` → `200` (solo Administrador)
  - [ ] Respuesta: `{ director_projects: [...], juror_projects: [...], total_active: N }`
  - [ ] `GET /api/v1/projects/my` ya sirve la vista del Docente; este reporte es para el Admin viendo a cualquier docente
  - [ ] Cada proyecto incluye: `title`, `status`, `role` (director/jurado), `juror_number` (si aplica)
- **Dependencias:** T-F08-05
- **Estado:** ⬜ Pendiente

---

### T-F08-07 — Implementar fichas individuales (estudiante y proyecto)
- **Módulo(s):** MOD-17
- **Referencias:** RF-17-08, RF-17-09
- **Descripción:** Endpoints de consulta completa de un trabajo de grado y de un estudiante específico.
- **Criterios de aceptación:**
  - [ ] `GET /api/v1/reports/projects` con `GET /projects/{id}` ya cubre RF-17-08 (detalle completo del trabajo). Verificar que incluye: estado actual, historial, documentos, calificaciones, integrantes, director(es), jurados
  - [ ] `GET /api/v1/reports/students/{id}` → `200` (solo Administrador): `{ user_info, project: { title, status, submissions[], evaluations[], history[] } }`
  - [ ] Si el estudiante no tiene trabajo activo: retorna `project: null`
- **Dependencias:** T-F08-06
- **Estado:** ⬜ Pendiente

---

### T-F08-08 — Tests de integración: mensajería, historial y reportes
- **Módulo(s):** MOD-15, MOD-16, MOD-17
- **Referencias:** RF-15-01..RF-15-09, RF-16-01..RF-16-06, RF-17-01..RF-17-09
- **Descripción:** Tests de integración para los módulos transversales.
- **Criterios de aceptación:**
  - [ ] Test: Estudiante envía mensaje a Jurado → `sender_display = "Jurado N"` en respuesta
  - [ ] Test: Jurado envía mensaje al Estudiante → Estudiante ve "Jurado N" como remitente (sin nombre real)
  - [ ] Test: Jurado intenta enviar mensaje al Admin → `403`
  - [ ] Test: marcar mensaje como leído por usuario que no es receptor → `403`
  - [ ] Test: historial incluye cambios de estado en orden cronológico
  - [ ] Test: historial no revela `juror_id` al Estudiante
  - [ ] Test: reporte de jurados extemporáneos incluye `days_late` calculado correctamente
  - [ ] Test: reporte de vencimiento próximo filtra correctamente por N días
  - [ ] Tests en `backend/tests/test_messaging_reports.py`
- **Dependencias:** T-F08-07
- **Estado:** ⬜ Pendiente

---

### T-F08-09 — Verificación final de la API: cobertura completa de endpoints
- **Módulo(s):** Todos
- **Referencias:** `specs/arch/API.md`
- **Descripción:** Verificar que todos los endpoints documentados en API.md están implementados, retornan los códigos de estado correctos y cumplen las restricciones de rol.
- **Criterios de aceptación:**
  - [ ] Todos los endpoints de `API.md` tienen implementación correspondiente
  - [ ] Documentación OpenAPI automática (Swagger UI en `/docs`) refleja todos los endpoints con sus esquemas
  - [ ] Todos los endpoints requieren JWT (excepto `GET /health`)
  - [ ] Endpoints de solo Administrador retornan `403` para Docente y Estudiante
  - [ ] Endpoints de pertenencia retornan `403` para usuarios sin acceso al proyecto
  - [ ] Checklist de endpoints revisado manualmente contra API.md
- **Dependencias:** T-F08-08
- **Estado:** ⬜ Pendiente

---

### T-F08-10 — Implementar servicio de mensajes automáticos del sistema
- **Módulo(s):** MOD-15
- **Referencias:** RF-15-09
- **Descripción:** Refactorizar/centralizar la función que genera mensajes automáticos del sistema (usada en todas las fases anteriores) en un servicio compartido.
- **Criterios de aceptación:**
  - [ ] `backend/app/services/notifications.py` con función `send_system_message(project_id, recipient_id, content, sender_display="Sistema")`
  - [ ] Todos los mensajes automáticos generados en FASE-04 a FASE-07 usan este servicio
  - [ ] Los mensajes del sistema tienen `sender_display = "Sistema"` o el nombre del actor que disparó la acción
  - [ ] Tests unitarios de la función
- **Dependencias:** T-F08-01
- **Estado:** ⬜ Pendiente

---

### T-F08-11 — Generar documentación OpenAPI y exportar colección
- **Módulo(s):** Todos
- **Referencias:** `specs/arch/API.md`
- **Descripción:** Verificar que FastAPI genera la documentación OpenAPI correctamente y exportar la especificación para uso en el frontend y testing.
- **Criterios de aceptación:**
  - [ ] `GET /docs` disponible en desarrollo con todos los endpoints documentados
  - [ ] `GET /openapi.json` exportable
  - [ ] Todos los schemas de request/response tienen ejemplos en los modelos Pydantic
  - [ ] Archivo `backend/openapi.json` exportado y comiteado para referencia del equipo frontend
- **Dependencias:** T-F08-09
- **Estado:** ⬜ Pendiente
