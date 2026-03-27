# CLAUDE.md
> Configuración específica para Claude Code.
> **Lee specs/BRIEF.md primero antes de cualquier tarea.**

---

## Contexto del proyecto
Ver: `specs/BRIEF.md`

## Requerimientos del producto
Ver: `specs/PRD.md`

## Arquitectura técnica
Ver: `specs/ARCHITECTURE.md`

## Tarea actual
Ver: `specs/TASKS.md`

## Decisiones previas
Ver: `specs/DECISIONS.md`

---

## Instrucciones para Claude Code

### Antes de cada tarea
1. Leer `specs/BRIEF.md` para contexto general
2. Leer `specs/TASKS.md` para identificar la tarea asignada
3. Leer la sección relevante de `specs/ARCHITECTURE.md`
4. Confirmar con el usuario antes de proceder si hay ambigüedad

### Durante la tarea
- Una tarea por sesión — no avanzar a la siguiente sin confirmación
- No instalar dependencias nuevas sin justificación explícita
- No modificar archivos fuera del scope de la tarea
- Si encuentras un problema no previsto, reportarlo antes de improvisar

### Al terminar la tarea
- Hacer commit con mensaje descriptivo en español
- Mover la tarea a "Completadas" en `specs/TASKS.md` con la fecha
- Reportar al usuario qué se hizo y qué sigue

### Restricciones generales
<!-- Se llenará junto con el BRIEF.md -->
