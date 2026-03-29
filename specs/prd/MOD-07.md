# MOD-07 — Correcciones de anteproyecto
> Parte del PRD. Ver índice en `specs/PRD.md`.

**Descripción:** Gestión del proceso de correcciones cuando el anteproyecto es devuelto por los jurados.
**Actores:** Estudiante, Docente (como Director).

| ID | Requerimiento | Actor |
|---|---|---|
| RF-07-01 | Cuando el estado es **Correcciones anteproyecto solicitadas**, el sistema habilita al estudiante para subir el documento corregido con Vo.Bo. del director | Estudiante |
| RF-07-02 | Al iniciar la etapa de correcciones, el sistema registra la fecha de inicio y calcula la fecha límite (10 días hábiles) | Sistema |
| RF-07-03 | El sistema muestra al estudiante los días hábiles restantes para entregar las correcciones | Sistema |
| RF-07-04 | Si el estudiante no entrega dentro del plazo de 10 días hábiles, el sistema bloquea la entrega y registra el incumplimiento. El estado permanece en **Correcciones anteproyecto solicitadas**. El estudiante podrá radicar el documento corregido cuando se abra la siguiente ventana de fechas para radicación de anteproyecto | Sistema |
| RF-07-05 | No existe un reinicio automático del proceso por incumplimiento. El Administrador puede archivar/cancelar un trabajo que considere abandonado, lo cual lo marca como **Cancelado** sin obligar al estudiante a inscribir una nueva idea | Administrador |
| RF-07-06 | Cuando el estudiante radica el documento corregido, el sistema transiciona automáticamente el estado a **Anteproyecto corregido entregado**, registra `start_date = submissions.submitted_at` y calcula la nueva fecha límite de **10 días hábiles adicionales** para los jurados. Solo pueden registrar Aprobado o Reprobado | Sistema |
| RF-07-07 | Al completarse la segunda revisión: si **Aprobado** → el sistema transiciona automáticamente a **En desarrollo** / si **Reprobado** → el sistema retorna a **Idea aprobada** para que el estudiante radique un nuevo anteproyecto | Sistema |
