-- 007_submissions_attachments.sql
-- Radicaciones y documentos adjuntos.

CREATE TABLE public.submissions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id       UUID NOT NULL REFERENCES public.thesis_projects(id) ON DELETE CASCADE,
    stage            VARCHAR NOT NULL CHECK (stage IN (
                         'anteproyecto',
                         'correcciones_anteproyecto',
                         'producto_final',
                         'correcciones_producto_final'
                     )),
    submitted_by     UUID NOT NULL REFERENCES public.users(id),
    submitted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    date_window_id   UUID REFERENCES public.date_windows(id),
    is_extemporaneous BOOLEAN NOT NULL DEFAULT false,
    revision_number  INTEGER NOT NULL CHECK (revision_number IN (1, 2)),
    status           VARCHAR NOT NULL DEFAULT 'pendiente' CHECK (status IN (
                         'pendiente',
                         'en_revision',
                         'aprobado',
                         'reprobado',
                         'con_correcciones'
                     ))
);

CREATE TABLE public.attachments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id   UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
    attachment_type attachment_type NOT NULL,
    file_name       VARCHAR(255) NOT NULL,
    file_url        TEXT NOT NULL,
    uploaded_by     UUID NOT NULL REFERENCES public.users(id),
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
