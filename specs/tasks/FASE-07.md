# FASE-07 — Backend: Sustentación y acta
> Parte del plan de tareas. Ver índice en `specs/TASKS.md`.
> Módulos cubiertos: MOD-12, MOD-13.
> Objetivo: implementar la programación de la sustentación pública, el registro de calificaciones individuales con cálculo de promedio, y la generación del acta final.

---

## Notas de fase

- La sustentación **no aplica** para la modalidad Diplomado tecnológico; esos proyectos llegan directamente al estado `trabajo_aprobado` desde el producto final (FASE-06, RF-10-04).
- No existe Jurado 3 en sustentación — la decisión es por promedio de los dos jurados (RF-12-05).
- La sustentación reprobada obliga a nueva inscripción de idea desde cero (RF-12-06).

---

## Tareas

### T-F07-01 — Implementar registro de sustentación (`POST /projects/{id}/sustentation`)
- **Módulo(s):** MOD-12
- **Referencias:** `specs/arch/API.md` §/projects/{id}/sustentation, RF-12-01, RF-12-02
- **Descripción:** El Administrador programa la sustentación pública registrando fecha, hora y lugar.
- **Criterios de aceptación:**
  - [x] `POST /api/v1/projects/{id}/sustentation` body: `{ scheduled_date, scheduled_time, location }` → `201` (solo Administrador)
  - [x] Valida estado `aprobado_para_sustentacion` → `409` si distinto
  - [x] Valida que Diplomado tecnológico no pueda tener sustentación → `409` (llega a `trabajo_aprobado` sin pasar por aquí)
  - [x] Crea registro en `sustentations`
  - [x] `status → sustentacion_programada`, registra en `project_status_history`
  - [x] Mensajes automáticos a: estudiante, director y jurados con fecha, hora y lugar
  - [x] `GET /projects/{id}/sustentation` → `200` detalle de la sustentación y calificaciones (todos con pertenencia). Para Estudiante: `juror_id` oculto, solo `juror_number`
- **Dependencias:** T-F06-09
- **Estado:** ✅ Completada

---

### T-F07-02 — Implementar registro de calificaciones de sustentación
- **Módulo(s):** MOD-12
- **Referencias:** RF-12-03, RF-12-04, RF-12-05, RF-12-06
- **Descripción:** Cada jurado registra su calificación individual de la sustentación. Cuando ambos han registrado, el sistema calcula el promedio y determina el resultado.
- **Criterios de aceptación:**
  - [x] `POST /projects/{id}/sustentation/evaluations` body: `{ juror_number: 1|2, score: 0.0–5.0 }` → `201` (Docente jurado asignado en `sustentacion`, o Administrador)
  - [x] Valida que el solicitante sea el jurado asignado para `stage = sustentacion` → `403` si no
  - [x] Crea registro en `sustentation_evaluations`
  - [x] Al registrar la segunda calificación, el sistema calcula `final_score = (score_j1 + score_j2) / 2`
  - [x] `final_score >= 4.0` → `is_approved = true` → `status = trabajo_aprobado`
  - [x] `final_score < 4.0` → `is_approved = false` → `status = reprobado_en_sustentacion`
  - [x] Actualiza `sustentations.final_score` y `sustentations.is_approved`
  - [x] Registra en `project_status_history`
  - [x] Si aprobado: mensaje al estudiante: "Sustentación aprobada. Promedio: [score]. Estado: Trabajo aprobado."
  - [x] Si reprobado: mensaje al estudiante: "Sustentación reprobada. Promedio: [score]. Debes iniciar el proceso desde cero."
- **Dependencias:** T-F07-01
- **Estado:** ✅ Completada

---

### T-F07-03 — Implementar restricción de Jurado 3 en sustentación
- **Módulo(s):** MOD-12
- **Referencias:** RF-12-05
- **Descripción:** Validar que no se permita asignación de Jurado 3 en la etapa de sustentación.
- **Criterios de aceptación:**
  - [x] `POST /projects/{id}/jurors` con `stage = "sustentacion"` y `juror_number = 3` → `400` con mensaje: "No existe Jurado 3 en sustentación"
  - [x] Test unitario que verifica este bloqueo
- **Dependencias:** T-F07-02
- **Estado:** ✅ Completada

---

### T-F07-04 — Implementar autorización de biblioteca por estudiante
- **Módulo(s):** MOD-13
- **Referencias:** RF-13-01
- **Descripción:** Una vez en estado `trabajo_aprobado`, el sistema habilita al estudiante para diligenciar el formato de autorización de publicación en biblioteca.
- **Criterios de aceptación:**
  - [x] **Endpoint dedicado:** `PATCH /projects/{id}/library-authorization` body: `{ library_authorization: true|false }` → `200` (solo Estudiante con pertenencia activa)
  - [x] Valida estado `trabajo_aprobado` → `409` si distinto
  - [x] Solo el estudiante puede diligenciar → `403` para Admin y Docente
  - [x] Crea (o actualiza si ya existe) el registro en tabla `acts` con `library_authorization`, `issued_at = null` (pendiente de emisión por Admin)
  - [x] Mensaje automático al Administrador: "El estudiante [nombre] ha diligenciado la autorización de biblioteca para [título]."
  - [x] Si el estudiante intenta diligenciar de nuevo: idempotente → `200` (actualiza el valor)
- **Dependencias:** T-F07-02
- **Estado:** ✅ Completada

---

### T-F07-05 — Implementar emisión del acta (`POST /projects/{id}/act`)
- **Módulo(s):** MOD-13
- **Referencias:** RF-13-02..RF-13-05
- **Descripción:** El Administrador emite el acta de sustentación/aprobación. El estado cambia a `acta_generada`.
- **Criterios de aceptación:**
  - [x] `POST /api/v1/projects/{id}/act` body: `multipart/form-data` con campo opcional `file` (PDF del acta) → `201` (solo Administrador)
  - [x] Valida que exista registro en `acts` con `library_authorization` diligenciada por el estudiante → `409` si no
  - [x] Valida estado `trabajo_aprobado` → `409` si distinto
  - [x] Si se adjunta archivo: sube a Supabase Storage y registra `acts.act_file_url`. Si no: `act_file_url = null` (el acta puede registrarse sin PDF digital)
  - [x] Actualiza `acts.issued_by = current_admin_id`, `acts.issued_at = now()`
  - [x] `project.status → acta_generada`, registra en `project_status_history`
  - [x] Mensaje automático al estudiante: "Tu acta ha sido emitida. Puedes descargarla desde el sistema."
  - [x] `GET /projects/{id}/act` → `200` detalle del acta (todos con pertenencia)
  - [x] Si `act_file_url` existe: genera URL firmada (TTL 1h) para descarga del estudiante
- **Dependencias:** T-F07-04
- **Estado:** ✅ Completada

---

### T-F07-06 — Implementar asignación de jurados para sustentación
- **Módulo(s):** MOD-12
- **Referencias:** `specs/arch/API.md` §Jurados, `specs/arch/ENUMS.md` §project_jurors.stage
- **Descripción:** El Administrador asigna los jurados que evaluarán la sustentación (pueden ser los mismos del producto final).
- **Criterios de aceptación:**
  - [x] `POST /projects/{id}/jurors` body: `{ user_id, juror_number: 1|2, stage: "sustentacion" }` → `201` (solo Administrador)
  - [x] Valida estado `aprobado_para_sustentacion` → `409` si distinto
  - [x] Valida docente activo → `400`
  - [x] No permite `juror_number = 3` en `stage = "sustentacion"` → `400`
  - [x] Se puede reutilizar la misma lógica del endpoint de jurados de anteproyecto/producto final
- **Dependencias:** T-F07-01
- **Estado:** ✅ Completada

---

### T-F07-07 — Tests de integración: sustentación y acta
- **Módulo(s):** MOD-12, MOD-13
- **Referencias:** RF-12-01..RF-12-06, RF-13-01..RF-13-05
- **Descripción:** Tests de integración para todos los flujos de sustentación y generación de acta.
- **Criterios de aceptación:**
  - [x] Test: Diplomado tecnológico no puede programar sustentación → `409`
  - [x] Test: programar sustentación sin estado `aprobado_para_sustentacion` → `409`
  - [x] Test: flujo completo aprobado (promedio ≥ 4.0) → `trabajo_aprobado`
  - [x] Test: flujo completo reprobado (promedio < 4.0) → `reprobado_en_sustentacion`
  - [x] Test: intentar asignar J3 en sustentación → `400`
  - [x] Test: emitir acta sin autorización de biblioteca → `409`
  - [x] Test: emitir acta en estado distinto a `trabajo_aprobado` → `409`
  - [x] Test: estudiante puede descargar acta (URL firmada generada)
  - [x] Test: estudiante ve calificaciones de sustentación sin identidad de jurado
  - [x] Tests en `backend/tests/test_sustentacion.py`
- **Dependencias:** T-F07-05, T-F07-06
- **Estado:** ✅ Completada

---

### T-F07-08 — Implementar reporte de jurados con calificaciones extemporáneas
- **Módulo(s):** MOD-17
- **Referencias:** RF-17-04, `specs/arch/API.md` §/reports
- **Descripción:** Reporte para el Administrador de docentes que registraron calificaciones fuera del plazo.
- **Criterios de aceptación:**
  - [x] `GET /api/v1/reports/jurors/late` → `200` lista de evaluaciones con `is_extemporaneous = true`
  - [x] Cada ítem: `docente_name`, `project_title`, `stage` (anteproyecto/producto_final), `deadline_date`, `submitted_at`, `days_late`
  - [x] Solo Administrador → `403` para otros roles
- **Dependencias:** T-F05-10
- **Estado:** ✅ Completada

---

### T-F07-09 — Implementar alerta de vencimiento próximo de jurados
- **Módulo(s):** MOD-17
- **Referencias:** RF-17-05, `specs/arch/API.md` §/reports
- **Descripción:** Reporte de jurados con plazo de evaluación activo próximo a vencer.
- **Criterios de aceptación:**
  - [x] `GET /api/v1/reports/jurors/expiring?days=N` → `200` lista de evaluaciones aún sin calificar cuyo `deadline_date` vence en los próximos N días hábiles
  - [x] `N` configurable; valor por defecto desde `RF-01-07` (parámetro global del sistema)
  - [x] Cada ítem: `docente_name`, `project_title`, `stage`, `deadline_date`, `business_days_remaining`
  - [x] Solo Administrador
- **Dependencias:** T-F07-08
- **Estado:** ✅ Completada
