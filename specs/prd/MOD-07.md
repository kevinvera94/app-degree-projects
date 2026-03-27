# MOD-07 — Correcciones de anteproyecto
> Parte del PRD. Ver índice en `specs/PRD.md`.

**Descripción:** Gestión del proceso de correcciones cuando el anteproyecto es devuelto por los jurados.
**Actores:** Estudiante, Docente (como Director).

| ID | Requerimiento | Actor |
|---|---|---|
| RF-07-01 | Cuando el estado es **Correcciones anteproyecto solicitadas**, el sistema habilita al estudiante para subir el documento corregido con Vo.Bo. del director | Estudiante |
| RF-07-02 | Al iniciar la etapa de correcciones, el sistema registra la fecha de inicio y calcula la fecha límite (10 días hábiles) | Sistema |
| RF-07-03 | El sistema muestra al estudiante los días hábiles restantes para entregar las correcciones | Sistema |
| RF-07-04 | Si el estudiante no entrega dentro del plazo de 10 días hábiles, el sistema bloquea la entrega y registra el incumplimiento. El estudiante debe radicar en la siguiente ventana de fechas | Sistema |
| RF-07-05 | Si el estudiante tampoco entrega en la siguiente oportunidad, el Administrador puede marcar el trabajo como **Proceso reiniciado**, lo que obliga al estudiante a comenzar desde cero (nueva inscripción de idea) | Administrador |
| RF-07-06 | En la segunda revisión, los jurados reciben el documento corregido y tienen 10 días hábiles. Solo pueden registrar Aprobado o Reprobado | Docente (Jurado) |
| RF-07-07 | El sistema aplica la lógica de resultado de la segunda revisión igual que en la primera, excepto que no hay opción de devolver para correcciones nuevamente | Sistema |
