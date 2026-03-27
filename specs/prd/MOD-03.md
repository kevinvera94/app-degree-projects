# MOD-03 — Inscripción de idea
> Parte del PRD. Ver índice en `specs/PRD.md`.

**Descripción:** Registro inicial de la propuesta de trabajo de grado por parte del estudiante.
**Actores:** Estudiante.

| ID | Requerimiento | Actor |
|---|---|---|
| RF-03-01 | El sistema permite al estudiante inscribir una nueva idea solo cuando hay una ventana de fechas activa para inscripción (o una ventana extemporánea habilitada para el trabajo) | Estudiante |
| RF-03-02 | El formulario de inscripción debe incluir los siguientes campos obligatorios: nombre del trabajo (máx. 100 caracteres), modalidad, número de integrantes, datos de cada integrante (nombre, cédula, email institucional, celular, dirección, semestre, programa académico), línea de profundización, grupo de investigación | Estudiante |
| RF-03-03 | El campo "director sugerido" es opcional en el formulario de inscripción | Estudiante |
| RF-03-04 | El sistema valida que el número de integrantes no supere el límite configurado para la modalidad y nivel académico seleccionados | Sistema |
| RF-03-05 | El sistema valida que el estudiante declare cumplir los requisitos previos: 70% de créditos aprobados (pregrado) o 50% del plan (posgrado) | Sistema |
| RF-03-06 | Al confirmar la inscripción, el sistema registra el trabajo con estado **Pendiente de evaluación de idea** y notifica al estudiante | Sistema |
| RF-03-07 | El estudiante puede consultar el estado actual de su inscripción en cualquier momento | Estudiante |
