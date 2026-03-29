-- 004_date_windows.sql
-- Ventanas de fechas habilitadas por el Administrador.
-- extemporaneous_windows requiere thesis_projects (005), se agrega después con ALTER TABLE.

CREATE TABLE public.date_windows (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period      VARCHAR(10) NOT NULL,
    window_type window_type NOT NULL,
    start_date  DATE NOT NULL,
    end_date    DATE NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_by  UUID REFERENCES public.users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_date_windows_range CHECK (start_date < end_date)
);

CREATE TABLE public.extemporaneous_windows (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID NOT NULL,  -- FK a thesis_projects se agrega en 005
    stage       window_type NOT NULL,
    granted_by  UUID REFERENCES public.users(id),
    granted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    valid_until DATE NOT NULL,
    notes       TEXT,
    CONSTRAINT chk_extemp_valid_until CHECK (valid_until > granted_at::date)
);
