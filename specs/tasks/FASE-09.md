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
  - [ ] Ruta: `/admin/configuracion`
  - [ ] Pestaña "Programas académicos": tabla CRUD (nombre, nivel, activo)
  - [ ] Pestaña "Modalidades": tabla CRUD con `max_members_default`. Al expandir una modalidad: tabla de límites por nivel (`modality_level_limits`) con opciones de crear/editar/eliminar
  - [ ] Pestaña "Ventanas de fechas": tabla con tipo, fechas, periodo, activo. Formulario de creación con `DatePicker`. Botón eliminar solo si sin radicaciones (muestra error `409` si las hay)
  - [ ] Pestaña "Parámetros": campo para "días de alerta vencimiento jurado" (N días configurable, RF-01-07)
- **Dependencias:** T-F09-03
- **Estado:** ⬜ Pendiente

---

### T-F09-05 — Implementar dashboard del Administrador
- **Módulo(s):** MOD-17
- **Referencias:** RF-17-02, RF-17-03, RF-17-05
- **Descripción:** Vista de inicio del Administrador con métricas clave y alertas del sistema.
- **Criterios de aceptación:**
  - [ ] Ruta: `/admin/dashboard`
  - [ ] Tarjetas de resumen: total de proyectos activos, pendientes de evaluación, correcciones sin respuesta, sustentaciones próximas
  - [ ] Sección "Alertas de vencimiento": lista de jurados con plazo próximo a vencer (usando `GET /reports/jurors/expiring?days=N`)
  - [ ] Sección "Pendientes de revisión": lista de proyectos con radicación sin jurados asignados
  - [ ] Click en cualquier ítem navega a la ficha del proyecto
- **Dependencias:** T-F09-04
- **Estado:** ⬜ Pendiente

---

### T-F09-06 — Implementar listado de proyectos con filtros (Admin)
- **Módulo(s):** MOD-17
- **Referencias:** RF-17-01, RF-17-08
- **Descripción:** Vista de todos los proyectos con filtros múltiples y acceso a ficha detallada.
- **Criterios de aceptación:**
  - [ ] Ruta: `/admin/proyectos`
  - [ ] Tabla con: título, modalidad, programa, periodo, estado (badge con color según estado), integrantes
  - [ ] Filtros: estado, modalidad, programa académico, periodo académico. Todos combinables
  - [ ] Paginación (20 por página)
  - [ ] Click en fila → navega a `/admin/proyectos/{id}`
  - [ ] Botón "Exportar" (opcional MVP, puede ser pendiente)
- **Dependencias:** T-F09-05
- **Estado:** ⬜ Pendiente

---

### T-F09-07 — Implementar ficha detalle de proyecto (Admin)
- **Módulo(s):** MOD-04, MOD-06, MOD-10, MOD-12, MOD-13, MOD-14, MOD-16, MOD-17
- **Referencias:** RF-17-08
- **Descripción:** Vista completa de un proyecto con toda la información y acciones disponibles según su estado actual.
- **Criterios de aceptación:**
  - [ ] Ruta: `/admin/proyectos/{id}`
  - [ ] Secciones: información general, estado actual (badge), integrantes, director(es), jurados, radicaciones, evaluaciones, historial
  - [ ] Acciones contextuales según estado (botones que aparecen solo cuando aplican):
    - `pendiente_evaluacion_idea` → "Aprobar idea" / "Rechazar idea"
    - `anteproyecto_pendiente_evaluacion` → "Asignar jurados"
    - Divergencia de jurados → "Asignar Jurado 3"
    - `producto_final_entregado` → "Asignar jurados producto final"
    - `aprobado_para_sustentacion` → "Programar sustentación"
    - `trabajo_aprobado` → "Emitir acta" (solo si autorización diligenciada)
    - Cualquier estado → "Suspender por plagio" / "Cancelar"
  - [ ] Panel de historial muestra eventos cronológicos
  - [ ] Ventana extemporánea: formulario para crear/revocar
- **Dependencias:** T-F09-06
- **Estado:** ⬜ Pendiente

---

### T-F09-08 — Implementar flujo de aprobación de idea (Admin)
- **Módulo(s):** MOD-04
- **Referencias:** RF-04-02, RF-04-03, RF-04-06
- **Descripción:** Modal para aprobar idea: seleccionar director(es) activos y confirmar.
- **Criterios de aceptación:**
  - [ ] Modal "Aprobar idea" en ficha de proyecto
  - [ ] Selector de docentes activos (llama `GET /users?role=docente&is_active=true`)
  - [ ] Permite seleccionar 1 o 2 directores (máx. 2)
  - [ ] Botón "Confirmar aprobación" → llama `POST /projects/{id}/directors` y `PATCH /projects/{id}/status { action: "aprobar" }`
  - [ ] Al éxito: actualiza estado en UI y muestra mensaje de confirmación
  - [ ] Modal "Rechazar idea": campo de texto para motivo (obligatorio) → llama `PATCH /projects/{id}/status { action: "rechazar", reason }`
- **Dependencias:** T-F09-07
- **Estado:** ⬜ Pendiente

---

### T-F09-09 — Implementar flujo de asignación de jurados (Admin)
- **Módulo(s):** MOD-06, MOD-10
- **Referencias:** RF-06-01, RF-06-08, RF-10-01, RF-10-02
- **Descripción:** Formulario para asignar Jurado 1, Jurado 2 y (si aplica) Jurado 3 en anteproyecto y producto final.
- **Criterios de aceptación:**
  - [ ] Formulario "Asignar jurados" con dos selectores: "Jurado 1" y "Jurado 2"
  - [ ] Selector de docentes activos con búsqueda por nombre
  - [ ] Para producto final: el sistema sugiere los mismos jurados del anteproyecto (marcados como "Sugerido")
  - [ ] Si se selecciona un jurado diferente al sugerido: aviso de que se registrará `replaced_docente_id` por trazabilidad
  - [ ] Formulario separado "Asignar Jurado 3" que solo aparece cuando el sistema detecta divergencia
  - [ ] Nota visible: "El Jurado 3 solo puede aprobar o reprobar"
- **Dependencias:** T-F09-08
- **Estado:** ⬜ Pendiente

---

### T-F09-10 — Implementar flujo de programación de sustentación (Admin)
- **Módulo(s):** MOD-12
- **Referencias:** RF-12-01, T-F07-06
- **Descripción:** Formulario para registrar la sustentación: asignar jurados para sustentación y registrar fecha/hora/lugar.
- **Criterios de aceptación:**
  - [ ] Modal "Programar sustentación" con: asignación de jurados para `stage = "sustentacion"`, `DatePicker` para fecha, `TimePicker` para hora, campo de texto para lugar
  - [ ] Llama `POST /projects/{id}/jurors` (x2 para J1 y J2 de sustentación) y `POST /projects/{id}/sustentation`
  - [ ] Al éxito: estado cambia a `sustentacion_programada`
  - [ ] El formulario indica que Jurado 3 no existe en sustentación
- **Dependencias:** T-F09-09
- **Estado:** ⬜ Pendiente

---

### T-F09-11 — Implementar flujo de emisión de acta (Admin)
- **Módulo(s):** MOD-13
- **Referencias:** RF-13-02..RF-13-05
- **Descripción:** El Administrador emite el acta, opcionalmente adjuntando el documento escaneado.
- **Criterios de aceptación:**
  - [ ] Botón "Emitir acta" visible solo cuando estado = `trabajo_aprobado`
  - [ ] El botón indica si el estudiante ya diligencio la autorización de biblioteca (verificar `acts.library_authorization != null`). Si no: botón deshabilitado con tooltip "El estudiante aún no ha diligenciado la autorización de biblioteca"
  - [ ] Modal: campo para subir archivo PDF del acta (opcional — `DATA-MODEL.acts.act_file_url` puede ser null). Nota: `acts` no tiene campo `act_number` según DATA-MODEL — remover ese campo si se incluyó
  - [ ] Llama `POST /projects/{id}/act` (multipart si hay archivo, JSON si no)
  - [ ] Al éxito: estado cambia a `acta_generada`. Si hay `act_file_url`: muestra botón de descarga
- **Dependencias:** T-F09-10
- **Estado:** ⬜ Pendiente

---

### T-F09-12 — Implementar reportes para Admin (vistas)
- **Módulo(s):** MOD-17
- **Referencias:** RF-17-04, RF-17-05, RF-17-06, RF-17-09
- **Descripción:** Vistas de los reportes del sistema: jurados extemporáneos, alerta de vencimiento, carga docente, ficha de estudiante.
- **Criterios de aceptación:**
  - [ ] Ruta: `/admin/reportes`
  - [ ] Pestaña "Jurados extemporáneos": tabla con docente, trabajo, etapa, días de retraso → llama `GET /reports/jurors/late`
  - [ ] Pestaña "Vencimiento próximo": tabla con N configurable en la vista, datos de jurados con plazo activo → llama `GET /reports/jurors/expiring?days=N`
  - [ ] Pestaña "Carga docente": selector de docente → tabla de trabajos como Director y Jurado → llama `GET /reports/docentes/{id}/workload`
  - [ ] Pestaña "Ficha estudiante": buscador por nombre/email → muestra ficha con trabajo, historial y calificaciones → llama `GET /reports/students/{id}`
- **Dependencias:** T-F09-11
- **Estado:** ⬜ Pendiente

---

### T-F09-13 — Implementar retiro de integrante y gestión de integrantes (Admin)
- **Módulo(s):** MOD-08
- **Referencias:** RF-08-02, RF-08-03
- **Descripción:** Vista de integrantes en la ficha del proyecto con opción de retiro.
- **Criterios de aceptación:**
  - [ ] Lista de integrantes en la ficha del proyecto con nombre, email, estado (activo/retirado)
  - [ ] Botón "Retirar" disponible en cualquier etapa posterior a aprobación del anteproyecto
  - [ ] Modal "Retirar integrante": campo de texto para justificación (obligatorio) + subida de archivo con aval del director (obligatorio)
  - [ ] Llama `PATCH /projects/{id}/members/{memberId}/remove` (multipart)
  - [ ] Si falta texto o archivo: botón "Confirmar" deshabilitado con mensaje explicativo
- **Dependencias:** T-F09-07
- **Estado:** ⬜ Pendiente

---

### T-F09-14 — Implementar bandeja de mensajes (vista Admin)
- **Módulo(s):** MOD-15
- **Referencias:** RF-15-07
- **Descripción:** Vista de mensajería del Administrador: ver mensajes por proyecto y enviar mensajes a cualquier usuario.
- **Criterios de aceptación:**
  - [ ] Badge de mensajes no leídos en el sidebar (llama `GET /messages/unread-count` periódicamente o al cargar)
  - [ ] Ruta: `/admin/mensajes` con listado de proyectos con mensajes, o acceso desde ficha del proyecto
  - [ ] Hilo de mensajes por proyecto (ordenados cronológicamente)
  - [ ] Formulario de nuevo mensaje: selector de destinatario (integrante, director, jurado o grupo)
  - [ ] Mensajes leídos/no leídos diferenciados visualmente
  - [ ] Al abrir un mensaje no leído: llama `PATCH /projects/{id}/messages/{msgId}/read`
- **Dependencias:** T-F09-12
- **Estado:** ⬜ Pendiente

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
