# MOD-08 — Control de integrantes
> Parte del PRD. Ver índice en `specs/PRD.md`.

**Descripción:** Gestión de los integrantes del trabajo de grado durante su ciclo de vida.
**Actores:** Administrador, Estudiante.

| ID | Requerimiento | Actor |
|---|---|---|
| RF-08-01 | El sistema impide agregar nuevos integrantes a un trabajo de grado una vez que el anteproyecto ha sido aprobado | Sistema |
| RF-08-02 | El Administrador puede registrar el retiro de un integrante en cualquier etapa posterior a la aprobación del anteproyecto. Son obligatorios **ambos**: (1) campo de texto con la justificación del retiro y (2) documento adjunto con el aval del director de trabajo de grado. Sin ambos el sistema no permite confirmar el retiro | Administrador |
| RF-08-03 | El sistema registra en el historial del trabajo cualquier cambio en los integrantes con fecha y motivo | Sistema |
