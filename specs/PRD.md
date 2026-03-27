# PRD.md — Product Requirements Document (Índice)
> Fuente de verdad del producto. Se construye sobre `specs/BRIEF.md` y la Resolución No. 004 de 2025.
> Los requerimientos funcionales detallados están en `specs/prd/MOD-XX.md`.
> Última actualización: 2026-03-27

---

## Visión del producto

Centralizar y digitalizar el ciclo de vida completo de los trabajos de grado de la Facultad de Ingeniería USC — desde la inscripción de la idea hasta la generación del acta de aprobación — eliminando el seguimiento manual por correo y formularios, y garantizando trazabilidad total del proceso para todos los actores.

---

## Usuarios del sistema y permisos

El sistema maneja 3 roles. Al registrar un usuario se le asigna el rol correspondiente.

| Rol | Quién lo ejerce | Permisos principales |
|---|---|---|
| **Administrador** | Secretaria de facultad, Director de programa, o cualquier persona designada por el CTG | Gestionar usuarios y roles, configurar parámetros del sistema, aprobar/rechazar ideas y anteproyectos, asignar director y jurados, gestionar ventanas de fechas, emitir actas, habilitar ventanas extemporáneas |
| **Docente** | Profesor registrado en el sistema | Su función en cada trabajo (Director o Jurado) la asigna el Administrador por proyecto. Un mismo docente puede ser Director en un trabajo y Jurado en otro simultáneamente |
| **Estudiante** | Estudiante inscrito | Inscribir idea, radicar documentos, consultar estado de su trabajo, mensajería |

> **Sobre el rol Docente:** la función específica se determina por proyecto:
> - **Como Director:** accede a los trabajos donde fue asignado, emite Vo.Bo. y tiene mensajería con el estudiante.
> - **Como Jurado 1, 2 o 3:** accede a los documentos del trabajo asignado, registra calificación y envía observaciones. El estudiante no ve su identidad.
>
> El CTG delibera fuera del sistema. Sus decisiones las materializa el usuario con rol Administrador.

---

## Módulos — MVP

| Módulo | Descripción | Archivo |
|---|---|---|
| MOD-01 | Autenticación y gestión de usuarios | `specs/prd/MOD-01.md` |
| MOD-02 | Gestión de ventanas de fechas | `specs/prd/MOD-02.md` |
| MOD-03 | Inscripción de idea | `specs/prd/MOD-03.md` |
| MOD-04 | Evaluación de idea | `specs/prd/MOD-04.md` |
| MOD-05 | Radicación de anteproyecto | `specs/prd/MOD-05.md` |
| MOD-06 | Evaluación de anteproyecto | `specs/prd/MOD-06.md` |
| MOD-07 | Correcciones de anteproyecto | `specs/prd/MOD-07.md` |
| MOD-08 | Control de integrantes | `specs/prd/MOD-08.md` |
| MOD-09 | Radicación de producto final | `specs/prd/MOD-09.md` |
| MOD-10 | Evaluación de producto final | `specs/prd/MOD-10.md` |
| MOD-11 | Correcciones de producto final | `specs/prd/MOD-11.md` |
| MOD-12 | Sustentación pública | `specs/prd/MOD-12.md` |
| MOD-13 | Generación de acta | `specs/prd/MOD-13.md` |
| MOD-14 | Plagio | `specs/prd/MOD-14.md` |
| MOD-15 | Mensajería asíncrona | `specs/prd/MOD-15.md` |
| MOD-16 | Historial y trazabilidad | `specs/prd/MOD-16.md` |
| MOD-17 | Reportes | `specs/prd/MOD-17.md` |

---

## Fase 2 — Should have

- Notificaciones por email (solo aviso de evento, no contenido)
- Dashboard con métricas generales: trabajos por estado, modalidad, programa
- Reportes por modalidad y programa con distribución por estado
- Reporte de trabajos entregados en una ventana de fechas específica
- Reporte de carga de docentes (director + jurado combinados)
- Alertas de plazo próximo a vencer para correcciones de estudiantes
- Exportación de reportes a Excel / PDF
- Gestión de solicitudes de retiro de integrantes con flujo de aprobación en el sistema

## Backlog — Nice to have

- Integración con sistema de biblioteca USC
- Integración con sistema de solicitud de intención de grado USC
- Extensión a otras facultades (configuración multi-facultad)
- Portal público de trabajos de grado aprobados
- Firma digital de documentos

---

## Flujos de usuario principales

### Flujo 1 — Estudiante inscribe una idea
1. El estudiante inicia sesión y accede a "Nuevo trabajo de grado"
2. Completa el formulario de inscripción (dentro de una ventana de fechas activa)
3. El sistema valida que el número de integrantes no supere el límite de la modalidad
4. El sistema registra la idea → estado **Pendiente de evaluación de idea**

### Flujo 2 — Administrador evalúa una idea
1. Accede al listado de ideas pendientes y revisa los datos
2a. Aprueba → asigna director → estado **Idea aprobada**
2b. Rechaza → registra motivo → estado **Idea rechazada**

### Flujo 3 — Estudiante radica el anteproyecto
1. Accede al trabajo en estado **Idea aprobada**
2. Adjunta los documentos obligatorios según su modalidad
3. Confirma la radicación → estado **Anteproyecto pendiente de evaluación**

### Flujo 4 — Evaluación por jurados
1. Administrador asigna Jurado 1 y Jurado 2
2. Cada jurado registra calificación + observaciones (15 días hábiles)
3. Sistema aplica lógica: aprobado / correcciones / reprobado / Jurado 3
4. Estudiante recibe resultado (jurados anónimos)

### Flujo 5 — Correcciones
1. Estudiante recibe observaciones → estado **Correcciones solicitadas**
2. Sube documento corregido con Vo.Bo. del director (10 días hábiles)
3. Segunda revisión: jurados solo pueden Aprobar o Reprobar

### Flujo 6 — Sustentación y acta
1. Administrador registra fecha, hora y lugar
2. Registra calificación de la sustentación
3. Si aprobada → estudiante diligencia autorización de biblioteca → Administrador emite acta → **Acta generada**

### Flujo 7 — Diplomado tecnológico (sin sustentación)
1. Producto final aprobado → sin etapa de sustentación
2. Estudiante diligencia autorización → Administrador emite acta → **Acta generada**

### Flujo 8 — Calificación de jurado fuera de plazo
1. Plazo vence → sistema mantiene habilitado el registro
2. Al registrar → queda marcada como **extemporánea**
3. Aparece en reporte de incumplimiento de jurados

---

## Criterios de aceptación

### Autenticación y roles
- Un usuario sin sesión no puede acceder a ninguna pantalla funcional
- Cada rol solo ve y ejecuta las acciones correspondientes a sus permisos

### Flujo de trabajo de grado
- El sistema impide adjuntar documentos fuera de una ventana de fechas activa (salvo ventana extemporánea habilitada)
- No se pueden agregar integrantes a un trabajo con anteproyecto aprobado
- El sistema impide avanzar de etapa si faltan adjuntos obligatorios
- La calificación registrada fuera del plazo queda marcada como extemporánea

### Jurados y anonimato
- El estudiante nunca puede ver el nombre real de los jurados
- La mensajería jurado→estudiante no revela la identidad del jurado

### Modalidades con reglas especiales
- Diplomado tecnológico: omite sustentación, pasa directo a acta
- Innovación y Emprendimiento: exige 4° adjunto en producto final
- Investigación: exige aval del comité de ética en anteproyecto

### Reportes
- Reporte de incumplimiento incluye nombre, trabajo, etapa y días de retraso
- Alerta de vencimiento lista jurados con plazo activo en los próximos N días hábiles (N configurable)

---

## Métricas de éxito

| Métrica | Descripción | Meta MVP |
|---|---|---|
| Adopción | % de trabajos gestionados en el sistema vs. total facultad | ≥ 80% en el primer periodo |
| Trazabilidad | % de trabajos con historial completo y sin gaps | 100% |
| Comunicación informal | Reducción de correos y formularios externos | Cualitativa — validar con secretaria |
| Cumplimiento de plazos | % de calificaciones dentro del plazo de 15/10 días hábiles | Línea base en primer periodo |
| Tiempo por etapa | Tiempo promedio por etapa del proceso | Línea base en primer periodo |
