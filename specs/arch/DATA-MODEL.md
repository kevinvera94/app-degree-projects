# DATA-MODEL.md — Modelo de datos
> Entidades, campos, relaciones y diagrama ER del sistema.
> Última actualización: 2026-03-28

---

## Diagrama ER (simplificado)

```
users ──────────────────────────────────────────────────────────────┐
  │                                                                  │
  ├──< student_profiles (1:1)                                        │
  ├──< project_members >── thesis_projects ──< project_directors     │
  │                              │                                   │
  │                              ├──< project_jurors                 │
  │                              ├──< submissions ──< attachments    │
  │                              ├──< evaluations                    │
  │                              ├──< sustentations                  │
  │                              ├──< acts                           │
  │                              ├──< messages                       │
  │                              ├──< project_status_history         │
  │                              └──< extemporaneous_windows         │
  │                                                                  │
  ├──< date_windows (created_by)                                     │
  └──< modalities (created_by)                                       │
                                                                     │
academic_programs ──────────────────────────────────────────────────┘
```

---

## Entidades

### `users`
| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid PK | ID Supabase Auth |
| `email` | varchar unique | Email institucional |
| `full_name` | varchar(150) | Nombre completo |
| `role` | enum | `administrador` \| `docente` \| `estudiante` |
| `is_active` | boolean | Acceso habilitado. Para docentes: `false` indica que ya no está en ejercicio y no puede ser asignado como director ni jurado |
| `created_at` | timestamp | Fecha de registro |
| `updated_at` | timestamp | Última modificación |

---

### `student_profiles`
Datos adicionales exclusivos del rol `estudiante`.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → users **UNIQUE** | Garantiza relación 1:1 con users |
| `cedula` | varchar(20) | Documento de identidad |
| `phone` | varchar(20) | Celular |
| `address` | text | Dirección |
| `semester` | integer | Semestre actual |
| `academic_program_id` | uuid FK → academic_programs | Programa del estudiante |

---

### `academic_programs`
| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid PK | |
| `name` | varchar(150) | Nombre del programa |
| `level` | enum | `tecnologico` \| `profesional` \| `maestria_profundizacion` \| `maestria_investigacion` \| `especializacion` \| `doctorado` |
| `faculty` | varchar(100) | Default: `Ingeniería` |
| `is_active` | boolean | |

---

### `modalities`
Configurable por el Administrador.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid PK | |
| `name` | varchar(100) | Ej.: `Investigación`, `Monografía` |
| `levels` | enum[] | Niveles en que aplica la modalidad |
| `max_members` | integer | Máx. integrantes (configurable) |
| `requires_sustentation` | boolean | `false` para Diplomado tecnológico |
| `requires_ethics_approval` | boolean | `true` para Investigación |
| `requires_business_plan_cert` | boolean | `true` para Innovación y Emprendimiento |
| `is_active` | boolean | |
| `created_by` | uuid FK → users | Administrador que creó/configuró la modalidad |
| `created_at` | timestamp | |

---

### `date_windows`
Ventanas de fechas habilitadas por el Administrador.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid PK | |
| `period` | varchar(10) | Ej.: `2026-1` |
| `window_type` | enum | `inscripcion_idea` \| `radicacion_anteproyecto` \| `radicacion_producto_final` |
| `start_date` | date | |
| `end_date` | date | |
| `is_active` | boolean | |
| `created_by` | uuid FK → users | Administrador que la creó |
| `created_at` | timestamp | |

---

### `extemporaneous_windows`
Ventana individual habilitada por el Administrador para un trabajo específico.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid PK | |
| `project_id` | uuid FK → thesis_projects | |
| `stage` | enum | `inscripcion_idea` \| `radicacion_anteproyecto` \| `radicacion_producto_final` |
| `granted_by` | uuid FK → users | Administrador que la habilitó |
| `granted_at` | timestamp | |
| `valid_until` | date | Fecha límite de la ventana excepcional |
| `notes` | text | Justificación |

---

### `thesis_projects`
Entidad central del sistema.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid PK | |
| `title` | varchar(100) | Nombre del trabajo |
| `modality_id` | uuid FK → modalities | |
| `academic_program_id` | uuid FK → academic_programs | |
| `period` | varchar(10) | Periodo de inscripción |
| `research_line` | varchar(200) | Línea de investigación |
| `research_group` | enum | `GIEIAM` \| `COMBA_ID` (representa "COMBA I+D") |
| `suggested_director` | varchar(150) | Opcional, texto libre |
| `has_company_link` | boolean | Vinculado a empresa/organización |
| `status` | enum | Ver estados abajo |
| `plagiarism_suspended` | boolean | Suspendido por plagio |
| `plagiarism_suspended_at` | timestamp nullable | Fecha de la suspensión por plagio |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

**Estados del trabajo (`status`):**
```
pendiente_evaluacion_idea
idea_aprobada                          ← también estado de retorno tras anteproyecto_reprobado
idea_rechazada
anteproyecto_pendiente_evaluacion
anteproyecto_aprobado
anteproyecto_reprobado                 → retorna a idea_aprobada (nueva radicación de anteproyecto)
correcciones_anteproyecto_solicitadas
anteproyecto_corregido_entregado
en_desarrollo                          ← transición automática al aprobarse el anteproyecto
producto_final_entregado
en_revision_jurados_producto_final
correcciones_producto_final_solicitadas
producto_final_corregido_entregado
aprobado_para_sustentacion
sustentacion_programada
trabajo_aprobado                       ← Diplomado tecnológico llega aquí directamente desde producto_final aprobado
reprobado_en_sustentacion              → nueva inscripción de idea desde cero
acta_generada
suspendido_por_plagio                  ← puede ocurrir en cualquier etapa
```

---

### `project_members`
Integrantes del trabajo (rol estudiante).

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid PK | |
| `project_id` | uuid FK → thesis_projects | |
| `student_id` | uuid FK → users | |
| `is_active` | boolean | |
| `joined_at` | timestamp | |
| `removed_at` | timestamp nullable | |
| `removal_reason` | text nullable | Justificación del retiro |
| `removal_attachment_url` | text nullable | URL Supabase Storage — documento con justificación y aval del director |

---

### `project_directors`
Directores asignados al trabajo (máx. 2, el primero debe ser docente USC en ejercicio).

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid PK | |
| `project_id` | uuid FK → thesis_projects | |
| `docente_id` | uuid FK → users | |
| `order` | integer | `1` (principal) o `2` (co-director) |
| `assigned_by` | uuid FK → users | Administrador que asignó |
| `assigned_at` | timestamp | |
| `is_active` | boolean | |

---

### `project_jurors`
Jurados asignados por etapa.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid PK | |
| `project_id` | uuid FK → thesis_projects | |
| `docente_id` | uuid FK → users | |
| `juror_number` | integer | `1`, `2` o `3` |
| `stage` | enum | `anteproyecto` \| `producto_final` \| `sustentacion` |
| `assigned_by` | uuid FK → users | |
| `assigned_at` | timestamp | |
| `is_active` | boolean | |
| `replaced_docente_id` | uuid FK → users nullable | Si este jurado reemplazó a otro en producto_final, referencia al docente reemplazado para trazabilidad |

---

### `submissions`
Radicaciones formales de documentos.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid PK | |
| `project_id` | uuid FK → thesis_projects | |
| `stage` | enum | `anteproyecto` \| `correcciones_anteproyecto` \| `producto_final` \| `correcciones_producto_final` |
| `submitted_at` | timestamp | |
| `submitted_by` | uuid FK → users | |
| `date_window_id` | uuid FK → date_windows nullable | Null si es ventana extemporánea |
| `is_extemporaneous` | boolean | |
| `revision_number` | integer | `1` o `2` |
| `status` | enum | `pendiente` \| `en_revision` \| `aprobado` \| `reprobado` \| `con_correcciones` |

---

### `attachments`
Documentos adjuntos a una radicación.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid PK | |
| `submission_id` | uuid FK → submissions | |
| `attachment_type` | enum | `plantilla` \| `carta_aval` \| `reporte_similitud` \| `aval_etica` \| `certificacion_plan_negocio` \| `carta_impacto` \| `autorizacion_biblioteca` \| `otro` |
| `file_name` | varchar(255) | |
| `file_url` | text | URL de Supabase Storage |
| `uploaded_at` | timestamp | |
| `uploaded_by` | uuid FK → users | |

---

### `evaluations`
Calificaciones emitidas por jurados.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid PK | |
| `project_id` | uuid FK → thesis_projects | |
| `submission_id` | uuid FK → submissions | |
| `juror_id` | uuid FK → users | |
| `juror_number` | integer | `1`, `2` o `3` |
| `stage` | enum | `anteproyecto` \| `producto_final` |
| `score` | decimal(3,1) | Calificación numérica |
| `observations` | text | |
| `submitted_at` | timestamp | |
| `due_date` | timestamp | Fecha límite calculada como: `assigned_at + N días hábiles` excluyendo fines de semana y festivos del `USC_HOLIDAYS_FILE`. N=15 para primera revisión, N=10 para segunda |
| `is_extemporaneous` | boolean | Registrada fuera del plazo |
| `revision_number` | integer | `1` o `2` |

---

### `sustentations`
Registro de la sustentación pública.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid PK | |
| `project_id` | uuid FK → thesis_projects unique | |
| `scheduled_at` | timestamp | Fecha y hora programada |
| `location` | varchar(200) | Lugar |
| `final_score` | decimal(3,1) nullable | Promedio calculado de las calificaciones de los jurados |
| `is_approved` | boolean nullable | Calculado: `final_score >= 4.0` |
| `registered_at` | timestamp | Fecha de programación de la sustentación |
| `registered_by` | uuid FK → users | Administrador que programó la sustentación |

---

### `sustentation_evaluations`
Calificación individual de cada jurado en la sustentación (D4: promediadas para el resultado final).

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid PK | |
| `sustentation_id` | uuid FK → sustentations | |
| `juror_id` | uuid FK → users | Jurado que registró la calificación |
| `juror_number` | integer | `1` o `2` — anonimato para el estudiante |
| `score` | decimal(3,1) | Calificación 0.0 a 5.0 |
| `submitted_at` | timestamp | |
| `submitted_by` | uuid FK → users | Jurado o Administrador que registró |

> **Regla:** cuando ambos jurados han enviado su calificación, el sistema calcula `sustentations.final_score = promedio(score_jurado1, score_jurado2)` y determina `is_approved`. No existe Jurado 3 en sustentación.

---

### `acts`
Actas de aprobación generadas.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid PK | |
| `project_id` | uuid FK → thesis_projects unique | |
| `issued_at` | timestamp | |
| `issued_by` | uuid FK → users | Administrador |
| `library_authorization` | boolean | Estudiante autoriza publicación |
| `act_file_url` | text | URL Supabase Storage |

---

### `messages`
Mensajería asíncrona entre usuarios del trabajo.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid PK | |
| `project_id` | uuid FK → thesis_projects | |
| `sender_id` | uuid FK → users | |
| `recipient_id` | uuid FK → users nullable | Null = todos los actores del trabajo |
| `content` | text | |
| `sent_at` | timestamp | |
| `is_read` | boolean | |
| `read_at` | timestamp nullable | |
| `sender_display` | varchar(50) | Nombre visible para el receptor. Si el emisor es jurado, el sistema lo establece automáticamente como "Jurado 1" o "Jurado 2" según `project_jurors.juror_number`. Para otros roles, se usa `users.full_name` |

---

### `project_status_history`
Trazabilidad de cada cambio de estado.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid PK | |
| `project_id` | uuid FK → thesis_projects | |
| `previous_status` | varchar | |
| `new_status` | varchar | |
| `changed_by` | uuid FK → users NOT NULL | Usuario (o sistema automático vía service account) que causó el cambio |
| `changed_at` | timestamp | |
| `notes` | text nullable | Motivo del cambio |

---

## Relaciones clave

| Relación | Tipo | Nota |
|---|---|---|
| `users` → `student_profiles` | 1:1 | Solo para rol estudiante |
| `thesis_projects` → `project_members` | 1:N | Máx. según modalidad |
| `thesis_projects` → `project_directors` | 1:N | Máx. 2 |
| `thesis_projects` → `project_jurors` | 1:N | Máx. 3 (Jurado 3 eventual) por etapa |
| `thesis_projects` → `submissions` | 1:N | Una por etapa/revisión |
| `submissions` → `attachments` | 1:N | Mín. 3 obligatorios |
| `thesis_projects` → `evaluations` | 1:N | Por jurado, por etapa |
| `thesis_projects` → `sustentations` | 1:1 | Una sola sustentación |
| `sustentations` → `sustentation_evaluations` | 1:N | Una por jurado (máx. 2) |
| `thesis_projects` → `acts` | 1:1 | Un solo acta |
