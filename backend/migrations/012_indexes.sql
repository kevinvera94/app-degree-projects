-- 012_indexes.sql
-- Índices para queries frecuentes del sistema.

-- thesis_projects
CREATE INDEX idx_thesis_projects_status           ON public.thesis_projects(status);
CREATE INDEX idx_thesis_projects_modality_id      ON public.thesis_projects(modality_id);
CREATE INDEX idx_thesis_projects_period           ON public.thesis_projects(period);
CREATE INDEX idx_thesis_projects_academic_program ON public.thesis_projects(academic_program_id);

-- project_members
CREATE INDEX idx_project_members_project_id ON public.project_members(project_id);
CREATE INDEX idx_project_members_student_id ON public.project_members(student_id);

-- project_jurors
CREATE INDEX idx_project_jurors_project_id  ON public.project_jurors(project_id);
CREATE INDEX idx_project_jurors_docente_id  ON public.project_jurors(docente_id);
CREATE INDEX idx_project_jurors_stage       ON public.project_jurors(stage);

-- evaluations
CREATE INDEX idx_evaluations_project_id ON public.evaluations(project_id);
CREATE INDEX idx_evaluations_stage      ON public.evaluations(stage);
CREATE INDEX idx_evaluations_juror_id   ON public.evaluations(juror_id);

-- messages
CREATE INDEX idx_messages_project_id   ON public.messages(project_id);
CREATE INDEX idx_messages_recipient_id ON public.messages(recipient_id);
CREATE INDEX idx_messages_is_read      ON public.messages(is_read);

-- project_status_history
CREATE INDEX idx_status_history_project_id  ON public.project_status_history(project_id);
CREATE INDEX idx_status_history_changed_at  ON public.project_status_history(changed_at);
