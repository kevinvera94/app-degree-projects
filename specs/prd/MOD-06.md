# MOD-06 — Evaluación de anteproyecto
> Parte del PRD. Ver índice en `specs/PRD.md`.

**Descripción:** Asignación de jurados y registro de calificaciones del anteproyecto.
**Actores:** Administrador, Docente (como Jurado).

| ID | Requerimiento | Actor |
|---|---|---|
| RF-06-01 | El Administrador puede asignar Jurado 1 y Jurado 2 a un anteproyecto en estado **Anteproyecto pendiente de evaluación**. El selector solo muestra docentes con `is_active = true` | Administrador |
| RF-06-02 | Al asignar jurados, el sistema registra la fecha de asignación e inicia el conteo del plazo de 15 días hábiles | Sistema |
| RF-06-03 | El sistema notifica a cada jurado asignado con acceso al documento del anteproyecto | Sistema |
| RF-06-04 | El estudiante ve a los jurados únicamente como "Jurado 1" y "Jurado 2", sin revelar su identidad | Sistema |
| RF-06-05 | Cada jurado puede registrar su calificación numérica (escala 0.0 a 5.0) y observaciones para el estudiante | Docente (Jurado) |
| RF-06-06 | Las calificaciones registradas después de vencido el plazo de 15 días hábiles quedan marcadas automáticamente como **extemporáneas** con la fecha real de entrega | Sistema |
| RF-06-07 | El sistema aplica la siguiente lógica al recibir ambas calificaciones: ambas ≥ 4.0 → **Anteproyecto aprobado** / ambas entre 3.0 y 3.9 → **Correcciones solicitadas** / ambas < 3.0 → **Anteproyecto reprobado** / una aprueba y la otra reprueba → notifica al Administrador para designar Jurado 3 | Sistema |
| RF-06-08 | El Administrador puede asignar un Jurado 3 cuando el sistema lo requiera. El Jurado 3 solo puede registrar Aprobado o Reprobado, sin opción de devolver para correcciones | Administrador |
| RF-06-09 | Si el Jurado 3 reprueba → **Anteproyecto reprobado**. Si aprueba → **Anteproyecto aprobado** | Sistema |
| RF-06-10 | Al aprobarse el anteproyecto, el sistema bloquea la adición de nuevos integrantes al trabajo | Sistema |
| RF-06-11 | El sistema notifica al estudiante el resultado con las observaciones de los jurados (sin revelar su identidad). Las observaciones se entregan por dos canales: (1) campo `observations` de la evaluación visible en el detalle del trabajo, y (2) mensaje automático en la bandeja del estudiante firmado como "Jurado 1" o "Jurado 2" | Sistema |
| RF-06-12 | Al aprobarse el anteproyecto, el sistema transiciona automáticamente el estado a **En desarrollo** | Sistema |
| RF-06-13 | Cuando el anteproyecto es reprobado (unánimemente o por Jurado 3), el sistema retorna el estado a **Idea aprobada**. El estudiante puede radicar un nuevo anteproyecto dentro de las ventanas de fechas habilitadas. La idea no se pierde; lo que se rehace es el anteproyecto desde cero | Sistema |
