# MOD-10 — Evaluación de producto final
> Parte del PRD. Ver índice en `specs/PRD.md`.

**Descripción:** Asignación de jurados y registro de calificaciones del producto final.
**Actores:** Administrador, Docente (como Jurado).

| ID | Requerimiento | Actor |
|---|---|---|
| RF-10-01 | El Administrador asigna los jurados al producto final. El sistema sugiere los mismos jurados del anteproyecto cuando estén disponibles | Administrador |
| RF-10-02 | Si se asigna un docente diferente al que evaluó el anteproyecto, el sistema renumera los jurados (Jurado 1, Jurado 2) en el producto final. El campo `replaced_docente_id` en `project_jurors` queda registrado para trazabilidad | Sistema |
| RF-10-03 | La lógica de plazos (15 días hábiles primera revisión / 10 días segunda revisión), calificaciones, marcado de extemporáneas, Jurado 3 y notificaciones es idéntica a la del MOD-06 | Sistema |
| RF-10-03 | Al aprobarse el producto final, el sistema cambia el estado a **Aprobado para sustentación**. Para la modalidad Diplomado en programas tecnológicos, el sistema omite la etapa de sustentación y cambia directamente a **Trabajo aprobado** | Sistema |
