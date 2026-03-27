# MOD-02 — Gestión de ventanas de fechas
> Parte del PRD. Ver índice en `specs/PRD.md`.

**Descripción:** Control del calendario académico que habilita o bloquea las acciones de radicación en el sistema.
**Actores:** Administrador.

| ID | Requerimiento | Actor |
|---|---|---|
| RF-02-01 | El Administrador puede crear ventanas de fechas con: tipo (inscripción de idea / radicación de anteproyecto / radicación de producto final), fecha de inicio, fecha de cierre y periodo académico | Administrador |
| RF-02-02 | El Administrador puede editar o eliminar una ventana de fechas que aún no ha iniciado | Administrador |
| RF-02-03 | El sistema bloquea automáticamente la acción de radicación correspondiente cuando no hay una ventana de fechas activa para ese tipo | Sistema |
| RF-02-04 | El Administrador puede habilitar una ventana extemporánea individual para un trabajo de grado específico, indicando el tipo de acción habilitada y el periodo de vigencia | Administrador |
| RF-02-05 | El sistema muestra al estudiante si hay una ventana de fechas activa para la acción que desea realizar | Estudiante |
| RF-02-06 | El Administrador puede consultar el historial de ventanas de fechas por periodo académico | Administrador |
