# MOD-04 — Evaluación de idea
> Parte del PRD. Ver índice en `specs/PRD.md`.

**Descripción:** Revisión y decisión del CTG (a través del Administrador) sobre la idea inscrita.
**Actores:** Administrador.

| ID | Requerimiento | Actor |
|---|---|---|
| RF-04-01 | El Administrador puede ver el listado de ideas en estado **Pendiente de evaluación de idea** con sus datos completos | Administrador |
| RF-04-02 | El Administrador puede aprobar una idea, lo que requiere seleccionar al menos un docente como director del trabajo | Administrador |
| RF-04-03 | Al aprobar una idea, el sistema cambia el estado a **Idea aprobada** y notifica al estudiante y al docente asignado como director | Sistema |
| RF-04-04 | El Administrador puede rechazar una idea registrando obligatoriamente el motivo del rechazo | Administrador |
| RF-04-05 | Al rechazar una idea, el sistema cambia el estado a **Idea rechazada** y notifica al estudiante con el motivo | Sistema |
| RF-04-06 | El Administrador puede asignar hasta 2 directores a un trabajo de grado. El selector solo muestra docentes con `is_active = true`. El segundo director puede ser de institución externa (registrado en el sistema como docente activo) | Administrador |
| RF-04-07 | Un docente que deja de estar en ejercicio debe tener su registro marcado como inactivo (`is_active = false`) por el Administrador, lo que lo excluye automáticamente de cualquier nueva asignación como director o jurado | Administrador |
