-- 006_project_relations.sql
-- Tablas de asignación de actores a proyectos.

CREATE TABLE public.project_members (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id            UUID NOT NULL REFERENCES public.thesis_projects(id) ON DELETE CASCADE,
    student_id            UUID NOT NULL REFERENCES public.users(id),
    is_active             BOOLEAN NOT NULL DEFAULT true,
    joined_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    removed_at            TIMESTAMPTZ,
    removal_reason        TEXT,
    removal_attachment_url TEXT
);

CREATE TABLE public.project_directors (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID NOT NULL REFERENCES public.thesis_projects(id) ON DELETE CASCADE,
    docente_id  UUID NOT NULL REFERENCES public.users(id),
    "order"     INTEGER NOT NULL CHECK ("order" IN (1, 2)),
    assigned_by UUID REFERENCES public.users(id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_active   BOOLEAN NOT NULL DEFAULT true
);

-- Máximo 2 directores activos por proyecto
CREATE OR REPLACE FUNCTION public.check_max_active_directors()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_active = true THEN
        IF (
            SELECT COUNT(*) FROM public.project_directors
            WHERE project_id = NEW.project_id
              AND is_active = true
              AND id <> NEW.id
        ) >= 2 THEN
            RAISE EXCEPTION 'Un trabajo no puede tener más de 2 directores activos.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_max_active_directors
    BEFORE INSERT OR UPDATE ON public.project_directors
    FOR EACH ROW EXECUTE FUNCTION public.check_max_active_directors();

CREATE TABLE public.project_jurors (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id          UUID NOT NULL REFERENCES public.thesis_projects(id) ON DELETE CASCADE,
    docente_id          UUID NOT NULL REFERENCES public.users(id),
    juror_number        SMALLINT NOT NULL CHECK (juror_number IN (1, 2, 3)),
    stage               juror_stage NOT NULL,
    assigned_by         UUID REFERENCES public.users(id),
    assigned_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_active           BOOLEAN NOT NULL DEFAULT true,
    replaced_docente_id UUID REFERENCES public.users(id),
    UNIQUE (project_id, juror_number, stage)
);
