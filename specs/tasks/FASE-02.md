# FASE-02 — Base de datos: esquema y migraciones
> Parte del plan de tareas. Ver índice en `specs/TASKS.md`.
> Objetivo: crear todas las tablas, relaciones, índices y constraints del modelo de datos en Supabase/PostgreSQL.
> Referencia completa: `specs/arch/DATA-MODEL.md` y `specs/arch/ENUMS.md`.

---

## Notas de fase

- Todas las migraciones se aplican en Supabase (editor SQL o migraciones por archivo).
- El orden de creación debe respetar las dependencias de foreign keys.
- Los tipos `enum` de PostgreSQL deben crearse antes de las tablas que los usan.
- Para el MVP, Row Level Security (RLS) de Supabase se deja deshabilitado en todas las tablas — el control de acceso lo gestiona el backend FastAPI.

---

## Tareas

### T-F02-01 — Crear tipos ENUM en PostgreSQL
- **Módulo(s):** Todos
- **Referencias:** `specs/arch/ENUMS.md`
- **Descripción:** Crear todos los tipos `ENUM` de PostgreSQL necesarios antes de crear las tablas.
- **Criterios de aceptación:**
  - [x] `project_status` con los 21 valores documentados en ENUMS.md
  - [x] `user_role` con valores: `administrador`, `docente`, `estudiante`
  - [x] `academic_level` con valores: `tecnologico`, `profesional`, `especializacion`, `maestria_profundizacion`, `maestria_investigacion`, `doctorado`
  - [x] `window_type` con valores: `inscripcion_idea`, `radicacion_anteproyecto`, `radicacion_producto_final`
  - [x] `attachment_type` con valores: `plantilla`, `carta_aval`, `reporte_similitud`, `aval_etica`, `certificacion_plan_negocio`, `carta_impacto`, `autorizacion_biblioteca`, `retiro_integrante`, `otro`
  - [x] `evaluation_stage` con valores: `anteproyecto`, `producto_final`
  - [x] `juror_stage` con valores: `anteproyecto`, `producto_final`, `sustentacion`
  - [x] `research_group` con valores: `GIEIAM`, `COMBA_ID`
  - [x] Script SQL de creación de ENUMs guardado en `backend/migrations/001_enums.sql`
- **Dependencias:** T-F01-05
- **Estado:** ✅ Completada

---

### T-F02-02 — Crear tablas `users` y `student_profiles`
- **Módulo(s):** MOD-01, MOD-03
- **Referencias:** `specs/arch/DATA-MODEL.md` (entidades users, student_profiles)
- **Descripción:** Crear la tabla `users` (extiende `auth.users`) y `student_profiles` para datos adicionales de estudiantes.
- **Criterios de aceptación:**
  - [x] Tabla `users`: `id UUID PK (ref auth.users)`, `full_name VARCHAR(150) NOT NULL`, `email VARCHAR UNIQUE NOT NULL`, `role user_role NOT NULL`, `is_active BOOLEAN DEFAULT true`, `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ`
  - [x] Tabla `student_profiles`: `id UUID PK`, `user_id UUID FK(users) UNIQUE`, `cedula VARCHAR(20)`, `phone VARCHAR(20)`, `address TEXT`, `semester INTEGER`, `academic_program_id UUID FK(academic_programs)`
  - [x] Trigger o lógica de backend que crea el registro en `users` al crear usuario en Supabase Auth
  - [x] Scripts en `backend/migrations/002_users.sql`
- **Dependencias:** T-F02-01
- **Estado:** ✅ Completada

---

### T-F02-03 — Crear tablas `academic_programs` y `modalities`
- **Módulo(s):** MOD-01
- **Referencias:** `specs/arch/DATA-MODEL.md`
- **Descripción:** Crear tablas de catálogos configurables por el Administrador.
- **Criterios de aceptación:**
  - [x] Tabla `academic_programs`: `id UUID PK`, `name VARCHAR(150) NOT NULL`, `level academic_level NOT NULL`, `faculty VARCHAR(100) DEFAULT 'Ingeniería'`, `is_active BOOLEAN DEFAULT true`
  - [x] Tabla `modalities`: `id UUID PK`, `name VARCHAR(100) NOT NULL`, `levels academic_level[]`, `max_members INT NOT NULL`, `requires_sustentation BOOLEAN DEFAULT true`, `requires_ethics_approval BOOLEAN DEFAULT false`, `requires_business_plan_cert BOOLEAN DEFAULT false`, `is_active BOOLEAN DEFAULT true`, `created_by UUID FK(users)`, `created_at TIMESTAMPTZ`
  - [x] Tabla `modality_level_limits`: `id UUID PK`, `modality_id UUID FK(modalities)`, `level academic_level NOT NULL`, `max_members INT NOT NULL`, `updated_by UUID FK(users)`, `updated_at TIMESTAMPTZ`, `UNIQUE(modality_id, level)`
  - [x] Scripts en `backend/migrations/003_programs_modalities.sql`
- **Dependencias:** T-F02-01
- **Estado:** ✅ Completada

---

### T-F02-04 — Crear tablas `date_windows` y `extemporaneous_windows`
- **Módulo(s):** MOD-02
- **Referencias:** `specs/arch/DATA-MODEL.md`, `specs/arch/ENUMS.md`
- **Descripción:** Crear tablas de gestión de ventanas de fechas (globales y extemporáneas por proyecto).
- **Criterios de aceptación:**
  - [x] Tabla `date_windows`: `id UUID PK`, `period VARCHAR(10) NOT NULL`, `window_type window_type NOT NULL`, `start_date DATE NOT NULL`, `end_date DATE NOT NULL`, `is_active BOOLEAN DEFAULT true`, `created_by UUID FK(users)`, `created_at TIMESTAMPTZ`
  - [x] Tabla `extemporaneous_windows`: `id UUID PK`, `project_id UUID FK(thesis_projects)`, `stage window_type NOT NULL`, `granted_by UUID FK(users)`, `granted_at TIMESTAMPTZ`, `valid_until DATE NOT NULL`, `notes TEXT`
  - [x] Constraint: `start_date < end_date` en `date_windows`; `valid_until > granted_at::date` en `extemporaneous_windows`
  - [x] Scripts en `backend/migrations/004_date_windows.sql`
- **Dependencias:** T-F02-01
- **Estado:** ✅ Completada

---

### T-F02-05 — Crear tabla `thesis_projects`
- **Módulo(s):** MOD-03, todos los demás
- **Referencias:** `specs/arch/DATA-MODEL.md`, `specs/arch/ENUMS.md`
- **Descripción:** Tabla central del sistema. Registra cada trabajo de grado con su estado actual.
- **Criterios de aceptación:**
  - [x] Tabla `thesis_projects`: `id UUID PK`, `title VARCHAR(100) NOT NULL`, `modality_id UUID FK(modalities)`, `academic_program_id UUID FK(academic_programs)`, `period VARCHAR(10) NOT NULL`, `research_line VARCHAR(200) NOT NULL`, `research_group research_group NOT NULL`, `suggested_director VARCHAR(150)`, `has_company_link BOOLEAN DEFAULT false`, `status project_status NOT NULL DEFAULT 'pendiente_evaluacion_idea'`, `plagiarism_suspended BOOLEAN DEFAULT false`, `plagiarism_suspended_at TIMESTAMPTZ`, `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ`
  - [x] Script en `backend/migrations/005_thesis_projects.sql`
- **Dependencias:** T-F02-03, T-F02-04
- **Estado:** ✅ Completada

---

### T-F02-06 — Crear tablas de relación: `project_members`, `project_directors`, `project_jurors`
- **Módulo(s):** MOD-03, MOD-04, MOD-06, MOD-08
- **Referencias:** `specs/arch/DATA-MODEL.md`
- **Descripción:** Tablas de asignación de actores a proyectos.
- **Criterios de aceptación:**
  - [x] Tabla `project_members`: `id UUID PK`, `project_id UUID FK(thesis_projects)`, `student_id UUID FK(users)`, `is_active BOOLEAN DEFAULT true`, `joined_at TIMESTAMPTZ`, `removed_at TIMESTAMPTZ`, `removal_reason TEXT`, `removal_attachment_url TEXT` (URL Supabase Storage del documento de retiro)
  - [x] Tabla `project_directors`: `id UUID PK`, `project_id UUID FK`, `docente_id UUID FK(users)`, `order INT CHECK(order IN (1,2))`, `assigned_by UUID FK(users)`, `assigned_at TIMESTAMPTZ`, `is_active BOOLEAN DEFAULT true`
  - [x] Constraint en `project_directors`: máximo 2 directores activos por proyecto (CHECK o trigger)
  - [x] Tabla `project_jurors`: `id UUID PK`, `project_id UUID FK`, `docente_id UUID FK(users)`, `juror_number SMALLINT CHECK(juror_number IN (1,2,3))`, `stage juror_stage NOT NULL`, `assigned_by UUID FK(users)`, `assigned_at TIMESTAMPTZ`, `is_active BOOLEAN DEFAULT true`, `replaced_docente_id UUID FK(users) NULLABLE`, `UNIQUE(project_id, juror_number, stage)`
  - [x] Scripts en `backend/migrations/006_project_relations.sql`
- **Dependencias:** T-F02-05
- **Estado:** ✅ Completada

---

### T-F02-07 — Crear tablas `submissions` y `attachments`
- **Módulo(s):** MOD-05, MOD-07, MOD-09, MOD-11
- **Referencias:** `specs/arch/DATA-MODEL.md`, `specs/arch/ENUMS.md`
- **Descripción:** Tablas para registro de radicaciones y sus documentos adjuntos.
- **Criterios de aceptación:**
  - [x] Tabla `submissions`: `id UUID PK`, `project_id UUID FK(thesis_projects)`, `stage VARCHAR NOT NULL` (valores: `anteproyecto | correcciones_anteproyecto | producto_final | correcciones_producto_final`), `submitted_by UUID FK(users)`, `submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `date_window_id UUID FK(date_windows) NULLABLE`, `is_extemporaneous BOOLEAN DEFAULT false`, `revision_number INT CHECK(revision_number IN (1,2))`, `status VARCHAR NOT NULL DEFAULT 'pendiente'` (valores: `pendiente | en_revision | aprobado | reprobado | con_correcciones`)
  - [x] Tabla `attachments`: `id UUID PK`, `submission_id UUID FK(submissions)`, `attachment_type attachment_type NOT NULL`, `file_name VARCHAR(255) NOT NULL`, `file_url TEXT NOT NULL` (URL Supabase Storage), `uploaded_by UUID FK(users)`, `uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()`
  - [x] Scripts en `backend/migrations/007_submissions_attachments.sql`
- **Dependencias:** T-F02-05
- **Estado:** ✅ Completada

---

### T-F02-08 — Crear tabla `evaluations`
- **Módulo(s):** MOD-06, MOD-07, MOD-10, MOD-11
- **Referencias:** `specs/arch/DATA-MODEL.md`, `specs/arch/ENUMS.md`
- **Descripción:** Tabla para registrar calificaciones de anteproyecto y producto final por cada jurado.
- **Criterios de aceptación:**
  - [x] Tabla `evaluations`: `id UUID PK`, `project_id UUID FK(thesis_projects)`, `submission_id UUID FK(submissions)`, `juror_id UUID FK(users)`, `juror_number SMALLINT CHECK(juror_number IN (1,2,3))`, `stage VARCHAR NOT NULL` (valores: `anteproyecto | producto_final`), `score DECIMAL(3,1) CHECK(score >= 0 AND score <= 5.0)`, `observations TEXT`, `submitted_at TIMESTAMPTZ`, `start_date TIMESTAMPTZ` (inicio del conteo del plazo), `due_date TIMESTAMPTZ` (start_date + N días hábiles), `is_extemporaneous BOOLEAN DEFAULT false`, `revision_number INT CHECK(revision_number IN (1,2))`
  - [x] Script en `backend/migrations/008_evaluations.sql`
- **Dependencias:** T-F02-07
- **Estado:** ✅ Completada

---

### T-F02-09 — Crear tablas `sustentations` y `sustentation_evaluations`
- **Módulo(s):** MOD-12
- **Referencias:** `specs/arch/DATA-MODEL.md`
- **Descripción:** Tablas para registro de sustentación pública y sus calificaciones individuales.
- **Criterios de aceptación:**
  - [x] Tabla `sustentations`: `id UUID PK`, `project_id UUID FK(thesis_projects) UNIQUE`, `scheduled_at TIMESTAMPTZ NOT NULL` (fecha y hora programada), `location VARCHAR(200) NOT NULL`, `final_score DECIMAL(3,1)`, `is_approved BOOLEAN`, `registered_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `registered_by UUID FK(users)`
  - [x] Tabla `sustentation_evaluations`: `id UUID PK`, `sustentation_id UUID FK(sustentations)`, `juror_id UUID FK(users)`, `juror_number SMALLINT CHECK(juror_number IN (1,2))`, `score DECIMAL(3,1) CHECK(score >= 0 AND score <= 5.0)`, `submitted_at TIMESTAMPTZ`, `submitted_by UUID FK(users)`, `UNIQUE(sustentation_id, juror_number)`
  - [x] Script en `backend/migrations/009_sustentations.sql`
- **Dependencias:** T-F02-05
- **Estado:** ✅ Completada

---

### T-F02-10 — Crear tabla `acts`
- **Módulo(s):** MOD-13
- **Referencias:** `specs/arch/DATA-MODEL.md`
- **Descripción:** Tabla para registro del acta final de aprobación del trabajo de grado.
- **Criterios de aceptación:**
  - [x] Tabla `acts` (nombre exacto del DATA-MODEL): `id UUID PK`, `project_id UUID FK(thesis_projects) UNIQUE`, `issued_by UUID FK(users) NULLABLE` (null hasta emisión por Admin), `issued_at TIMESTAMPTZ NULLABLE` (null hasta emisión por Admin), `library_authorization BOOLEAN NULLABLE` (null hasta que el estudiante la diligencie), `act_file_url TEXT` (URL Supabase Storage del PDF del acta)
  - [x] Script en `backend/migrations/010_acts.sql`
- **Dependencias:** T-F02-05
- **Estado:** ✅ Completada

---

### T-F02-11 — Crear tablas `messages` y `project_status_history`
- **Módulo(s):** MOD-15, MOD-16
- **Referencias:** `specs/arch/DATA-MODEL.md`
- **Descripción:** Tablas para mensajería asíncrona e historial de cambios de estado.
- **Criterios de aceptación:**
  - [x] Tabla `messages` (nombre exacto del DATA-MODEL): `id UUID PK`, `project_id UUID FK(thesis_projects)`, `sender_id UUID FK(users)`, `recipient_id UUID FK(users) NULLABLE` (null = todos los actores), `content TEXT NOT NULL`, `sent_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `is_read BOOLEAN DEFAULT false`, `read_at TIMESTAMPTZ NULLABLE`, `sender_display VARCHAR(50) NOT NULL` (nombre real o "Jurado N")
  - [x] Tabla `project_status_history`: `id UUID PK`, `project_id UUID FK(thesis_projects)`, `previous_status VARCHAR`, `new_status VARCHAR NOT NULL`, `changed_by UUID FK(users) NOT NULL`, `changed_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `notes TEXT` (motivo del cambio)
  - [x] Scripts en `backend/migrations/011_messages_history.sql`
- **Dependencias:** T-F02-05
- **Estado:** ✅ Completada

---

### T-F02-12 — Crear índices y verificar integridad referencial
- **Módulo(s):** Todos
- **Referencias:** `specs/arch/DATA-MODEL.md`
- **Descripción:** Agregar índices para queries frecuentes y verificar que todas las foreign keys y constraints se aplicaron correctamente.
- **Criterios de aceptación:**
  - [x] Índices en `thesis_projects`: `status`, `modality_id`, `period`, `academic_program_id`
  - [x] Índices en `project_members`: `project_id`, `student_id`
  - [x] Índices en `project_jurors`: `project_id`, `docente_id`, `stage`
  - [x] Índices en `evaluations`: `project_id`, `stage`, `juror_id`
  - [x] Índices en `messages`: `project_id`, `recipient_id`, `is_read`
  - [x] Índices en `project_status_history`: `project_id`, `changed_at`
  - [x] Script de verificación de integridad ejecutado sin errores
  - [x] Script en `backend/migrations/012_indexes.sql`
- **Dependencias:** T-F02-11
- **Estado:** ✅ Completada
