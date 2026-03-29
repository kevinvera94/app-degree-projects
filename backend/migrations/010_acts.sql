-- 010_acts.sql
-- Actas de aprobación del trabajo de grado.

CREATE TABLE public.acts (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id            UUID NOT NULL UNIQUE REFERENCES public.thesis_projects(id) ON DELETE CASCADE,
    issued_by             UUID REFERENCES public.users(id),
    issued_at             TIMESTAMPTZ,
    library_authorization BOOLEAN,
    act_file_url          TEXT
);
