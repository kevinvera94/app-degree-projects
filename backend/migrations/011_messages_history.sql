-- 011_messages_history.sql
-- Mensajería asíncrona e historial de cambios de estado del trabajo.

CREATE TABLE public.messages (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id     UUID NOT NULL REFERENCES public.thesis_projects(id) ON DELETE CASCADE,
    sender_id      UUID NOT NULL REFERENCES public.users(id),
    recipient_id   UUID REFERENCES public.users(id),
    content        TEXT NOT NULL,
    sent_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_read        BOOLEAN NOT NULL DEFAULT false,
    read_at        TIMESTAMPTZ,
    sender_display VARCHAR(50) NOT NULL
);

CREATE TABLE public.project_status_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES public.thesis_projects(id) ON DELETE CASCADE,
    previous_status VARCHAR,
    new_status      VARCHAR NOT NULL,
    changed_by      UUID NOT NULL REFERENCES public.users(id),
    changed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes           TEXT
);
