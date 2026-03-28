# MOD-03 — Inscripción de idea
> Parte del PRD. Ver índice en `specs/PRD.md`.

**Descripción:** Registro inicial de la propuesta de trabajo de grado por parte del estudiante.
**Actores:** Estudiante.

| ID | Requerimiento | Actor |
|---|---|---|
| RF-03-01 | El sistema permite al estudiante inscribir una nueva idea solo cuando hay una ventana de fechas activa para inscripción (o una ventana extemporánea habilitada para el trabajo) | Estudiante |
| RF-03-02 | Todos los integrantes del trabajo deben estar pre-registrados como usuarios con rol **Estudiante** en el sistema antes de inscribir la idea. El formulario de inscripción asocia usuarios existentes; no crea nuevas cuentas | Sistema |
| RF-03-03 | El formulario de inscripción debe incluir los siguientes campos obligatorios: nombre del trabajo (máx. 100 caracteres), modalidad, integrantes (seleccionados del sistema), línea de profundización, grupo de investigación | Estudiante |
| RF-03-04 | El campo "director sugerido" es opcional e informativo (texto libre). No se vincula automáticamente a un usuario del sistema; el Administrador lo usa como referencia al asignar el director formal | Estudiante |
| RF-03-05 | El sistema valida que el número de integrantes no supere el límite configurado para la modalidad y nivel académico seleccionados | Sistema |
| RF-03-06 | El sistema valida que el estudiante declare cumplir los requisitos previos: 70% de créditos aprobados (pregrado) o 50% del plan (posgrado) | Sistema |
| RF-03-07 | Al confirmar la inscripción, el sistema registra el trabajo con estado **Pendiente de evaluación de idea** y notifica al estudiante | Sistema |
| RF-03-08 | El estudiante puede consultar el estado actual de su inscripción en cualquier momento | Estudiante |
