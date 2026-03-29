-- 005_thesis_projects.sql
-- Entidad central del sistema: trabajos de grado.

CREATE TABLE public.thesis_projects (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title                   VARCHAR(100) NOT NULL,
    modality_id             UUID NOT NULL REFERENCES public.modalities(id),
    academic_program_id     UUID NOT NULL REFERENCES public.academic_programs(id),
    period                  VARCHAR(10) NOT NULL,
    research_line           VARCHAR(200) NOT NULL,
    research_group          research_group NOT NULL,
    suggested_director      VARCHAR(150),
    has_company_link        BOOLEAN NOT NULL DEFAULT false,
    status                  project_status NOT NULL DEFAULT 'pendiente_evaluacion_idea',
    plagiarism_suspended    BOOLEAN NOT NULL DEFAULT false,
    plagiarism_suspended_at TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_thesis_projects_updated_at
    BEFORE UPDATE ON public.thesis_projects
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- FK diferida: extemporaneous_windows → thesis_projects
ALTER TABLE public.extemporaneous_windows
    ADD CONSTRAINT fk_extemp_windows_project
    FOREIGN KEY (project_id) REFERENCES public.thesis_projects(id) ON DELETE CASCADE;
