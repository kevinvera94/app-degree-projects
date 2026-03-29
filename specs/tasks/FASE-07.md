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
  - [ ] `POST /api/v1/projects/{id}/sustentation` body: `{ scheduled_date, scheduled_time, location }` → `201` (solo Administrador)
  - [ ] Valida estado `aprobado_para_sustentacion` → `409` si distinto
  - [ ] Valida que Diplomado tecnológico no pueda tener sustentación → `409` (llega a `trabajo_aprobado` sin pasar por aquí)
  - [ ] Crea registro en `sustentations`
  - [ ] `status → sustentacion_programada`, registra en `project_status_history`
  - [ ] Mensajes automáticos a: estudiante, director y jurados con fecha, hora y lugar
  - [ ] `GET /projects/{id}/sustentation` → `200` detalle de la sustentación y calificaciones (todos con pertenencia). Para Estudiante: `juror_id` oculto, solo `juror_number`
- **Dependencias:** T-F06-09
- **Estado:** ⬜ Pendiente

---

### T-F07-02 — Implementar registro de calificaciones de sustentación
- **Módulo(s):** MOD-12
- **Referencias:** RF-12-03, RF-12-04, RF-12-05, RF-12-06
- **Descripción:** Cada jurado registra su calificación individual de la sustentación. Cuando ambos han registrado, el sistema calcula el promedio y determina el resultado.
- **Criterios de aceptación:**
  - [ ] `POST /projects/{id}/sustentation/evaluations` body: `{ juror_number: 1|2, score: 0.0–5.0 }` → `201` (Docente jurado asignado en `sustentacion`, o Administrador)
  - [ ] Valida que el solicitante sea el jurado asignado para `stage = sustentacion` → `403` si no
  - [ ] Crea registro en `sustentation_evaluations`
  - [ ] Al registrar la segunda calificación, el sistema calcula `final_score = (score_j1 + score_j2) / 2`
  - [ ] `final_score >= 4.0` → `is_approved = true` → `status = trabajo_aprobado`
  - [ ] `final_score < 4.0` → `is_approved = false` → `status = reprobado_en_sustentacion`
  - [ ] Actualiza `sustentations.final_score` y `sustentations.is_approved`
  - [ ] Registra en `project_status_history`
  - [ ] Si aprobado: mensaje al estudiante: "Sustentación aprobada. Promedio: [score]. Estado: Trabajo aprobado."
  - [ ] Si reprobado: mensaje al estudiante: "Sustentación reprobada. Promedio: [score]. Debes iniciar el proceso desde cero."
- **Dependencias:** T-F07-01
- **Estado:** ⬜ Pendiente

---

### T-F07-03 — Implementar restricción de Jurado 3 en sustentación
- **Módulo(s):** MOD-12
- **Referencias:** RF-12-05
- **Descripción:** Validar que no se permita asignación de Jurado 3 en la etapa de sustentación.
- **Criterios de aceptación:**
  - [ ] `POST /projects/{id}/jurors` con `stage = "sustentacion"` y `juror_number = 3` → `400` con mensaje: "No existe Jurado 3 en sustentación"
  - [ ] Test unitario que verifica este bloqueo
- **Dependencias:** T-F07-02
- **Estado:** ⬜ Pendiente

---

### T-F07-04 — Implementar autorización de biblioteca por estudiante
- **Módulo(s):** MOD-13
- **Referencias:** RF-13-01
- **Descripción:** Una vez en estado `trabajo_aprobado`, el sistema habilita al estudiante para diligenciar el formato de autorización de publicación en biblioteca.
- **Criterios de aceptación:**
  - [ ] `POST /projects/{id}/act` body con `library_authorization: boolean` → inicialmente solo guarda la autorización (paso previo al acta) — o alternativamente existe un endpoint dedicado `PATCH /projects/{id}/library-authorization`
  - [ ] Valida estado `trabajo_aprobado` → `409` si distinto
  - [ ] Solo el estudiante con pertenencia activa puede diligenciarla → `403` para otros roles
  - [ ] Una vez diligenciada, queda guardada en `project_acts` (con `issued_at = null` hasta que el Admin emita el acta)
  - [ ] Mensaje automático al Administrador: "El estudiante [nombre] ha diligenciado la autorización de biblioteca para el trabajo [título]."
- **Dependencias:** T-F07-02
- **Estado:** ⬜ Pendiente

---

### T-F07-05 — Implementar emisión del acta (`POST /projects/{id}/act`)
- **Módulo(s):** MOD-13
- **Referencias:** RF-13-02..RF-13-05
- **Descripción:** El Administrador emite el acta de sustentación/aprobación. El estado cambia a `acta_generada`.
- **Criterios de aceptación:**
  - [ ] `POST /api/v1/projects/{id}/act` body: `{ act_number?, file? (multipart) }` → `201` (solo Administrador)
  - [ ] Valida que la autorización de biblioteca ya fue diligenciada → `409` si no
  - [ ] Valida estado `trabajo_aprobado` → `409` si distinto
  - [ ] Si se adjunta archivo del acta: sube a Supabase Storage y registra `storage_path`
  - [ ] `status → acta_generada`, registra en `project_status_history`
  - [ ] Mensaje automático al estudiante: "Tu acta ha sido emitida. Puedes descargarla desde el sistema."
  - [ ] `GET /projects/{id}/act` → `200` detalle del acta (todos con pertenencia)
  - [ ] El estudiante puede descargar el acta: genera URL firmada desde `storage_path`
- **Dependencias:** T-F07-04
- **Estado:** ⬜ Pendiente

---

### T-F07-06 — Implementar asignación de jurados para sustentación
- **Módulo(s):** MOD-12
- **Referencias:** `specs/arch/API.md` §Jurados, `specs/arch/ENUMS.md` §project_jurors.stage
- **Descripción:** El Administrador asigna los jurados que evaluarán la sustentación (pueden ser los mismos del producto final).
- **Criterios de aceptación:**
  - [ ] `POST /projects/{id}/jurors` body: `{ user_id, juror_number: 1|2, stage: "sustentacion" }` → `201` (solo Administrador)
  - [ ] Valida estado `aprobado_para_sustentacion` → `409` si distinto
  - [ ] Valida docente activo → `400`
  - [ ] No permite `juror_number = 3` en `stage = "sustentacion"` → `400`
  - [ ] Se puede reutilizar la misma lógica del endpoint de jurados de anteproyecto/producto final
- **Dependencias:** T-F07-01
- **Estado:** ⬜ Pendiente

---

### T-F07-07 — Tests de integración: sustentación y acta
- **Módulo(s):** MOD-12, MOD-13
- **Referencias:** RF-12-01..RF-12-06, RF-13-01..RF-13-05
- **Descripción:** Tests de integración para todos los flujos de sustentación y generación de acta.
- **Criterios de aceptación:**
  - [ ] Test: Diplomado tecnológico no puede programar sustentación → `409`
  - [ ] Test: programar sustentación sin estado `aprobado_para_sustentacion` → `409`
  - [ ] Test: flujo completo aprobado (promedio ≥ 4.0) → `trabajo_aprobado`
  - [ ] Test: flujo completo reprobado (promedio < 4.0) → `reprobado_en_sustentacion`
  - [ ] Test: intentar asignar J3 en sustentación → `400`
  - [ ] Test: emitir acta sin autorización de biblioteca → `409`
  - [ ] Test: emitir acta en estado distinto a `trabajo_aprobado` → `409`
  - [ ] Test: estudiante puede descargar acta (URL firmada generada)
  - [ ] Test: estudiante ve calificaciones de sustentación sin identidad de jurado
  - [ ] Tests en `backend/tests/test_sustentacion.py`
- **Dependencias:** T-F07-05, T-F07-06
- **Estado:** ⬜ Pendiente

---

### T-F07-08 — Implementar reporte de jurados con calificaciones extemporáneas
- **Módulo(s):** MOD-17
- **Referencias:** RF-17-04, `specs/arch/API.md` §/reports
- **Descripción:** Reporte para el Administrador de docentes que registraron calificaciones fuera del plazo.
- **Criterios de aceptación:**
  - [ ] `GET /api/v1/reports/jurors/late` → `200` lista de evaluaciones con `is_extemporaneous = true`
  - [ ] Cada ítem: `docente_name`, `project_title`, `stage` (anteproyecto/producto_final), `deadline_date`, `submitted_at`, `days_late`
  - [ ] Solo Administrador → `403` para otros roles
- **Dependencias:** T-F05-10
- **Estado:** ⬜ Pendiente

---

### T-F07-09 — Implementar alerta de vencimiento próximo de jurados
- **Módulo(s):** MOD-17
- **Referencias:** RF-17-05, `specs/arch/API.md` §/reports
- **Descripción:** Reporte de jurados con plazo de evaluación activo próximo a vencer.
- **Criterios de aceptación:**
  - [ ] `GET /api/v1/reports/jurors/expiring?days=N` → `200` lista de evaluaciones aún sin calificar cuyo `deadline_date` vence en los próximos N días hábiles
  - [ ] `N` configurable; valor por defecto desde `RF-01-07` (parámetro global del sistema)
  - [ ] Cada ítem: `docente_name`, `project_title`, `stage`, `deadline_date`, `business_days_remaining`
  - [ ] Solo Administrador
- **Dependencias:** T-F07-08
- **Estado:** ⬜ Pendiente
