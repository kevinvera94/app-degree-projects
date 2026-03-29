# ENUMS.md — Constantes y valores de enumeración
> Referencia centralizada de todos los valores enum usados en el sistema.
> Mantener sincronizado con `DATA-MODEL.md` y el código fuente.

---

## Estados del trabajo (`thesis_projects.status`)

| Valor | Descripción |
|---|---|
| `pendiente_evaluacion_idea` | Idea inscrita, en espera de revisión del CTG |
| `idea_aprobada` | Idea aprobada. También estado de retorno tras reprobación de anteproyecto |
| `idea_rechazada` | Idea rechazada por el CTG |
| `anteproyecto_pendiente_evaluacion` | Anteproyecto radicado, en espera de asignación/evaluación de jurados |
| `anteproyecto_aprobado` | Estado transitorio antes de `en_desarrollo` (no visible como estado final) |
| `anteproyecto_reprobado` | Anteproyecto reprobado unánimemente — retorna a `idea_aprobada` |
| `correcciones_anteproyecto_solicitadas` | Jurados solicitaron correcciones. Permanece hasta que el estudiante radique correcciones |
| `anteproyecto_corregido_entregado` | Estudiante entregó correcciones — 2a revisión iniciada automáticamente |
| `en_desarrollo` | Anteproyecto aprobado (1a o 2a revisión). El estudiante desarrolla el trabajo |
| `producto_final_entregado` | Producto final radicado, en espera de asignación/evaluación de jurados |
| `en_revision_jurados_producto_final` | Jurados evaluando el producto final |
| `correcciones_producto_final_solicitadas` | Jurados solicitaron correcciones al producto final |
| `producto_final_corregido_entregado` | Estudiante entregó correcciones al producto final — 2a revisión iniciada |
| `aprobado_para_sustentacion` | Producto final aprobado, pendiente de programar sustentación |
| `sustentacion_programada` | Sustentación con fecha, hora y lugar registrados |
| `trabajo_aprobado` | Sustentación aprobada (o Diplomado tecnológico sin sustentación). Pendiente de acta |
| `reprobado_en_sustentacion` | Sustentación reprobada — estudiante debe inscribir nueva idea desde cero |
| `acta_generada` | Proceso completado. Acta emitida |
| `suspendido_por_plagio` | Suspendido por plagio comprobado — puede ocurrir en cualquier etapa |
| `cancelado` | Archivado por el Administrador (ej. trabajo abandonado) — no fuerza nueva inscripción |

---

## Roles de usuario (`users.role`)

| Valor | Descripción |
|---|---|
| `administrador` | Secretaria, directores de programa u otras personas designadas. Materializa decisiones del CTG y gestiona el sistema |
| `docente` | Docente registrado. Actúa como Director o Jurado según asignación por proyecto |
| `estudiante` | Inscribe ideas, radica documentos, consulta estado |

---

## Niveles académicos (`academic_programs.level`)

| Valor | Descripción |
|---|---|
| `tecnologico` | Programa tecnológico (2-3 años) |
| `profesional` | Programa profesional universitario |
| `especializacion` | Especialización (posgrado) |
| `maestria_profundizacion` | Maestría de profundización |
| `maestria_investigacion` | Maestría de investigación |
| `doctorado` | Doctorado |

---

## Tipos de ventana de fechas (`date_windows.type`)

| Valor | Descripción |
|---|---|
| `inscripcion_idea` | Ventana para inscribir nuevas ideas |
| `radicacion_anteproyecto` | Ventana para radicar anteproyectos |
| `radicacion_producto_final` | Ventana para radicar producto final |
| `extemporanea` | Ventana individual habilitada para un trabajo específico |

---

## Tipos de adjunto (`attachments.attachment_type`)

| Valor | Descripción | Aplica en |
|---|---|---|
| `plantilla` | Documento en la plantilla institucional | Todas las modalidades |
| `carta_aval` | Carta de aval del director (debe indicar verificación de similitud ≤20%) | Todas las modalidades |
| `reporte_similitud` | Reporte del software antiplagio | Todas las modalidades |
| `aval_etica` | Aval del comité de ética | Investigación |
| `certificacion_plan_negocio` | Certificación de inscripción del Plan de Negocio | Innovación y Emprendimiento (producto final) |
| `carta_impacto` | Carta de impacto empresarial | Trabajos vinculados a empresa |
| `autorizacion_biblioteca` | Autorización para publicación en biblioteca | Etapa de acta |
| `retiro_integrante` | Justificación + aval del director para retiro de integrante | MOD-08 |
| `otro` | Adjunto adicional a criterio del Administrador | Cualquier etapa |

---

## Etapas de evaluación (`evaluations.stage`, `project_jurors.stage`)

| Valor | Descripción |
|---|---|
| `anteproyecto` | Evaluación del documento de anteproyecto |
| `producto_final` | Evaluación del producto final |
| `sustentacion` | Calificación de la sustentación pública |

---

## Grupos de investigación (`thesis_projects.research_group`)

| Valor en BD | Nombre visible | Descripción |
|---|---|---|
| `GIEIAM` | GIEIAM | Grupo de Investigación en Ingeniería, Automatización y Manufactura |
| `COMBA_ID` | COMBA I+D | Grupo de Investigación en Comunicaciones y Bases de Datos |

---

## Número de jurado (`project_jurors.juror_number`, `evaluations.juror_number`)

| Valor | Descripción |
|---|---|
| `1` | Jurado 1 — evaluador principal |
| `2` | Jurado 2 — segundo evaluador |
| `3` | Jurado 3 — evaluador adicional designado en caso de divergencia (1 aprueba, 1 reprueba) |
