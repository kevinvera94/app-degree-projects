# FASE-05 — Backend: Anteproyecto (radicación, evaluación, correcciones)
> Parte del plan de tareas. Ver índice en `specs/TASKS.md`.
> Módulos cubiertos: MOD-05, MOD-06, MOD-07.
> Objetivo: implementar el flujo completo del anteproyecto: radicación de documentos, asignación de jurados, evaluación con lógica de Jurado 3, correcciones y transiciones de estado.

---

## Notas de fase

- La utilidad de días hábiles (T-F01-07) es prerequisito para los plazos.
- El anonimato de jurados se aplica desde la capa de servicio, no solo en el schema de respuesta.
- Los mensajes automáticos se crean como registros en `messages` (RF-15-09) — nombre exacto de la tabla en DATA-MODEL.
- El flujo de radicación tiene **dos pasos**: (1) `POST /submissions` crea la radicación con status `pendiente`, (2) `PATCH /submissions/{id}/confirm` valida adjuntos y cambia el estado del proyecto. Ver T-F05-01.

---

## Tareas

### T-F05-01 — Implementar radicación de anteproyecto y adjuntos
- **Módulo(s):** MOD-05
- **Referencias:** `specs/arch/API.md` §/projects/{id}/submissions, RF-05-01..RF-05-06
- **Descripción:** El estudiante radica el anteproyecto subiendo los documentos obligatorios. La radicación se confirma solo cuando todos los adjuntos requeridos están presentes.
- **Criterios de aceptación:**
  - [x] **Paso 1 — Crear radicación:** `POST /projects/{id}/submissions` body: `{ stage: "anteproyecto" }` → `201` crea `submission` con `status = "pendiente"` y `revision_number = 1` (solo Estudiante con pertenencia activa). No incluir `academic_period` en el body — se hereda de `thesis_projects.period`
  - [x] Valida estado `idea_aprobada` → `409` si estado distinto
  - [x] Valida ventana activa para `radicacion_anteproyecto` (global o extemporánea) → `409` si no hay. Si es extemporánea: `is_extemporaneous = true`. Si es global: guarda `date_window_id`
  - [x] **Paso 2 — Subir adjuntos:** `POST /projects/{id}/submissions/{subId}/attachments` body: `multipart/form-data` con `attachment_type` y `file` → `201` sube a Supabase Storage, guarda `file_url`
  - [x] `GET /projects/{id}/submissions/{subId}/attachments/{attId}` genera URL firmada (TTL 1h) → `200`
  - [x] `DELETE /projects/{id}/submissions/{subId}/attachments/{attId}` solo cuando `submission.status = "pendiente"` → `204`; si ya confirmada → `409`
  - [x] **Paso 3 — Confirmar radicación:** `PATCH /projects/{id}/submissions/{subId}/confirm` → `200` (solo Estudiante). Valida adjuntos obligatorios según modalidad:
    - Todas las modalidades: `plantilla`, `carta_aval`, `reporte_similitud`
    - Modalidad `Investigación` (detectada por `modalities.requires_ethics_approval = true`): además `aval_etica`
  - [x] Si falta adjunto obligatorio → `400` con lista de tipos faltantes
  - [x] Al confirmar: `submission.status → "en_revision"`, `project.status → anteproyecto_pendiente_evaluacion`, registra en `project_status_history`
  - [x] Envía mensaje automático al Administrador: "Nuevo anteproyecto radicado: [título]"
- **Dependencias:** T-F04-08, T-F01-04
- **Estado:** ✅ Completada

---

### T-F05-02 — Implementar asignación de jurados al anteproyecto
- **Módulo(s):** MOD-06
- **Referencias:** `specs/arch/API.md` §Jurados, RF-06-01..RF-06-03, RF-06-10
- **Descripción:** El Administrador asigna Jurado 1 y Jurado 2 al anteproyecto. El sistema inicia el conteo del plazo de 15 días hábiles.
- **Criterios de aceptación:**
  - [x] `POST /projects/{id}/jurors` body: `{ user_id, juror_number: 1|2, stage: "anteproyecto" }` → `201` (solo Administrador)
  - [x] Valida estado `anteproyecto_pendiente_evaluacion` → `409` si estado distinto
  - [x] Solo muestra docentes con `is_active = true` en el selector (filtro en `GET /users?role=docente&is_active=true`)
  - [x] Al asignar, registra `project_jurors.assigned_at = now()`. Crea registro en `evaluations` con `start_date = assigned_at` y `due_date = add_business_days(assigned_at, 15, project.period)`, `revision_number = 1`
  - [x] No permite asignar el mismo docente como Jurado 1 y Jurado 2 → `400`
  - [x] `GET /projects/{id}/jurors` → `200`. Para Estudiante: oculta `user_id` y `full_name`, muestra solo `juror_number`. Para Admin/Director: visibilidad completa
  - [x] `DELETE /projects/{id}/jurors/{jurorId}` → `204` (solo Administrador, solo si no hay calificación registrada aún)
- **Dependencias:** T-F05-01
- **Estado:** ✅ Completada

---

### T-F05-03 — Implementar registro de calificación de jurado (anteproyecto)
- **Módulo(s):** MOD-06
- **Referencias:** `specs/arch/API.md` §/projects/{id}/evaluations, RF-06-04..RF-06-09
- **Descripción:** Cada jurado registra su calificación individual. El sistema marca extemporáneas automáticamente y evalúa el resultado cuando ambos han calificado.
- **Criterios de aceptación:**
  - [x] `POST /projects/{id}/evaluations` body: `{ stage: "anteproyecto", score: 0.0–5.0, observations: texto }` → `201` (solo Docente con rol jurado asignado en esta etapa)
  - [x] Valida que el jurado que registra sea el asignado para esa etapa (via `project_jurors`) → `403` si no
  - [x] Si `submitted_at > evaluations.due_date` → `is_extemporaneous = true` (no bloquea, solo marca)
  - [x] `GET /projects/{id}/evaluations` — respuesta diferenciada por rol (ver esquemas en `specs/arch/API.md` línea 139-154):
    - **Estudiante:** `juror_id` y `full_name` **nunca** incluidos — solo `juror_number`, `score`, `observations`, `submitted_at`
    - **Administrador:** visibilidad completa incluyendo `juror_id`, `juror_name`, `is_extemporaneous`
    - **Docente (Director):** incluye `juror_id` y `juror_name`
  - [x] El serializer aplica el filtro de identidad en la **capa de servicio**, no solo en el frontend (AUTH.md línea 79)
  - [x] `GET /projects/{id}/evaluations/{evalId}` → `200` (Administrador, Docente)
- **Dependencias:** T-F05-02
- **Estado:** ✅ Completada

---

### T-F05-04 — Implementar lógica de resultado del anteproyecto
- **Módulo(s):** MOD-06
- **Referencias:** RF-06-07, RF-06-08, RF-06-09, RF-06-11, RF-06-12, RF-06-13
- **Descripción:** Lógica central: cuando ambos jurados han calificado, el sistema determina el resultado y ejecuta las transiciones de estado correspondientes. Incluye manejo de Jurado 3.
- **Criterios de aceptación:**
  - [x] Función de servicio `evaluate_anteproyecto_result(project_id)` ejecutada automáticamente al registrar la segunda calificación
  - [x] Ambas ≥ 4.0 → `anteproyecto_aprobado` → `en_desarrollo` (transición automática). Bloquea adición de nuevos integrantes (`project_members` queda cerrado)
  - [x] Ambas entre 3.0 y 3.9 → `correcciones_anteproyecto_solicitadas`. Calcula `due_date = add_business_days(now(), 10, project.period)` y lo registra en el contexto del estado para mostrárselo al estudiante
  - [x] Ambas < 3.0 → `anteproyecto_reprobado` → `idea_aprobada` (retorno automático). Conserva integrantes existentes
  - [x] Un jurado ≥ 4.0 y el otro < 3.0 (divergencia) → notifica al Administrador para designar Jurado 3 (mensaje automático). Estado queda en `anteproyecto_pendiente_evaluacion`
  - [x] Al reprobarse: mensaje automático al estudiante: "Tu anteproyecto fue reprobado. Puedes radicar uno nuevo."
  - [x] Al aprobarse: mensaje automático al estudiante: "Tu anteproyecto fue aprobado. Estado: En desarrollo."
  - [x] Al solicitar correcciones: dos canales (RF-06-11): (1) la vista de evaluaciones muestra calificación y observaciones; (2) mensaje automático en bandeja: "Tienes correcciones pendientes. Ver evaluaciones."
  - [x] Todos los cambios de estado registrados en `project_status_history`
- **Dependencias:** T-F05-03
- **Estado:** ✅ Completada

---

### T-F05-05 — Implementar asignación y registro de Jurado 3 (anteproyecto)
- **Módulo(s):** MOD-06
- **Referencias:** RF-06-08, RF-06-09
- **Descripción:** Flujo separado para asignar Jurado 3 cuando hay divergencia entre Jurado 1 y Jurado 2. El Jurado 3 solo puede registrar Aprobado o Reprobado.
- **Criterios de aceptación:**
  - [x] `POST /projects/{id}/jurors` body: `{ user_id, juror_number: 3, stage: "anteproyecto" }` → `201` (solo Administrador, solo cuando el sistema haya notificado divergencia)
  - [x] Valida que exista divergencia (una ≥ 4.0, otra < 3.0) antes de permitir asignación de J3 → `409` si no hay divergencia
  - [x] La calificación del Jurado 3 solo acepta `score >= 4.0` (Aprobado) o `score < 3.0` (Reprobado) → `400` si `3.0 <= score < 4.0`
  - [x] J3 aprueba → `anteproyecto_aprobado` → `en_desarrollo`
  - [x] J3 reprueba → `anteproyecto_reprobado` → `idea_aprobada` (conserva integrantes)
  - [x] Registra en `project_status_history`
- **Dependencias:** T-F05-04
- **Estado:** ✅ Completada

---

### T-F05-06 — Implementar entrega de correcciones del anteproyecto
- **Módulo(s):** MOD-07
- **Referencias:** RF-07-01..RF-07-07
- **Descripción:** El estudiante entrega el documento corregido con Vo.Bo. del director. El sistema inicia la segunda revisión automáticamente.
- **Criterios de aceptación:**
  - [x] `POST /projects/{id}/submissions` body: `{ stage: "anteproyecto", is_correction: true, academic_period }` → `201` (solo Estudiante)
  - [x] Valida estado `correcciones_anteproyecto_solicitadas` → `409` si estado distinto
  - [x] Valida que haya ventana activa para `radicacion_anteproyecto` O que el plazo original no haya vencido → `409` si la ventana está cerrada y el plazo venció
  - [x] Al confirmar radicación de corrección (`PATCH /submissions/{subId}/confirm`): `submission.status → "en_revision"`, `project.status → anteproyecto_corregido_entregado`. Registra `evaluations.start_date = submissions.submitted_at`. Calcula nuevo `due_date = add_business_days(start_date, 10, project.period)` con `revision_number = 2`
  - [x] Crea nuevos registros en `evaluations` para la segunda revisión (mismos jurados, `revision_number = 2`)
  - [x] Mensaje automático a los jurados: "El estudiante entregó correcciones. Plazo: [due_date]"
- **Dependencias:** T-F05-04
- **Estado:** ✅ Completada

---

### T-F05-07 — Implementar lógica de bloqueo por incumplimiento de correcciones
- **Módulo(s):** MOD-07
- **Referencias:** RF-07-04, RF-07-05
- **Descripción:** Si el estudiante no entrega las correcciones dentro del plazo de 10 días hábiles, el sistema bloquea la entrega. El estado permanece en `correcciones_anteproyecto_solicitadas`; el estudiante podrá radicar cuando abra la siguiente ventana.
- **Criterios de aceptación:**
  - [x] Función de servicio (o validación en endpoint) que detecta si el plazo venció
  - [x] Si el plazo venció Y no hay ventana activa → intentar radicar corrección devuelve `409` con mensaje explicativo
  - [x] Si abre una nueva ventana de `radicacion_anteproyecto` → la entrega vuelve a estar disponible (sin reinicio de proceso)
  - [x] El estado **no cambia** automáticamente al vencer el plazo (no hay cron job en MVP); la restricción se aplica en el endpoint de radicación
  - [x] El Administrador puede cancelar el trabajo via T-F04-07 si lo considera abandonado
- **Dependencias:** T-F05-06
- **Estado:** ✅ Completada

---

### T-F05-08 — Implementar segunda revisión del anteproyecto
- **Módulo(s):** MOD-07
- **Referencias:** RF-07-06, RF-07-07
- **Descripción:** En la segunda revisión, los jurados solo pueden aprobar o reprobar (no solicitar más correcciones). El sistema ejecuta las transiciones finales.
- **Criterios de aceptación:**
  - [ ] Los jurados registran calificaciones en la segunda revisión igual que en la primera, pero el sistema valida que solo se permitan `score >= 4.0` (Aprobado) o `score < 3.0` (Reprobado) → `400` si `3.0 <= score < 4.0`
  - [ ] La diferenciación de "primera" o "segunda" revisión se detecta por `evaluations.revision_number` (1 o 2)
  - [ ] Al completarse la segunda revisión:
    - Ambas aprobadas → `en_desarrollo` (igual que primera revisión)
    - Una o ambas reprobadas → `idea_aprobada` (retorno, conserva integrantes)
  - [ ] Divergencia en segunda revisión → Jurado 3 (mismo flujo de T-F05-05, con `stage = "anteproyecto"` y `revision_number = 2`). Se asigna un nuevo Jurado 3 si no hay uno activo de la primera revisión para esta etapa
  - [ ] Registra en `project_status_history`
- **Dependencias:** T-F05-07
- **Estado:** ⬜ Pendiente

---

### T-F05-09 — Implementar historial de radicaciones y adjuntos
- **Módulo(s):** MOD-05, MOD-07
- **Referencias:** `specs/arch/API.md` §/projects/{id}/submissions
- **Descripción:** Endpoints para consultar el historial de radicaciones y descargar adjuntos.
- **Criterios de aceptación:**
  - [ ] `GET /projects/{id}/submissions` → `200` lista de todas las radicaciones del proyecto con fechas y etapa (todos con pertenencia)
  - [ ] `GET /projects/{id}/submissions/{subId}` → `200` detalle con lista de adjuntos (sin URL; URL se genera en endpoint separado)
  - [ ] `GET /projects/{id}/submissions/{subId}/attachments/{attId}` genera URL firmada de Supabase Storage (TTL 1h) → `200` (todos con pertenencia)
  - [ ] Estudiante sin pertenencia → `403`
- **Dependencias:** T-F05-01
- **Estado:** ⬜ Pendiente

---

### T-F05-10 — Tests de integración: flujo completo del anteproyecto
- **Módulo(s):** MOD-05, MOD-06, MOD-07
- **Referencias:** RF-05-01..RF-05-06, RF-06-01..RF-06-13, RF-07-01..RF-07-07
- **Descripción:** Tests de integración para todos los flujos del anteproyecto.
- **Criterios de aceptación:**
  - [ ] Test: radicar anteproyecto sin ventana activa → `409`
  - [ ] Test: radicar anteproyecto sin adjunto obligatorio → `400`
  - [ ] Test: modalidad Investigación sin `aval_etica` → `400`
  - [ ] Test: flujo completo aprobación (ambas ≥ 4.0) → estado `en_desarrollo`
  - [ ] Test: flujo correcciones (3.0–3.9) → estado `correcciones_anteproyecto_solicitadas`
  - [ ] Test: flujo reprobación unánime → estado `idea_aprobada` (integrantes conservados)
  - [ ] Test: divergencia → Jurado 3 asignado → aprueba → `en_desarrollo`
  - [ ] Test: divergencia → Jurado 3 asignado → reprueba → `idea_aprobada`
  - [ ] Test: entrega de correcciones vencida sin ventana → `409`
  - [ ] Test: segunda revisión solo acepta aprobado/reprobado (no correcciones)
  - [ ] Test: calificación extemporánea marcada correctamente
  - [ ] Test: jurado no asignado intenta calificar → `403`
  - [ ] Test: estudiante ve jurados como "Jurado 1" / "Jurado 2" (sin identidad real)
  - [ ] Tests en `backend/tests/test_anteproyecto.py`
- **Dependencias:** T-F05-08
- **Estado:** ⬜ Pendiente
