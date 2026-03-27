# MOD-16 — Historial y trazabilidad
> Parte del PRD. Ver índice en `specs/PRD.md`.

**Descripción:** Registro cronológico de todos los eventos y cambios sobre cada trabajo de grado.
**Actores:** Administrador, Docente, Estudiante.

| ID | Requerimiento | Actor |
|---|---|---|
| RF-16-01 | El sistema registra automáticamente cada cambio de estado con: fecha, hora, actor que lo ejecutó y motivo cuando aplique | Sistema |
| RF-16-02 | El sistema registra cada documento adjuntado con: nombre del archivo, etapa, fecha de carga y usuario que lo subió | Sistema |
| RF-16-03 | El sistema registra cada calificación emitida con: función del jurado (Jurado 1, 2 o 3), calificación numérica, observaciones, fecha de registro y si fue extemporánea | Sistema |
| RF-16-04 | El Administrador puede consultar el historial completo de cualquier trabajo de grado | Administrador |
| RF-16-05 | El estudiante puede consultar el historial de su propio trabajo de grado | Estudiante |
| RF-16-06 | El docente puede consultar el historial de los trabajos donde tiene una función asignada (Director o Jurado) | Docente |
