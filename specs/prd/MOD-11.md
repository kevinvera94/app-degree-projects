# MOD-11 — Correcciones de producto final
> Parte del PRD. Ver índice en `specs/PRD.md`.

**Descripción:** Gestión del proceso de correcciones cuando el producto final es devuelto por los jurados.
**Actores:** Estudiante, Docente (como Director).

| ID | Requerimiento | Actor |
|---|---|---|
| RF-11-01 | Las reglas de plazos (10 días hábiles para el estudiante), bloqueos por incumplimiento y comportamiento de no-reinicio son idénticas a las del MOD-07. El estado permanece en **Correcciones producto final solicitadas** hasta que se abra una nueva ventana de fechas | Sistema |
| RF-11-02 | Cuando el estudiante radica el documento corregido, el sistema transiciona a **Producto final corregido entregado**, registra `start_date = submissions.submitted_at` y calcula la nueva fecha límite de **10 días hábiles adicionales** para los jurados. Solo pueden registrar Aprobado o Reprobado | Sistema |
| RF-11-03 | En segunda revisión de producto final, si hay divergencia (un jurado aprueba y otro reprueba), se asigna un **Jurado 3 adicional** igual que en primera revisión (MOD-10 RF-10-03 / MOD-06 RF-06-08). El Jurado 3 solo puede aprobar o reprobar | Sistema / Administrador |
| RF-11-04 | Al **reprobarse** el producto final en segunda revisión (unánimemente o por Jurado 3): estado → **Producto final reprobado** → el sistema retorna automáticamente a **En desarrollo**. El estudiante puede radicar un nuevo producto final en la siguiente ventana de fechas | Sistema |
