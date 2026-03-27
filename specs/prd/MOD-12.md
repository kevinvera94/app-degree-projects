# MOD-12 — Sustentación pública
> Parte del PRD. Ver índice en `specs/PRD.md`.

**Descripción:** Programación y registro de la calificación de la sustentación pública.
**Actores:** Administrador.

> **Excepción:** la modalidad Diplomado en programas tecnológicos omite completamente este módulo. El sistema no genera la etapa de sustentación para estos trabajos (ver MOD-10).

| ID | Requerimiento | Actor |
|---|---|---|
| RF-12-01 | El Administrador puede registrar la sustentación pública para trabajos en estado **Aprobado para sustentación**, indicando fecha, hora y lugar | Administrador |
| RF-12-02 | Al registrar la sustentación, el sistema cambia el estado a **Sustentación programada** y notifica al estudiante, director y jurados | Sistema |
| RF-12-03 | El Administrador registra la calificación de la sustentación: Aprobado (≥ 4.0) o Reprobado (< 4.0) | Administrador |
| RF-12-04 | Si la sustentación es aprobada, el sistema cambia el estado a **Trabajo aprobado** | Sistema |
| RF-12-05 | Si la sustentación es reprobada, el sistema cambia el estado a **Reprobado en sustentación**. El estudiante debe iniciar el proceso desde cero (nueva inscripción de idea) | Sistema |
| RF-12-06 | No existe Jurado 3 en la sustentación. La calificación es única y la registra el Administrador | Administrador |
