# MOD-05 — Radicación de anteproyecto
> Parte del PRD. Ver índice en `specs/PRD.md`.

**Descripción:** Entrega formal del documento de anteproyecto por parte del estudiante con los adjuntos requeridos.
**Actores:** Estudiante.

| ID | Requerimiento | Actor |
|---|---|---|
| RF-05-01 | El sistema permite al estudiante radicar el anteproyecto solo cuando el trabajo está en estado **Idea aprobada** y hay una ventana de fechas activa para radicación de anteproyecto (o ventana extemporánea habilitada) | Estudiante |
| RF-05-02 | El sistema exige los siguientes adjuntos obligatorios para todas las modalidades: (a) documento de anteproyecto en la plantilla correspondiente, (b) carta de aval del director, (c) reporte de similitud | Estudiante |
| RF-05-03 | El sistema valida que el reporte de similitud esté adjunto pero no valida el porcentaje automáticamente. La carta de aval del director debe indicar explícitamente que verificó que el porcentaje de similitud es ≤ 20%. El Administrador puede rechazar la radicación si el aval no lo menciona | Sistema / Administrador |
| RF-05-04 | Para la modalidad **Investigación**, el sistema exige un cuarto adjunto obligatorio: aval del comité de ética | Estudiante |
| RF-05-05 | El sistema no permite confirmar la radicación si algún adjunto obligatorio está faltante | Sistema |
| RF-05-06 | Al confirmar la radicación, el sistema cambia el estado a **Anteproyecto pendiente de evaluación** y notifica al Administrador | Sistema |
