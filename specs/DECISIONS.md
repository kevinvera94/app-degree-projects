# DECISIONS.md — Log de decisiones de diseño
> Registro de decisiones técnicas y de producto tomadas durante el proyecto.
> Formato: ADR (Architecture Decision Record) simplificado.

---

## Plantilla

### DEC-000 — Título de la decisión
- **Fecha:**
- **Estado:** Propuesta | Aceptada | Rechazada | Reemplazada
- **Contexto:** Por qué se necesitaba tomar esta decisión
- **Decisión:** Qué se decidió
- **Consecuencias:** Qué implica esta decisión (pros/contras)

---

## Decisiones

### DEC-001 — Estructura de specs con BRIEF.md central
- **Fecha:** 2026-03-27
- **Estado:** Aceptada
- **Contexto:** Se necesitaba una fuente de verdad agnóstica a la herramienta para soportar múltiples agentes CLI
- **Decisión:** Usar specs/BRIEF.md como fuente central; CLAUDE.md y otros archivos de agente referencian al BRIEF
- **Consecuencias:** Mantenimiento único, portabilidad entre herramientas, overhead mínimo de configuración
