-- 001_enums.sql
-- Tipos ENUM de PostgreSQL para el sistema USC app-degree-projects.
-- Debe ejecutarse antes de cualquier CREATE TABLE que los referencie.

-- Estados del trabajo de grado
CREATE TYPE project_status AS ENUM (
    'pendiente_evaluacion_idea',
    'idea_aprobada',
    'idea_rechazada',
    'anteproyecto_pendiente_evaluacion',
    'anteproyecto_aprobado',
    'anteproyecto_reprobado',
    'correcciones_anteproyecto_solicitadas',
    'anteproyecto_corregido_entregado',
    'en_desarrollo',
    'producto_final_entregado',
    'en_revision_jurados_producto_final',
    'correcciones_producto_final_solicitadas',
    'producto_final_corregido_entregado',
    'producto_final_reprobado',
    'aprobado_para_sustentacion',
    'sustentacion_programada',
    'trabajo_aprobado',
    'reprobado_en_sustentacion',
    'acta_generada',
    'suspendido_por_plagio',
    'cancelado'
);

-- Roles de usuario
CREATE TYPE user_role AS ENUM (
    'administrador',
    'docente',
    'estudiante'
);

-- Niveles académicos
CREATE TYPE academic_level AS ENUM (
    'tecnologico',
    'profesional',
    'especializacion',
    'maestria_profundizacion',
    'maestria_investigacion',
    'doctorado'
);

-- Tipos de ventana de fechas
CREATE TYPE window_type AS ENUM (
    'inscripcion_idea',
    'radicacion_anteproyecto',
    'radicacion_producto_final'
);

-- Tipos de adjunto
CREATE TYPE attachment_type AS ENUM (
    'plantilla',
    'carta_aval',
    'reporte_similitud',
    'aval_etica',
    'certificacion_plan_negocio',
    'carta_impacto',
    'autorizacion_biblioteca',
    'retiro_integrante',
    'otro'
);

-- Etapas de evaluación (anteproyecto y producto final)
CREATE TYPE evaluation_stage AS ENUM (
    'anteproyecto',
    'producto_final'
);

-- Etapas de asignación de jurado (incluye sustentación)
CREATE TYPE juror_stage AS ENUM (
    'anteproyecto',
    'producto_final',
    'sustentacion'
);

-- Grupos de investigación
CREATE TYPE research_group AS ENUM (
    'GIEIAM',
    'COMBA_ID'
);
