-- 009_sustentations.sql
-- Sustentación pública y calificaciones individuales de jurados.

CREATE TABLE public.sustentations (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id    UUID NOT NULL UNIQUE REFERENCES public.thesis_projects(id) ON DELETE CASCADE,
    scheduled_at  TIMESTAMPTZ NOT NULL,
    location      VARCHAR(200) NOT NULL,
    final_score   DECIMAL(3, 1),
    is_approved   BOOLEAN,
    registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    registered_by UUID NOT NULL REFERENCES public.users(id)
);

CREATE TABLE public.sustentation_evaluations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sustentation_id UUID NOT NULL REFERENCES public.sustentations(id) ON DELETE CASCADE,
    juror_id        UUID NOT NULL REFERENCES public.users(id),
    juror_number    SMALLINT NOT NULL CHECK (juror_number IN (1, 2)),
    score           DECIMAL(3, 1) CHECK (score >= 0 AND score <= 5.0),
    submitted_at    TIMESTAMPTZ,
    submitted_by    UUID NOT NULL REFERENCES public.users(id),
    UNIQUE (sustentation_id, juror_number)
);
