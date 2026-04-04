-- 013_fix_project_jurors_partial_unique.sql
-- Corrección: reemplazar el UNIQUE constraint total de project_jurors por un
-- índice parcial que solo aplica a registros activos (is_active = true).
--
-- Problema original: el constraint UNIQUE (project_id, juror_number, stage) era
-- incondicional, lo que impedía reasignar un slot de jurado después de removerlo
-- (is_active = false), aunque el registro anterior ya estuviera inactivo.
-- Al intentar insertar un nuevo J1 o J2 en la misma etapa, la BD lanzaba una
-- violación de unicidad que el backend devolvía como "Ocurrió un error inesperado."
--
-- Solución: índice parcial WHERE is_active = true. Garantiza que no puede haber
-- dos jurados activos con el mismo número y etapa en el mismo proyecto, pero
-- permite conservar el historial de asignaciones inactivas para trazabilidad.

ALTER TABLE public.project_jurors
    DROP CONSTRAINT IF EXISTS project_jurors_project_id_juror_number_stage_key;

CREATE UNIQUE INDEX IF NOT EXISTS project_jurors_active_unique
    ON public.project_jurors (project_id, juror_number, stage)
    WHERE is_active = true;
