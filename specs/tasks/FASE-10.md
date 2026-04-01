# FASE-10 — Frontend: Vistas de Estudiante y Docente
> Parte del plan de tareas. Ver índice en `specs/TASKS.md`.
> Objetivo: implementar todas las vistas y flujos de los roles Estudiante y Docente, incluyendo mensajería y la vista de reportes del Docente.

---

## Tareas

### T-F10-01 — Implementar dashboard del Estudiante
- **Módulo(s):** MOD-03, MOD-16
- **Referencias:** RF-03-08
- **Descripción:** Vista de inicio del Estudiante con el estado actual de su trabajo de grado y acciones disponibles.
- **Criterios de aceptación:**
  - [ ] Ruta: `/estudiante/dashboard`
  - [ ] Si no tiene trabajo inscrito: banner "No tienes un trabajo de grado inscrito" con botón "Inscribir idea" (solo visible si hay ventana activa)
  - [ ] Si tiene trabajo: tarjeta con título, modalidad, estado actual (badge con color), integrantes y director(es) asignados
  - [ ] Línea de tiempo del proceso (pasos visuales: Idea → Anteproyecto → Desarrollo → Producto Final → Sustentación → Acta) con indicador del paso actual
  - [ ] Acciones disponibles según estado: botón "Radicar anteproyecto" / "Subir correcciones" / "Radicar producto final" / "Diligenciar autorización de biblioteca" / "Descargar acta"
  - [ ] Si hay correcciones pendientes: contador de días hábiles restantes con color de alerta (rojo si ≤ 2 días)
- **Dependencias:** T-F09-02
- **Estado:** ⬜ Pendiente

---

### T-F10-02 — Implementar formulario de inscripción de idea (Estudiante)
- **Módulo(s):** MOD-03
- **Referencias:** RF-03-01..RF-03-08
- **Descripción:** Formulario completo para inscribir una nueva idea de trabajo de grado.
- **Criterios de aceptación:**
  - [ ] Ruta: `/estudiante/inscribir-idea`
  - [ ] Solo accesible si hay ventana activa para `inscripcion_idea` (si no hay, muestra aviso de "Ventana cerrada")
  - [ ] Campos: nombre del trabajo (máx. 100 chars con contador), modalidad (selector), programa académico (selector), línea de profundización (selector), grupo de investigación (`GIEIAM | COMBA I+D`), director sugerido (texto libre, opcional)
  - [ ] Sección "Integrantes": buscador de usuarios tipo `estudiante` activos. Agrega integrante a lista. Muestra el límite máximo calculado para la modalidad/nivel seleccionados
  - [ ] Checkbox declaración de requisitos previos (obligatorio para continuar)
  - [ ] Validaciones client-side antes de enviar: todos los campos obligatorios, mínimo 1 integrante, límite no superado
  - [ ] Llama `POST /projects` → al éxito redirige al dashboard con mensaje "Idea inscrita exitosamente"
  - [ ] Si no hay ventana activa: muestra fecha de próxima apertura si está disponible
- **Dependencias:** T-F10-01
- **Estado:** ⬜ Pendiente

---

### T-F10-03 — Implementar radicación de anteproyecto (Estudiante)
- **Módulo(s):** MOD-05
- **Referencias:** RF-05-01..RF-05-06
- **Descripción:** Vista para radicar el anteproyecto subiendo los documentos obligatorios según la modalidad del trabajo.
- **Criterios de aceptación:**
  - [ ] Ruta: `/estudiante/proyectos/{id}/radicar-anteproyecto`
  - [ ] Solo accesible si `status = idea_aprobada` y hay ventana activa para `radicacion_anteproyecto`
  - [ ] Lista de adjuntos requeridos según modalidad (con íconos de ✅ o ❌ según si ya fueron subidos):
    - Siempre: plantilla de anteproyecto, carta de aval, reporte de similitud
    - Solo Investigación: aval del comité de ética
  - [ ] Área de subida por adjunto: tipo de documento, botón "Seleccionar archivo" (acepta PDF, máx. 20MB), previsualización del nombre del archivo subido
  - [ ] Botón "Confirmar radicación" deshabilitado hasta que todos los obligatorios estén subidos
  - [ ] Flujo 3 pasos: (1) `POST /projects/{id}/submissions { stage: "anteproyecto" }`, (2) `POST .../attachments` para cada archivo, (3) `PATCH .../confirm` para confirmar
  - [ ] El botón "Confirmar radicación" llama `PATCH /projects/{id}/submissions/{subId}/confirm` → al éxito: estado cambia, redirige al dashboard
  - [ ] Aviso: "La carta de aval debe indicar explícitamente que el reporte de similitud es ≤ 20%"
- **Dependencias:** T-F10-02
- **Estado:** ⬜ Pendiente

---

### T-F10-04 — Implementar vista de evaluaciones del anteproyecto (Estudiante)
- **Módulo(s):** MOD-06, MOD-07
- **Referencias:** RF-06-04, RF-06-05, RF-06-11, RF-16-05
- **Descripción:** El estudiante puede ver las calificaciones y observaciones de los jurados (anónimas).
- **Criterios de aceptación:**
  - [x] Sección "Evaluaciones" en la ficha del proyecto del estudiante
  - [x] Muestra calificaciones recibidas: "Jurado 1: [score]", "Jurado 2: [score]" (sin nombre real)
  - [x] Muestra observaciones/recomendaciones de cada jurado
  - [x] Si el resultado es "Correcciones solicitadas": muestra el plazo restante en días hábiles
  - [x] Si el resultado es "Reprobado": mensaje de orientación sobre el próximo paso
  - [x] Si el resultado es "Aprobado": mensaje de felicitación y enlace al estado "En desarrollo"
  - [x] Calificaciones de Jurado 3 (si aplica) mostradas de igual forma
- **Dependencias:** T-F10-03
- **Estado:** ✅ Completada — 2026-04-01

---

### T-F10-05 — Implementar entrega de correcciones (Estudiante)
- **Módulo(s):** MOD-07, MOD-11
- **Referencias:** RF-07-01..RF-07-06, RF-11-01..RF-11-02
- **Descripción:** Vista unificada para entregar correcciones de anteproyecto o producto final.
- **Criterios de aceptación:**
  - [ ] Ruta: `/estudiante/proyectos/{id}/entregar-correcciones`
  - [ ] Muestra el tipo de corrección pendiente (anteproyecto o producto final) y el plazo restante
  - [ ] Si el plazo venció y no hay ventana activa: muestra aviso "El plazo venció. La entrega estará disponible cuando se abra la siguiente ventana de radicación"
  - [ ] Misma interfaz de subida de documentos que radicación inicial
  - [ ] Los mismos adjuntos obligatorios de la radicación original son requeridos en la corrección
  - [ ] Flujo de 3 pasos: (1) `POST /submissions { stage }`, (2) subir adjuntos, (3) `PATCH /submissions/{id}/confirm`
  - [ ] El `stage` correcto es `"correcciones_anteproyecto"` o `"correcciones_producto_final"` (valores del DATA-MODEL, no enviar `is_correction`)
  - [ ] Al confirmar: estado cambia a `anteproyecto_corregido_entregado` o `producto_final_corregido_entregado`
- **Dependencias:** T-F10-04
- **Estado:** ⬜ Pendiente

---

### T-F10-06 — Implementar radicación de producto final (Estudiante)
- **Módulo(s):** MOD-09
- **Referencias:** RF-09-01..RF-09-06
- **Descripción:** Vista para radicar el producto final. Análoga a la del anteproyecto con adjuntos adicionales.
- **Criterios de aceptación:**
  - [ ] Ruta: `/estudiante/proyectos/{id}/radicar-producto-final`
  - [ ] Solo accesible si `status = en_desarrollo` y hay ventana activa para `radicacion_producto_final`
  - [ ] Lista de adjuntos requeridos:
    - Siempre: plantilla, carta de aval, reporte de similitud
    - Solo Innovación y Emprendimiento: certificación de inscripción del Plan de Negocio
    - Opcional (si vinculado a empresa): carta de impacto (con aviso de que el Admin la validará)
  - [ ] Botón "Confirmar radicación" deshabilitado hasta que todos los obligatorios estén subidos
  - [ ] Flujo 3 pasos: (1) `POST /submissions { stage: "producto_final" }`, (2) subir adjuntos, (3) `PATCH /submissions/{id}/confirm`
- **Dependencias:** T-F10-05
- **Estado:** ⬜ Pendiente

---

### T-F10-07 — Implementar autorización de biblioteca y descarga de acta (Estudiante)
- **Módulo(s):** MOD-13
- **Referencias:** RF-13-01, RF-13-05
- **Descripción:** El estudiante diligencia la autorización de publicación en biblioteca y puede descargar el acta una vez emitida.
- **Criterios de aceptación:**
  - [ ] Sección "Acta y biblioteca" visible en dashboard cuando `status = trabajo_aprobado` o `acta_generada`
  - [ ] Formulario con pregunta clara: "¿Autoriza la publicación de su trabajo en la biblioteca de la USC?" con opciones Sí / No y descripción de implicaciones
  - [ ] Llama `PATCH /projects/{id}/library-authorization { library_authorization: true|false }` (endpoint dedicado, distinto al `POST /act`)
  - [ ] Muestra confirmación: "Tu autorización ha sido registrada. El Administrador emitirá el acta pronto."
  - [ ] Cuando `status = acta_generada` y el acta tiene `act_file_url`: botón "Descargar acta" → `GET /projects/{id}/act` retorna URL firmada → abre en nueva pestaña
  - [ ] Si el acta no tiene archivo adjunto (`act_file_url = null`): mostrar "El acta fue registrada pero no tiene archivo digital adjunto. Contacta a la secretaría."
- **Dependencias:** T-F10-06
- **Estado:** ⬜ Pendiente

---

### T-F10-08 — Implementar historial del proyecto (vista Estudiante)
- **Módulo(s):** MOD-16
- **Referencias:** RF-16-05
- **Descripción:** El estudiante puede ver el historial cronológico de su trabajo de grado.
- **Criterios de aceptación:**
  - [ ] Pestaña "Historial" en la ficha del proyecto del estudiante
  - [ ] Lista de eventos cronológicos: cambios de estado, documentos subidos, calificaciones (anónimas)
  - [ ] Cada evento muestra fecha, tipo de evento y descripción
  - [ ] Calificaciones sin identidad de jurado (solo "Jurado 1", "Jurado 2")
  - [ ] Llama `GET /projects/{id}/history`
- **Dependencias:** T-F10-07
- **Estado:** ⬜ Pendiente

---

### T-F10-09 — Implementar dashboard del Docente
- **Módulo(s):** MOD-17
- **Referencias:** RF-17-06, RF-17-07
- **Descripción:** Vista de inicio del Docente con sus trabajos asignados como Director y como Jurado.
- **Criterios de aceptación:**
  - [ ] Ruta: `/docente/dashboard`
  - [ ] Sección "Mis trabajos como Director": tabla con título, programa, estado, acciones
  - [ ] Sección "Mis trabajos como Jurado": tabla con título, programa, estado, calificación pendiente (indicador visual si tiene plazo activo)
  - [ ] Badge de alerta en trabajos de Jurado con plazo próximo a vencer
  - [ ] Llama `GET /projects/my`
- **Dependencias:** T-F09-02
- **Estado:** ⬜ Pendiente

---

### T-F10-10 — Implementar ficha de proyecto para Docente
- **Módulo(s):** MOD-06, MOD-10, MOD-12, MOD-16
- **Referencias:** RF-16-06
- **Descripción:** Vista detallada del proyecto para el Docente, diferenciada según su función (Director o Jurado).
- **Criterios de aceptación:**
  - [ ] Ruta: `/docente/proyectos/{id}`
  - [ ] Información general: título, modalidad, estado, integrantes
  - [ ] Si es Director: ve los documentos radicados, puede ver la identidad de los jurados (RF-AUTH.md), ve el historial completo
  - [ ] Si es Jurado: ve el documento de anteproyecto/producto final (URL firmada), formulario de calificación, plazo restante. No ve la calificación del otro jurado hasta haber registrado la suya (o hasta que ambos hayan calificado)
  - [ ] Llama `GET /projects/{id}` y `GET /projects/{id}/evaluations`
- **Dependencias:** T-F10-09
- **Estado:** ⬜ Pendiente

---

### T-F10-11 — Implementar formulario de calificación del Jurado
- **Módulo(s):** MOD-06, MOD-10, MOD-12
- **Referencias:** RF-06-05, RF-10-03, RF-12-03
- **Descripción:** Formulario para que el Jurado registre su calificación numérica y observaciones.
- **Criterios de aceptación:**
  - [ ] Formulario visible en la ficha del proyecto cuando el Jurado tiene evaluación pendiente
  - [ ] Campo: calificación numérica (0.0 a 5.0, con decimales, validación client-side)
  - [ ] Campo: observaciones (texto, obligatorio si `score < 4.0` como buena práctica — no es restricción técnica del sistema)
  - [ ] Para **segunda revisión** y **Jurado 3**: solo permite calificaciones ≥ 4.0 (Aprobado) o < 3.0 (Reprobado). Si `3.0 <= score < 4.0`: muestra error "En esta etapa solo puede Aprobar (≥ 4.0) o Reprobar (< 3.0)"
  - [ ] Para **sustentación**: acepta cualquier valor 0.0–5.0 (el sistema promedia)
  - [ ] Indicador de plazo: "[N] días hábiles restantes" con color de alerta
  - [ ] Si el plazo venció: aviso en naranja "El plazo ha vencido. Su calificación quedará marcada como extemporánea"
  - [ ] Llama `POST /projects/{id}/evaluations` o `POST /projects/{id}/sustentation/evaluations`
  - [ ] Botón "Registrar calificación" con confirmación modal
- **Dependencias:** T-F10-10
- **Estado:** ⬜ Pendiente

---

### T-F10-12 — Implementar mensajería para Estudiante y Docente
- **Módulo(s):** MOD-15
- **Referencias:** RF-15-01..RF-15-09
- **Descripción:** Vista de bandeja de mensajes y composición de mensajes para Estudiante y Docente.
- **Criterios de aceptación:**
  - [ ] Badge de mensajes no leídos en sidebar para Estudiante y Docente
  - [ ] Ruta: `/estudiante/mensajes` y `/docente/mensajes`
  - [ ] Lista de conversaciones por proyecto (muestra el último mensaje y si hay no leídos)
  - [ ] Hilo de mensajes: lista cronológica con remitente (`sender_display`), contenido y fecha
  - [ ] Jurados mostrados como "Jurado 1" / "Jurado 2" (nunca el nombre real para el Estudiante)
  - [ ] Formulario de respuesta al pie del hilo
  - [ ] Estudiante puede iniciar mensaje a Director o Jurado (selector con opciones anónimas para jurados)
  - [ ] Docente como Director puede enviar mensaje a Estudiante o Admin
  - [ ] Al abrir hilo: marca mensajes no leídos como leídos (`PATCH /projects/{id}/messages/{msgId}/read`)
- **Dependencias:** T-F10-11
- **Estado:** ⬜ Pendiente

---

### T-F10-13 — Tests E2E básicos: flujos de Estudiante y Docente
- **Módulo(s):** MOD-03..MOD-13, MOD-15
- **Referencias:** —
- **Descripción:** Tests E2E básicos para los flujos críticos del Estudiante y el Docente.
- **Criterios de aceptación:**
  - [ ] Test E2E: Estudiante inscribe idea → Admin aprueba → Estudiante radica anteproyecto
  - [ ] Test E2E: Jurado registra calificación → resultado Correcciones → Estudiante entrega correcciones
  - [ ] Test E2E: Flujo completo hasta Acta generada (happy path)
  - [ ] Test E2E: Estudiante ve jurados como "Jurado N" (nunca nombre real)
  - [ ] Test E2E: Estudiante envía mensaje a Jurado → Jurado responde → Estudiante ve "Jurado N" como remitente
  - [ ] Test E2E: Docente Jurado registra calificación fuera del plazo → marcada como extemporánea
- **Dependencias:** T-F10-12, T-F09-16
- **Estado:** ⬜ Pendiente
