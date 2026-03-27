# MOD-15 — Mensajería asíncrona
> Parte del PRD. Ver índice en `specs/PRD.md`.

**Descripción:** Sistema de comunicación interna entre los actores del proceso, tipo bandeja de entrada. No es chat en tiempo real.
**Actores:** Todos.

| ID | Requerimiento | Actor |
|---|---|---|
| RF-15-01 | Cada usuario tiene una bandeja de entrada con los mensajes recibidos asociados a sus trabajos de grado | Todos |
| RF-15-02 | El estudiante puede enviar mensajes al docente asignado como Director de su trabajo | Estudiante |
| RF-15-03 | El docente (como Director) puede enviar mensajes al estudiante de su trabajo | Docente |
| RF-15-04 | El docente (como Director) puede enviar solicitudes formales al Administrador: radicación extemporánea, modificación o cancelación del trabajo | Docente |
| RF-15-05 | El estudiante puede enviar mensajes a los jurados de su trabajo. El sistema los identifica como "Jurado 1" o "Jurado 2" sin revelar su identidad | Estudiante |
| RF-15-06 | El jurado puede enviar mensajes al estudiante de un trabajo asignado. El sistema muestra al estudiante solo "Jurado 1" o "Jurado 2", sin revelar el nombre real | Docente (Jurado) |
| RF-15-07 | El Administrador puede enviar mensajes a cualquier usuario del sistema | Administrador |
| RF-15-08 | Todos los mensajes quedan asociados al historial del trabajo de grado correspondiente | Sistema |
| RF-15-09 | El sistema genera una notificación interna al usuario cuando recibe un nuevo mensaje | Sistema |
