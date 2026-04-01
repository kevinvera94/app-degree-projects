# FASE-09 — Frontend: Base, autenticación y panel de administrador
> Parte del plan de tareas. Ver índice en `specs/TASKS.md`.
> Objetivo: implementar el setup base del frontend (routing, layout, autenticación) y todas las vistas y flujos del rol Administrador.

---

## Notas de fase

- El cliente Supabase se inicializa en `frontend/src/services/supabase.ts`.
- El token JWT se almacena en memoria (React Context), nunca en `localStorage` (ver AUTH.md).
- Todos los llamados a la API usan `axios` con interceptor que agrega el header `Authorization: Bearer <JWT>`.
- Los componentes siguen la paleta USC definida en `specs/DESIGN.md`.

---

## Tareas

### T-F09-01 — Implementar layout base y sistema de routing
- **Módulo(s):** —
- **Referencias:** `specs/ARCHITECTURE.md`, `specs/DESIGN.md`
- **Descripción:** Configurar React Router con rutas protegidas por rol, layout con sidebar de navegación diferenciado por rol y estructura base de la aplicación.
- **Criterios de aceptación:**
  - [x] `react-router-dom` configurado con rutas anidadas (layout + páginas)
  - [x] Ruta pública: `/login`
  - [x] Rutas protegidas: `/admin/*`, `/docente/*`, `/estudiante/*`
  - [x] `ProtectedRoute` component que verifica JWT y rol; redirige a `/login` si no hay sesión
  - [x] Layout con sidebar: logo USC, links de navegación según rol, badge de mensajes no leídos, botón de logout
  - [x] Colores del sidebar: `--usc-navy` (#0D2B5E) como fondo, texto blanco, link activo con `--usc-blue`
  - [x] Componente `AuthContext` con `user`, `token`, `login()`, `logout()`
  - [x] Axios instance con interceptor `Authorization: Bearer <token>` configurado
- **Dependencias:** T-F01-03
- **Estado:** ✅ Completada

---

### T-F09-02 — Implementar página de login y recuperación de contraseña
- **Módulo(s):** MOD-01
- **Referencias:** RF-01-02, RF-01-06, `specs/arch/AUTH.md`
- **Descripción:** Página de login con email/password usando Supabase Auth. Flujo de recuperación de contraseña.
- **Criterios de aceptación:**
  - [x] Página `/login` con formulario: email, contraseña, botón "Ingresar"
  - [x] Logo USC centrado, fondo blanco, botón con `--usc-blue`
  - [x] Llama a `supabase.auth.signInWithPassword()`. Al éxito: guarda JWT en contexto, redirige según `user.role`
  - [x] Errores de credenciales: mensaje en español "Credenciales inválidas"
  - [x] Link "¿Olvidaste tu contraseña?" → flujo `supabase.auth.resetPasswordForEmail()`
  - [x] Página de confirmación de envío de email de recuperación
  - [x] Sin sesión activa ninguna ruta protegida es accesible (redirige a `/login`)
- **Dependencias:** T-F09-01
- **Estado:** ✅ Completada

---

### T-F09-03 — Implementar gestión de usuarios (Admin)
- **Módulo(s):** MOD-01
- **Referencias:** RF-01-01, RF-01-04, RF-01-05, RF-04-07
- **Descripción:** CRUD de usuarios para el Administrador: listar, crear, editar, activar/desactivar.
- **Criterios de aceptación:**
  - [x] Ruta: `/admin/usuarios`
  - [x] Tabla con: nombre, email, rol, estado (activo/inactivo), acciones
  - [x] Filtros: por rol (`administrador | docente | estudiante`) y estado (`activo | inactivo`)
  - [x] Formulario de creación: nombre, email, contraseña temporal, rol → llama `POST /users`
  - [x] Formulario de edición: nombre, email, rol → llama `PATCH /users/{id}`
  - [x] Botón "Desactivar": confirma con modal → llama `PATCH /users/{id}/deactivate`. Si hay trabajos afectados, muestra lista de trabajos que requieren reasignación
  - [x] Botón "Activar": llama `PATCH /users/{id}` con `{ is_active: true }`
- **Dependencias:** T-F09-02
- **Estado:** ✅ Completada

---

### T-F09-04 — Implementar configuración del sistema (Admin)
- **Módulo(s):** MOD-01, MOD-02
- **Referencias:** RF-01-07, RF-02-01..RF-02-06
- **Descripción:** Vistas de configuración: programas académicos, modalidades con límites, ventanas de fechas.
- **Criterios de aceptación:**
  - [x] Ruta: `/admin/configuracion`
  - [x] Pestaña "Programas académicos": tabla CRUD (nombre, nivel, activo)
  - [x] Pestaña "Modalidades": tabla CRUD con `max_members_default`. Al expandir una modalidad: tabla de límites por nivel (`modality_level_limits`) con opciones de crear/editar/eliminar
  - [x] Pestaña "Ventanas de fechas": tabla con tipo, fechas, periodo, activo. Formulario de creación con `DatePicker`. Botón eliminar solo si sin radicaciones (muestra error `409` si las hay)
  - [x] Pestaña "Parámetros": campo para "días de alerta vencimiento jurado" (N días configurable, RF-01-07)
- **Dependencias:** T-F09-03
- **Estado:** ✅ Completada

---

### T-F09-05 — Implementar dashboard del Administrador
- **Módulo(s):** MOD-17
- **Referencias:** RF-17-02, RF-17-03, RF-17-05
- **Descripción:** Vista de inicio del Administrador con métricas clave y alertas del sistema.
- **Criterios de aceptación:**
  - [x] Ruta: `/admin/dashboard`
  - [x] Tarjetas de resumen: total de proyectos activos, pendientes de evaluación, correcciones sin respuesta, sustentaciones próximas
  - [x] Sección "Alertas de vencimiento": lista de jurados con plazo próximo a vencer (usando `GET /reports/jurors/expiring?days=N`)
  - [x] Sección "Pendientes de revisión": lista de proyectos con radicación sin jurados asignados
  - [x] Click en cualquier ítem navega a la ficha del proyecto
- **Dependencias:** T-F09-04
- **Estado:** ✅ Completada

---

### T-F09-06 — Implementar listado de proyectos con filtros (Admin)
- **Módulo(s):** MOD-17
- **Referencias:** RF-17-01, RF-17-08
- **Descripción:** Vista de todos los proyectos con filtros múltiples y acceso a ficha detallada.
- **Criterios de aceptación:**
  - [x] Ruta: `/admin/proyectos`
  - [x] Tabla con: título, modalidad, programa, periodo, estado (badge con color según estado)
  - [x] Filtros: estado, modalidad, programa académico, periodo académico. Todos combinables
  - [x] Paginación (20 por página)
  - [x] Click en fila → navega a `/admin/proyectos/{id}`
  - [x] Botón "Exportar" visible pero deshabilitado (pendiente MVP)
- **Dependencias:** T-F09-05
- **Estado:** ✅ Completada

---

### T-F09-07 — Implementar ficha detalle de proyecto (Admin)
- **Módulo(s):** MOD-04, MOD-06, MOD-10, MOD-12, MOD-13, MOD-14, MOD-16, MOD-17
- **Referencias:** RF-17-08
- **Descripción:** Vista completa de un proyecto con toda la información y acciones disponibles según su estado actual.
- **Criterios de aceptación:**
  - [x] Ruta: `/admin/proyectos/{id}`
  - [x] Secciones: información general, estado actual (badge), integrantes, director(es), jurados, radicaciones, evaluaciones, historial
  - [x] Acciones contextuales según estado (botones que aparecen solo cuando aplican):
    - [x] `pendiente_evaluacion_idea` → "Aprobar idea" / "Rechazar idea" (botones; modales en T-F09-08)
    - [x] `anteproyecto_pendiente_evaluacion` → "Asignar jurados" (botón; modal en T-F09-09)
    - [x] Divergencia de jurados → "Asignar Jurado 3" (detectada client-side)
    - [x] `producto_final_entregado` → "Asignar jurados producto final"
    - [x] `aprobado_para_sustentacion` → "Programar sustentación" (botón; modal en T-F09-10)
    - [x] `trabajo_aprobado` → "Emitir acta" (botón; modal en T-F09-11)
    - [x] Cualquier estado → "Suspender por plagio" / "Cancelar" (funcionales, piden motivo)
  - [x] Panel de historial muestra eventos cronológicos
  - [x] Ventana extemporánea: formulario para crear/revocar
- **Dependencias:** T-F09-06
- **Estado:** ✅ Completada

---

### T-F09-08 — Implementar flujo de aprobación de idea (Admin)
- **Módulo(s):** MOD-04
- **Referencias:** RF-04-02, RF-04-03, RF-04-06
- **Descripción:** Modal para aprobar idea: seleccionar director(es) activos y confirmar.
- **Criterios de aceptación:**
  - [x] Modal "Aprobar idea" en ficha de proyecto
  - [x] Selector de docentes activos (llama `GET /users?role=docente&is_active=true`)
  - [x] Permite seleccionar 1 o 2 directores (máx. 2)
  - [x] Botón "Confirmar aprobación" → llama `POST /projects/{id}/directors` y `PATCH /projects/{id}/status { action: "aprobar" }`
  - [x] Al éxito: actualiza estado en UI y recarga la ficha
  - [x] Modal "Rechazar idea": campo de texto para motivo (obligatorio) → llama `PATCH /projects/{id}/status { action: "rechazar", reason }`
- **Dependencias:** T-F09-07
- **Estado:** ✅ Completada

---

### T-F09-09 — Implementar flujo de asignación de jurados (Admin)
- **Módulo(s):** MOD-06, MOD-10
- **Referencias:** RF-06-01, RF-06-08, RF-10-01, RF-10-02
- **Descripción:** Formulario para asignar Jurado 1, Jurado 2 y (si aplica) Jurado 3 en anteproyecto y producto final.
- **Criterios de aceptación:**
  - [x] Formulario "Asignar jurados" con dos selectores: "Jurado 1" y "Jurado 2"
  - [x] Selector de docentes activos con búsqueda por nombre (listbox filtrable)
  - [x] Para producto final: sugerencias del anteproyecto marcadas como "★ Sugerido"
  - [x] Si se selecciona un jurado diferente al sugerido: aviso de trazabilidad
  - [x] Formulario separado "Asignar Jurado 3" con stage resuelto desde la divergencia detectada
  - [x] Nota visible: "El Jurado 3 solo puede aprobar o reprobar"
- **Dependencias:** T-F09-08
- **Estado:** ✅ Completada

---

### T-F09-10 — Implementar flujo de programación de sustentación (Admin)
- **Módulo(s):** MOD-12
- **Referencias:** RF-12-01, T-F07-06
- **Descripción:** Formulario para registrar la sustentación: asignar jurados para sustentación y registrar fecha/hora/lugar.
- **Criterios de aceptación:**
  - [x] Modal "Programar sustentación" con: asignación de jurados para `stage = "sustentacion"`, `<input type="date">` para fecha, `<input type="time">` para hora, campo de texto para lugar
  - [x] Llama `POST /projects/{id}/jurors` (x2 para J1 y J2) y `POST /projects/{id}/sustentation`
  - [x] Al éxito: recarga la ficha (estado cambia a `sustentacion_programada`)
  - [x] Nota visible: "La sustentación no cuenta con Jurado 3"
- **Dependencias:** T-F09-09
- **Estado:** ✅ Completada

---

### T-F09-11 — Implementar flujo de emisión de acta (Admin)
- **Módulo(s):** MOD-13
- **Referencias:** RF-13-02..RF-13-05
- **Descripción:** El Administrador emite el acta, opcionalmente adjuntando el documento escaneado.
- **Criterios de aceptación:**
  - [x] Botón "Emitir acta" visible solo cuando estado = `trabajo_aprobado`
  - [x] Al abrir el modal: llama `GET /projects/{id}/act` para verificar `library_authorization`. Si no está: muestra advertencia y bloquea la emisión
  - [x] Modal: campo de archivo PDF opcional. Sin `act_number` (no existe en DATA-MODEL)
  - [x] Llama `POST /projects/{id}/act` (multipart si hay archivo, JSON vacío si no)
  - [x] Al éxito: recarga la ficha (estado cambia a `acta_generada`)
- **Dependencias:** T-F09-10
- **Estado:** ✅ Completada

---

### T-F09-12 — Implementar reportes para Admin (vistas)
- **Módulo(s):** MOD-17
- **Referencias:** RF-17-04, RF-17-05, RF-17-06, RF-17-09
- **Descripción:** Vistas de los reportes del sistema: jurados extemporáneos, alerta de vencimiento, carga docente, ficha de estudiante.
- **Criterios de aceptación:**
  - [x] Ruta: `/admin/reportes`
  - [x] Pestaña "Jurados extemporáneos": tabla con docente, trabajo, etapa, días de retraso → llama `GET /reports/jurors/late`
  - [x] Pestaña "Vencimiento próximo": tabla con N configurable en la vista, datos de jurados con plazo activo → llama `GET /reports/jurors/expiring?days=N`
  - [x] Pestaña "Carga docente": selector de docente → tabla de trabajos como Director y Jurado → llama `GET /reports/docentes/{id}/workload`
  - [x] Pestaña "Ficha estudiante": buscador por nombre/email → muestra ficha con trabajo, historial y calificaciones → llama `GET /reports/students/{id}`
- **Dependencias:** T-F09-11
- **Estado:** ✅ Completada

---

### T-F09-13 — Implementar retiro de integrante y gestión de integrantes (Admin)
- **Módulo(s):** MOD-08
- **Referencias:** RF-08-02, RF-08-03
- **Descripción:** Vista de integrantes en la ficha del proyecto con opción de retiro.
- **Criterios de aceptación:**
  - [x] Lista de integrantes en la ficha del proyecto con nombre, email, estado (activo/retirado)
  - [x] Botón "Retirar" disponible en cualquier etapa posterior a aprobación del anteproyecto
  - [x] Modal "Retirar integrante": campo de texto para justificación (obligatorio) + subida de archivo con aval del director (obligatorio)
  - [x] Llama `PATCH /projects/{id}/members/{memberId}/remove` (multipart)
  - [x] Si falta texto o archivo: botón "Confirmar" deshabilitado con mensaje explicativo
- **Dependencias:** T-F09-07
- **Estado:** ✅ Completada

---

### T-F09-14 — Implementar bandeja de mensajes (vista Admin)
- **Módulo(s):** MOD-15
- **Referencias:** RF-15-07
- **Descripción:** Vista de mensajería del Administrador: ver mensajes por proyecto y enviar mensajes a cualquier usuario.
- **Criterios de aceptación:**
  - [x] Badge de mensajes no leídos en el sidebar (llama `GET /messages/unread-count` periódicamente o al cargar)
  - [x] Ruta: `/admin/mensajes` con listado de proyectos con mensajes, o acceso desde ficha del proyecto
  - [x] Hilo de mensajes por proyecto (ordenados cronológicamente)
  - [x] Formulario de nuevo mensaje: selector de destinatario (integrante, director, jurado o grupo)
  - [x] Mensajes leídos/no leídos diferenciados visualmente
  - [x] Al abrir un mensaje no leído: llama `PATCH /projects/{id}/messages/{msgId}/read`
- **Dependencias:** T-F09-12
- **Estado:** ✅ Completada

---

### T-F09-15 — Implementar suspensión por plagio y cancelación (Admin)
- **Módulo(s):** MOD-14
- **Referencias:** RF-14-01..RF-14-04, RF-07-05
- **Descripción:** Acciones de administración de estados críticos: suspensión por plagio y cancelación de proyecto.
- **Criterios de aceptación:**
  - [ ] Botón "Suspender por plagio" visible en cualquier ficha de proyecto activo
  - [ ] Modal: campo de motivo obligatorio, aviso "Esta acción es irreversible desde el sistema"
  - [ ] Llama `PATCH /projects/{id}/status { action: "suspender_plagio", reason }`
  - [ ] Al éxito: estado cambia a `suspendido_por_plagio`, todas las acciones de avance se ocultan/deshabilitan
  - [ ] Botón "Cancelar/Archivar" para trabajos abandonados (motivo obligatorio)
  - [ ] Llama `PATCH /projects/{id}/status { action: "cancelar", reason }`
- **Dependencias:** T-F09-14
- **Estado:** ⬜ Pendiente

---

### T-F09-16 — Tests E2E básicos: flujos del Administrador
- **Módulo(s):** MOD-01..MOD-17
- **Referencias:** —
- **Descripción:** Tests E2E básicos para los flujos críticos del Administrador usando Playwright o Cypress.
- **Criterios de aceptación:**
  - [ ] Test E2E: login como Admin → ver dashboard → aprobar una idea → verificar estado
  - [ ] Test E2E: asignar jurados → registrar calificaciones → verificar transición de estado
  - [ ] Test E2E: programar sustentación → registrar calificaciones → verificar `trabajo_aprobado`
  - [ ] Test E2E: desactivar docente → verificar alerta de reasignación generada
  - [ ] Framework de E2E configurado (Playwright recomendado)
- **Dependencias:** T-F09-15
- **Estado:** ⬜ Pendiente
