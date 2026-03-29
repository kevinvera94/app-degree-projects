# FASE-04 — Backend: Inscripción y evaluación de idea
> Parte del plan de tareas. Ver índice en `specs/TASKS.md`.
> Módulos cubiertos: MOD-03, MOD-04.
> Objetivo: implementar el flujo completo de inscripción de idea por parte del estudiante y su evaluación por el Administrador.

---

## Tareas

### T-F04-01 — Implementar inscripción de idea (`POST /projects`)
- **Módulo(s):** MOD-03
- **Referencias:** `specs/arch/API.md` §/projects, RF-03-01..RF-03-08
- **Descripción:** El estudiante inscribe una nueva idea de trabajo de grado. Se validan integrantes, ventana activa, límites de integrantes y estado previo del estudiante.
- **Criterios de aceptación:**
  - [ ] `POST /api/v1/projects` (solo Estudiante) → `201` con el proyecto creado
  - [ ] Body: `{ title, modality_id, academic_program_id, research_group, profundization_line, suggested_director?, member_ids[], prerequisite_declaration: true }`
  - [ ] Valida ventana activa para `inscripcion_idea` (global o extemporánea) → `409` si no hay ventana
  - [ ] Todos los `member_ids` deben ser UUIDs de usuarios activos con rol `estudiante` → `400` si no
  - [ ] Valida que el número de integrantes ≤ límite de `get_max_members(modality_id, program.level)` → `400` si excede
  - [ ] Valida que `prerequisite_declaration = true` → `400` si false
  - [ ] Valida que el estudiante solicitante no tenga ya un trabajo activo (no en estado terminal) → `409`
  - [ ] Crea registro en `thesis_projects` con `status = pendiente_evaluacion_idea`
  - [ ] Crea registros en `project_members` para todos los integrantes
  - [ ] Crea registro en `project_status_history`
  - [ ] Envía mensaje automático al estudiante: "Tu idea ha sido inscrita. Estado: Pendiente de evaluación"
- **Dependencias:** T-F03-07, T-F02-05, T-F02-06
- **Estado:** ⬜ Pendiente

---

### T-F04-02 — Implementar listado y detalle de proyectos (`GET /projects`, `GET /projects/my`, `GET /projects/{id}`)
- **Módulo(s):** MOD-03, MOD-04, MOD-17
- **Referencias:** `specs/arch/API.md` §/projects, RF-04-01, RF-03-08
- **Descripción:** Endpoints de consulta de proyectos, con visibilidad diferenciada por rol.
- **Criterios de aceptación:**
  - [ ] `GET /api/v1/projects` (solo Administrador) con filtros: `status`, `modality_id`, `academic_period`, `academic_program_id` → `200` lista paginada
  - [ ] `GET /api/v1/projects/my` (Docente, Estudiante) → `200` lista de proyectos propios (miembro, director o jurado activo)
  - [ ] `GET /api/v1/projects/{id}` → `200` detalle completo. Administrador ve todo; Docente y Estudiante solo si tienen pertenencia activa
  - [ ] El detalle incluye: `status`, `modality`, `members`, `directors`, `jurors` (con anonimato para Estudiante), `submissions`, `evaluations`
  - [ ] Sin pertenencia y no admin → `403`
- **Dependencias:** T-F04-01
- **Estado:** ⬜ Pendiente

---

### T-F04-03 — Implementar aprobación de idea con asignación de director
- **Módulo(s):** MOD-04
- **Referencias:** `specs/arch/API.md` §/projects/{id}/directors, RF-04-02, RF-04-03, RF-04-06
- **Descripción:** El Administrador aprueba una idea y debe asignar al menos un director. La aprobación y asignación ocurren en el mismo flujo.
- **Criterios de aceptación:**
  - [ ] `PATCH /api/v1/projects/{id}/status` body: `{ action: "aprobar" }` (solo Administrador)
  - [ ] Requiere que ya exista al menos un director asignado vía `POST /projects/{id}/directors` previo, O el body puede incluir `director_ids[]` directamente → `400` si no hay director
  - [ ] `POST /api/v1/projects/{id}/directors` body: `{ user_id, juror_number? }` → `201`. Valida: docente activo, máx. 2 directores por proyecto
  - [ ] `DELETE /api/v1/projects/{id}/directors/{directorId}` → `204` (solo Administrador)
  - [ ] Al aprobar: `status → idea_aprobada`, registra en `project_status_history`
  - [ ] Envía mensaje automático al estudiante: "Tu idea ha sido aprobada. Director asignado: [nombre]"
  - [ ] Envía mensaje automático al docente asignado: "Has sido asignado como director del trabajo [título]"
- **Dependencias:** T-F04-02
- **Estado:** ⬜ Pendiente

---

### T-F04-04 — Implementar rechazo de idea
- **Módulo(s):** MOD-04
- **Referencias:** RF-04-04, RF-04-05
- **Descripción:** El Administrador rechaza una idea con motivo obligatorio.
- **Criterios de aceptación:**
  - [ ] `PATCH /api/v1/projects/{id}/status` body: `{ action: "rechazar", reason: "..." }` (solo Administrador)
  - [ ] `reason` obligatorio → `400` si vacío o ausente
  - [ ] `status → idea_rechazada`, registra en `project_status_history` con el motivo
  - [ ] El proyecto solo puede rechazarse desde `pendiente_evaluacion_idea` → `409` si estado distinto
  - [ ] Envía mensaje automático al estudiante con el motivo del rechazo
- **Dependencias:** T-F04-02
- **Estado:** ⬜ Pendiente

---

### T-F04-05 — Gestión de integrantes antes de aprobación (`GET/POST /projects/{id}/members`)
- **Módulo(s):** MOD-03, MOD-08
- **Referencias:** `specs/arch/API.md` §Integrantes, RF-08-01
- **Descripción:** Listado y adición de integrantes mientras el anteproyecto no ha sido aprobado.
- **Criterios de aceptación:**
  - [ ] `GET /api/v1/projects/{id}/members` → `200` lista de integrantes activos (todos con pertenencia)
  - [ ] `POST /api/v1/projects/{id}/members` body: `{ user_id }` → `201` (solo Administrador)
  - [ ] Valida: proyecto no ha pasado de `idea_aprobada` (i.e., anteproyecto no aprobado aún) → `409` si estado ≥ `en_desarrollo`
  - [ ] Valida: `user_id` es estudiante activo → `400`
  - [ ] Valida: no supera el límite de integrantes → `400`
  - [ ] Crea registro en `project_members` y en `project_status_history`
- **Dependencias:** T-F04-03
- **Estado:** ⬜ Pendiente

---

### T-F04-06 — Implementar retiro de integrante (`PATCH /projects/{id}/members/{memberId}/remove`)
- **Módulo(s):** MOD-08
- **Referencias:** `specs/arch/API.md` §Integrantes, RF-08-02, RF-08-03
- **Descripción:** El Administrador puede retirar un integrante en cualquier etapa posterior a la aprobación del anteproyecto. Requiere justificación de texto Y documento adjunto.
- **Criterios de aceptación:**
  - [ ] `PATCH /projects/{id}/members/{memberId}/remove` body: `multipart/form-data` con `reason: texto` y `attachment: archivo` (solo Administrador)
  - [ ] Si `reason` (texto) falta → `400`
  - [ ] Si `attachment` (documento) falta → `400`
  - [ ] Sube el documento a Supabase Storage y crea registro en `attachments` con `type = retiro_integrante`
  - [ ] Marca `project_members.is_active = false`, registra `removed_at` y `removal_reason`
  - [ ] Registra en `project_status_history`: `"Retiro de integrante: [nombre], motivo: [reason]"`
- **Dependencias:** T-F04-05
- **Estado:** ⬜ Pendiente

---

### T-F04-07 — Implementar cancelación de proyecto
- **Módulo(s):** MOD-07
- **Referencias:** RF-07-05, `specs/arch/ENUMS.md` (estado `cancelado`)
- **Descripción:** El Administrador puede archivar/cancelar un trabajo abandonado. No obliga al estudiante a inscribir nueva idea.
- **Criterios de aceptación:**
  - [ ] `PATCH /projects/{id}/status` body: `{ action: "cancelar", reason: "..." }` (solo Administrador)
  - [ ] `reason` obligatorio
  - [ ] `status → cancelado`, registra en `project_status_history` con motivo y actor
  - [ ] Un proyecto cancelado no puede avanzar en ninguna etapa → `409` si se intenta cualquier acción sobre él
  - [ ] Envía mensaje automático al estudiante: "Tu trabajo ha sido archivado. Motivo: [reason]"
- **Dependencias:** T-F04-04
- **Estado:** ⬜ Pendiente

---

### T-F04-08 — Tests de integración: inscripción y evaluación de idea
- **Módulo(s):** MOD-03, MOD-04
- **Referencias:** RF-03-01..RF-03-08, RF-04-01..RF-04-09
- **Descripción:** Tests que cubren todos los flujos y casos borde de MOD-03 y MOD-04.
- **Criterios de aceptación:**
  - [ ] Test: inscribir idea sin ventana activa → `409`
  - [ ] Test: inscribir idea con integrante no pre-registrado → `400`
  - [ ] Test: inscribir idea con más integrantes que el límite → `400`
  - [ ] Test: inscribir idea con `prerequisite_declaration = false` → `400`
  - [ ] Test: estudiante con trabajo activo intenta inscribir otra idea → `409`
  - [ ] Test: aprobar idea sin director asignado → `400`
  - [ ] Test: rechazar idea sin motivo → `400`
  - [ ] Test: agregar integrante después de aprobación de anteproyecto → `409`
  - [ ] Test: retirar integrante sin adjunto → `400`
  - [ ] Tests en `backend/tests/test_ideas.py`
- **Dependencias:** T-F04-07
- **Estado:** ⬜ Pendiente
