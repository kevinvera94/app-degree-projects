# MOD-12 — Sustentación pública
> Parte del PRD. Ver índice en `specs/PRD.md`.

**Descripción:** Programación y registro de la calificación de la sustentación pública.
**Actores:** Administrador, Docente (como Jurado).

> **Excepción:** la modalidad Diplomado en programas tecnológicos omite completamente este módulo. El sistema no genera la etapa de sustentación para estos trabajos (ver MOD-10).

| ID | Requerimiento | Actor |
|---|---|---|
| RF-12-01 | El Administrador puede registrar la sustentación pública para trabajos en estado **Aprobado para sustentación**, indicando fecha, hora y lugar | Administrador |
| RF-12-02 | Al registrar la sustentación, el sistema cambia el estado a **Sustentación programada** y notifica al estudiante, director y jurados | Sistema |
| RF-12-03 | Cada jurado registra su calificación individual (escala 0.0 a 5.0) para la sustentación. El Administrador también puede registrar la calificación de un jurado | Docente (Jurado), Administrador |
| RF-12-04 | Una vez ambos jurados han registrado su calificación, el sistema calcula el promedio y determina el resultado: promedio ≥ 4.0 → **Trabajo aprobado** / promedio < 4.0 → **Reprobado en sustentación** | Sistema |
| RF-12-05-NOTE | No existe Jurado 3 en la sustentación. La decisión final es exclusivamente el promedio de los dos jurados | Sistema |
| RF-12-06 | Si la sustentación es reprobada, el sistema cambia el estado a **Reprobado en sustentación**. El estudiante debe iniciar el proceso desde cero (nueva inscripción de idea) | Sistema |
