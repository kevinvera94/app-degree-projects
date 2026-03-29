-- 008_evaluations.sql
-- Calificaciones de jurados para anteproyecto y producto final.

CREATE TABLE public.evaluations (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id       UUID NOT NULL REFERENCES public.thesis_projects(id) ON DELETE CASCADE,
    submission_id    UUID NOT NULL REFERENCES public.submissions(id),
    juror_id         UUID NOT NULL REFERENCES public.users(id),
    juror_number     SMALLINT NOT NULL CHECK (juror_number IN (1, 2, 3)),
    stage            evaluation_stage NOT NULL,
    score            DECIMAL(3, 1) CHECK (score >= 0 AND score <= 5.0),
    observations     TEXT,
    submitted_at     TIMESTAMPTZ,
    start_date       TIMESTAMPTZ NOT NULL,
    due_date         TIMESTAMPTZ NOT NULL,
    is_extemporaneous BOOLEAN NOT NULL DEFAULT false,
    revision_number  INTEGER NOT NULL CHECK (revision_number IN (1, 2))
);
