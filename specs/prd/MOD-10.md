# MOD-10 — Evaluación de producto final
> Parte del PRD. Ver índice en `specs/PRD.md`.

**Descripción:** Asignación de jurados y registro de calificaciones del producto final.
**Actores:** Administrador, Docente (como Jurado).

| ID | Requerimiento | Actor |
|---|---|---|
| RF-10-01 | El Administrador asigna los jurados al producto final. El sistema sugiere los mismos jurados del anteproyecto cuando estén disponibles | Administrador |
| RF-10-02 | El Administrador asigna manualmente el número de jurado (**1 o 2**) en el formulario inicial de asignación para producto final. Si asigna un docente diferente al del anteproyecto, el campo `replaced_docente_id` en `project_jurors` queda registrado para trazabilidad. El **Jurado 3** (si aplica) se asigna en un flujo separado, igual que en MOD-06 RF-06-08 | Administrador |
| RF-10-03 | La lógica de plazos (15 días hábiles primera revisión / 10 días segunda revisión), calificaciones, marcado de extemporáneas, Jurado 3 adicional y notificaciones es idéntica a la del MOD-06 | Sistema |
| RF-10-04 | Al **aprobarse** el producto final: estado → **Aprobado para sustentación**. Para Diplomado tecnológico, estado → **Trabajo aprobado** directamente (sin sustentación) — el Administrador puede emitir el acta desde ahí (MOD-13) | Sistema |
| RF-10-05 | Al **reprobarse** el producto final unánimemente (ambos jurados < 3.0 o Jurado 3 reprueba en primera revisión): estado → **Producto final reprobado** → el sistema retorna automáticamente a **En desarrollo**. El estudiante puede radicar un nuevo producto final en la siguiente ventana de fechas. Aplica a todas las modalidades incluyendo Diplomado tecnológico | Sistema |
