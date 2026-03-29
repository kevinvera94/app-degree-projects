# FASE-06 — Backend: Producto final y evaluación
> Parte del plan de tareas. Ver índice en `specs/TASKS.md`.
> Módulos cubiertos: MOD-09, MOD-10, MOD-11.
> Objetivo: implementar la radicación del producto final, la evaluación por jurados (con Jurado 3 cuando aplica), correcciones, y las transiciones especiales para la modalidad Diplomado.

---

## Notas de fase

- El flujo del producto final es análogo al del anteproyecto (FASE-05), con diferencias clave:
  - Adjuntos adicionales: `certificacion_plan_negocio` (Innovación), `carta_impacto` (empresa)
  - Diplomado tecnológico: producto final aprobado → `trabajo_aprobado` directamente (omite sustentación)
  - Producto final reprobado → retorna a `en_desarrollo` (no a `idea_aprobada`)
- Reutilizar/refactorizar la lógica de evaluación de la FASE-05 donde sea posible.

---

## Tareas

### T-F06-01 — Implementar radicación de producto final
- **Módulo(s):** MOD-09
- **Referencias:** RF-09-01..RF-09-06
- **Descripción:** El estudiante radica el producto final con los adjuntos requeridos. La lógica es análoga a la del anteproyecto con adjuntos adicionales según modalidad.
- **Criterios de aceptación:**
  - [ ] `POST /projects/{id}/submissions` body: `{ stage: "producto_final", academic_period }` → `201` (solo Estudiante con pertenencia activa)
  - [ ] Valida estado `en_desarrollo` → `409` si estado distinto
  - [ ] Valida ventana activa para `radicacion_producto_final` (global o extemporánea) → `409`
  - [ ] Al confirmar radicación: valida adjuntos obligatorios:
    - Todas las modalidades: `plantilla`, `carta_aval`, `reporte_similitud`
    - Modalidad `Innovación y Emprendimiento`: además `certificacion_plan_negocio`
    - Trabajo vinculado a empresa: `carta_impacto` es condicional (puede estar o no; Admin valida después)
  - [ ] Si falta adjunto obligatorio → `400` con lista de faltantes
  - [ ] Al confirmar: `status → producto_final_entregado`, registra en `project_status_history`
  - [ ] Mensaje automático al Administrador: "Producto final radicado: [título]"
- **Dependencias:** T-F05-10
- **Estado:** ⬜ Pendiente

---

### T-F06-02 — Implementar asignación de jurados al producto final
- **Módulo(s):** MOD-10
- **Referencias:** RF-10-01, RF-10-02
- **Descripción:** El Administrador asigna Jurado 1 y Jurado 2 al producto final. El sistema sugiere los mismos jurados del anteproyecto cuando estén disponibles.
- **Criterios de aceptación:**
  - [ ] `POST /projects/{id}/jurors` body: `{ user_id, juror_number: 1|2, stage: "producto_final" }` → `201` (solo Administrador)
  - [ ] Valida estado `producto_final_entregado` → `409` si distinto
  - [ ] `GET /projects/{id}` incluye en el detalle la sugerencia de jurados (`suggested_jurors[]`): los mismos del anteproyecto que estén activos
  - [ ] Si se asigna un docente diferente al del anteproyecto: el campo `replaced_docente_id` en `project_jurors` registra el ID del jurado original (trazabilidad)
  - [ ] Valida docente activo → `400` si inactivo
  - [ ] Al asignar ambos jurados: `status → en_revision_jurados_producto_final`. Inicia conteo de 15 días hábiles (igual a anteproyecto)
- **Dependencias:** T-F06-01
- **Estado:** ⬜ Pendiente

---

### T-F06-03 — Implementar registro de calificación del producto final
- **Módulo(s):** MOD-10
- **Referencias:** RF-10-03
- **Descripción:** Los jurados registran sus calificaciones del producto final. La lógica de plazos, extemporáneas y marcado es idéntica a la del anteproyecto.
- **Criterios de aceptación:**
  - [ ] `POST /projects/{id}/evaluations` body: `{ stage: "producto_final", score, observations }` → `201` (solo Docente jurado asignado en esta etapa)
  - [ ] Mismas validaciones que el anteproyecto: jurado asignado, plazo, `is_extemporaneous`
  - [ ] Respuesta diferenciada por rol (Estudiante: anónimo; Admin: completo; Director: con identidad)
- **Dependencias:** T-F06-02
- **Estado:** ⬜ Pendiente

---

### T-F06-04 — Implementar lógica de resultado del producto final (primera revisión)
- **Módulo(s):** MOD-10
- **Referencias:** RF-10-03, RF-10-04, RF-10-05
- **Descripción:** Cuando ambos jurados califican, el sistema determina el resultado. Incluye la bifurcación especial para Diplomado tecnológico.
- **Criterios de aceptación:**
  - [ ] Función de servicio `evaluate_producto_final_result(project_id)` ejecutada automáticamente al registrar la segunda calificación
  - [ ] Ambas ≥ 4.0 → `aprobado_para_sustentacion`
  - [ ] **Excepción Diplomado tecnológico:** si `modality.name == "Diplomado"` Y `program.level == "tecnologico"` → `trabajo_aprobado` directamente (sin pasar por sustentación)
  - [ ] Ambas entre 3.0 y 3.9 → `correcciones_producto_final_solicitadas`. `deadline_date = add_business_days(now(), 10, period)`
  - [ ] Ambas < 3.0 → `producto_final_reprobado` → `en_desarrollo` (retorno automático; el estudiante puede radicar nuevo producto final en la siguiente ventana)
  - [ ] Divergencia (una ≥ 4.0, otra < 3.0) → notifica Administrador para Jurado 3. Estado: `en_revision_jurados_producto_final`
  - [ ] Mensajes automáticos en todos los casos (al estudiante y/o admin según corresponda)
  - [ ] Todos los cambios de estado en `project_status_history`
- **Dependencias:** T-F06-03
- **Estado:** ⬜ Pendiente

---

### T-F06-05 — Implementar Jurado 3 para producto final
- **Módulo(s):** MOD-10
- **Referencias:** RF-10-02 (Jurado 3 flujo separado), RF-10-03
- **Descripción:** Asignación y registro de calificación del Jurado 3 para el producto final (primera revisión). Solo acepta Aprobado o Reprobado.
- **Criterios de aceptación:**
  - [ ] `POST /projects/{id}/jurors` body: `{ user_id, juror_number: 3, stage: "producto_final" }` → `201` (solo Administrador, solo con divergencia activa)
  - [ ] La calificación del J3 solo acepta `score >= 4.0` o `score < 3.0` → `400` si `3.0 <= score < 4.0`
  - [ ] J3 aprueba → `aprobado_para_sustentacion` (o `trabajo_aprobado` para Diplomado)
  - [ ] J3 reprueba → `producto_final_reprobado` → `en_desarrollo`
- **Dependencias:** T-F06-04
- **Estado:** ⬜ Pendiente

---

### T-F06-06 — Implementar correcciones del producto final
- **Módulo(s):** MOD-11
- **Referencias:** RF-11-01..RF-11-04
- **Descripción:** Flujo de correcciones del producto final. Análogo a MOD-07 pero con retorno a `en_desarrollo` en lugar de `idea_aprobada`.
- **Criterios de aceptación:**
  - [ ] `POST /projects/{id}/submissions` body: `{ stage: "producto_final", is_correction: true, academic_period }` → `201` (solo Estudiante)
  - [ ] Valida estado `correcciones_producto_final_solicitadas` → `409` si distinto
  - [ ] Valida ventana activa para `radicacion_producto_final` O plazo vigente → `409` si ambos vencidos
  - [ ] Al confirmar: `status → producto_final_corregido_entregado`. Registra `start_date = submitted_at`. Calcula nuevo `deadline_date = add_business_days(start_date, 10, period)`
  - [ ] Mensaje automático a los jurados: "El estudiante entregó correcciones del producto final. Plazo: [deadline_date]"
- **Dependencias:** T-F06-04
- **Estado:** ⬜ Pendiente

---

### T-F06-07 — Implementar segunda revisión del producto final
- **Módulo(s):** MOD-11
- **Referencias:** RF-11-02, RF-11-03, RF-11-04
- **Descripción:** Segunda revisión del producto final. Solo aprobado/reprobado. Divergencia genera Jurado 3. Reprobación retorna a `en_desarrollo`.
- **Criterios de aceptación:**
  - [ ] Segunda revisión: solo acepta `score >= 4.0` o `score < 3.0` → `400` si `3.0 <= score < 4.0`
  - [ ] Ambas aprobadas → `aprobado_para_sustentacion` (o `trabajo_aprobado` para Diplomado)
  - [ ] Ambas reprobadas (o J3 reprueba) → `producto_final_reprobado` → `en_desarrollo`
  - [ ] Divergencia → Jurado 3 (mismo flujo de T-F06-05 pero con `is_correction = true`)
  - [ ] Bloqueo de entrega de correcciones por incumplimiento de plazo: mismo comportamiento que MOD-07 (T-F05-07)
- **Dependencias:** T-F06-06
- **Estado:** ⬜ Pendiente

---

### T-F06-08 — Implementar suspensión por plagio
- **Módulo(s):** MOD-14
- **Referencias:** RF-14-01..RF-14-04
- **Descripción:** El Administrador puede suspender cualquier trabajo de grado en cualquier etapa por plagio comprobado.
- **Criterios de aceptación:**
  - [ ] `PATCH /projects/{id}/status` body: `{ action: "suspender_plagio", reason: "..." }` → `200` (solo Administrador)
  - [ ] `reason` obligatorio → `400` si vacío
  - [ ] `status → suspendido_por_plagio` desde cualquier estado (excepto `acta_generada` y `cancelado`) → `409` si ya está en estado terminal
  - [ ] Un trabajo suspendido bloquea cualquier otra acción de avance → `409`
  - [ ] Registra en `project_status_history` con fecha, actor y motivo
  - [ ] Mensaje automático al estudiante: "Tu trabajo ha sido suspendido. Motivo: [reason]"
- **Dependencias:** T-F06-07
- **Estado:** ⬜ Pendiente

---

### T-F06-09 — Tests de integración: producto final y correcciones
- **Módulo(s):** MOD-09, MOD-10, MOD-11, MOD-14
- **Referencias:** RF-09-01..RF-09-06, RF-10-01..RF-10-05, RF-11-01..RF-11-04, RF-14-01..RF-14-04
- **Descripción:** Tests de integración para los flujos del producto final.
- **Criterios de aceptación:**
  - [ ] Test: radicar producto final sin ventana activa → `409`
  - [ ] Test: Innovación sin `certificacion_plan_negocio` → `400`
  - [ ] Test: producto final aprobado (ambas ≥ 4.0) → `aprobado_para_sustentacion`
  - [ ] Test: Diplomado tecnológico aprobado → `trabajo_aprobado` (sin sustentación)
  - [ ] Test: producto final reprobado → `en_desarrollo` (no `idea_aprobada`)
  - [ ] Test: divergencia → J3 → aprueba → `aprobado_para_sustentacion`
  - [ ] Test: correcciones → segunda revisión → aprobado → `aprobado_para_sustentacion`
  - [ ] Test: correcciones → segunda revisión → reprobado → `en_desarrollo`
  - [ ] Test: suspensión por plagio en estado `en_desarrollo` → `suspendido_por_plagio`
  - [ ] Test: intentar avanzar proyecto suspendido → `409`
  - [ ] Tests en `backend/tests/test_producto_final.py`
- **Dependencias:** T-F06-08
- **Estado:** ⬜ Pendiente

---

### T-F06-10 — Implementar señales de estado para el Administrador (pendientes de acción)
- **Módulo(s):** MOD-09, MOD-10, MOD-17
- **Referencias:** RF-17-02, `specs/arch/API.md` §/reports
- **Descripción:** Endpoint de reporte de proyectos pendientes de evaluación (sin jurados asignados o sin calificación registrada).
- **Criterios de aceptación:**
  - [ ] `GET /api/v1/reports/projects/pending-review` → `200` lista de proyectos en estados: `anteproyecto_pendiente_evaluacion`, `producto_final_entregado`, `en_revision_jurados_producto_final` (sin calificación completa)
  - [ ] Cada ítem indica el número de días transcurridos desde la radicación
  - [ ] Solo Administrador → `403` para otros roles
- **Dependencias:** T-F06-08
- **Estado:** ⬜ Pendiente

---

### T-F06-11 — Implementar reporte de correcciones sin respuesta
- **Módulo(s):** MOD-11, MOD-17
- **Referencias:** RF-17-03, `specs/arch/API.md` §/reports
- **Descripción:** Reporte de proyectos con correcciones solicitadas donde el estudiante no ha respondido.
- **Criterios de aceptación:**
  - [ ] `GET /api/v1/reports/projects/pending-corrections` → `200` lista de proyectos en estados: `correcciones_anteproyecto_solicitadas`, `correcciones_producto_final_solicitadas`
  - [ ] Cada ítem incluye: `project_id`, `title`, `status`, `deadline_date`, días hábiles restantes (puede ser negativo si ya venció)
  - [ ] Solo Administrador
- **Dependencias:** T-F06-10
- **Estado:** ⬜ Pendiente
