-- 003_programs_modalities.sql
-- Catálogos configurables: programas académicos y modalidades de trabajo de grado.

CREATE TABLE public.academic_programs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(150) NOT NULL,
    level       academic_level NOT NULL,
    faculty     VARCHAR(100) NOT NULL DEFAULT 'Ingeniería',
    is_active   BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE public.modalities (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                        VARCHAR(100) NOT NULL,
    levels                      academic_level[] NOT NULL,
    max_members                 INTEGER NOT NULL,
    requires_sustentation       BOOLEAN NOT NULL DEFAULT true,
    requires_ethics_approval    BOOLEAN NOT NULL DEFAULT false,
    requires_business_plan_cert BOOLEAN NOT NULL DEFAULT false,
    is_active                   BOOLEAN NOT NULL DEFAULT true,
    created_by                  UUID REFERENCES public.users(id),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.modality_level_limits (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    modality_id  UUID NOT NULL REFERENCES public.modalities(id) ON DELETE CASCADE,
    level        academic_level NOT NULL,
    max_members  INTEGER NOT NULL,
    updated_by   UUID REFERENCES public.users(id),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (modality_id, level)
);

-- FK diferida: student_profiles → academic_programs (la tabla se creó antes en 002)
ALTER TABLE public.student_profiles
    ADD CONSTRAINT fk_student_profiles_academic_program
    FOREIGN KEY (academic_program_id) REFERENCES public.academic_programs(id);
