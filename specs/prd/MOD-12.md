# MOD-12 — Sustentación pública
> Parte del PRD. Ver índice en `specs/PRD.md`.

**Descripción:** Programación y registro de la calificación de la sustentación pública.
**Actores:** Administrador, Docente (como Jurado).

> **Excepción:** la modalidad Diplomado en programas tecnológicos omite completamente este módulo. El sistema no genera la etapa de sustentación para estos trabajos (ver MOD-10).

| ID | Requerimiento | Actor |
|---|---|---|
| RF-12-01 | El Administrador puede registrar la sustentación pública para trabajos en estado **Aprobado para sustentación**, indicando fecha, hora y lugar | Administrador |
| RF-12-02 | Al registrar la sustentación, el sistema cambia el estado a **Sustentación programada** y notifica al estudiante, director y jurados | Sistema |
| RF-12-03 | Los jurados asignados al trabajo registran la calificación de la sustentación (≥ 4.0 Aprobado / < 4.0 Reprobado). El Administrador también puede registrarla | Docente (Jurado), Administrador |
| RF-12-04 | No existe Jurado 3 en la sustentación. Se registra una única calificación por trabajo | Sistema |
| RF-12-05 | Si la sustentación es aprobada, el sistema cambia el estado a **Trabajo aprobado** | Sistema |
| RF-12-06 | Si la sustentación es reprobada, el sistema cambia el estado a **Reprobado en sustentación**. El estudiante debe iniciar el proceso desde cero (nueva inscripción de idea) | Sistema |
