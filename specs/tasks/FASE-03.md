# FASE-03 — Backend: Auth, usuarios y parámetros del sistema
> Parte del plan de tareas. Ver índice en `specs/TASKS.md`.
> Módulos cubiertos: MOD-01, MOD-02.
> Objetivo: habilitar la gestión completa de usuarios, roles, programas, modalidades y ventanas de fechas.

---

## Tareas

### T-F03-01 — Implementar `GET /auth/me`
- **Módulo(s):** MOD-01
- **Referencias:** `specs/arch/API.md` §/auth, `specs/arch/AUTH.md`
- **Descripción:** Endpoint que retorna el perfil del usuario autenticado: datos del sistema más rol. Requiere JWT válido.
- **Criterios de aceptación:**
  - [x] `GET /api/v1/auth/me` retorna `{ id, full_name, email, role, is_active }` con JWT válido → `200`
  - [x] Sin JWT → `401`
  - [x] Usuario no encontrado en tabla `users` → `404`
  - [x] Schema Pydantic `UserMeResponse` creado en `backend/app/schemas/`
- **Dependencias:** T-F01-06, T-F02-02
- **Estado:** ✅ Completada

---

### T-F03-02 — Implementar CRUD de usuarios (`/users`)
- **Módulo(s):** MOD-01
- **Referencias:** `specs/arch/API.md` §/users, RF-01-01, RF-01-04, RF-01-05
- **Descripción:** Endpoints para crear, listar, ver y editar usuarios. Solo accesible para Administrador.
- **Criterios de aceptación:**
  - [x] `GET /api/v1/users` con filtros `role` e `is_active` → `200` lista paginada (solo Administrador)
  - [x] `POST /api/v1/users` crea usuario en Supabase Auth (con service role key) y en tabla `users` → `201`
  - [x] `GET /api/v1/users/{id}` → `200` detalle (solo Administrador)
  - [x] `PATCH /api/v1/users/{id}` edita `full_name`, `email`, `role` → `200` (solo Administrador)
  - [x] Validación: email único, rol válido
  - [x] `GET /users?role=docente&is_active=true` retorna solo docentes activos (para selectores de asignación)
  - [x] Schemas Pydantic `UserCreate`, `UserUpdate`, `UserResponse` creados
- **Dependencias:** T-F03-01
- **Estado:** ✅ Completada

---

### T-F03-03 — Implementar desactivación de docentes (`PATCH /users/{id}/deactivate`)
- **Módulo(s):** MOD-01, MOD-04
- **Referencias:** `specs/arch/API.md` §/users, RF-04-07, RF-04-08, RF-04-09, `specs/arch/AUTH.md` §Docente inactivo
- **Descripción:** Desactivar un docente bloquea su acceso, marca sus asignaciones activas como inactivas y genera alertas al Administrador sobre trabajos afectados.
- **Criterios de aceptación:**
  - [x] `PATCH /users/{id}/deactivate` → `200` (solo Administrador)
  - [x] Marca `users.is_active = false`
  - [x] Deshabilita el usuario en Supabase Auth (bloquea login)
  - [x] Marca `is_active = false` en todos los registros activos de `project_directors` y `project_jurors`
  - [x] Crea mensajes automáticos en `messages` para el Administrador, uno por cada trabajo afectado, indicando que requiere reasignación
  - [x] Retorna en el cuerpo la lista de `project_ids` afectados para que el frontend muestre las alertas
- **Dependencias:** T-F03-02
- **Estado:** ✅ Completada

---

### T-F03-04 — Implementar CRUD de programas académicos (`/academic-programs`)
- **Módulo(s):** MOD-01
- **Referencias:** `specs/arch/API.md` §/academic-programs, RF-01-07
- **Descripción:** Gestión de programas académicos. Catálogo configurable por el Administrador.
- **Criterios de aceptación:**
  - [x] `GET /api/v1/academic-programs` retorna lista con filtro opcional `is_active` → `200` (todos los roles)
  - [x] `POST /api/v1/academic-programs` crea programa → `201` (solo Administrador)
  - [x] `PATCH /api/v1/academic-programs/{id}` edita nombre, nivel, `is_active` → `200` (solo Administrador)
  - [x] Schemas Pydantic correspondientes creados
- **Dependencias:** T-F03-01, T-F02-03
- **Estado:** ✅ Completada

---

### T-F03-05 — Implementar CRUD de modalidades y límites (`/modalities`)
- **Módulo(s):** MOD-01
- **Referencias:** `specs/arch/API.md` §/modalities, RF-01-07, `specs/BRIEF.md` §8
- **Descripción:** Gestión de modalidades y sus límites de integrantes por nivel académico. Incluye la tabla `modality_level_limits`.
- **Criterios de aceptación:**
  - [x] `GET /api/v1/modalities` → `200` lista (todos los roles)
  - [x] `POST /api/v1/modalities` → `201` (solo Administrador)
  - [x] `PATCH /api/v1/modalities/{id}` → `200` edita `name`, `max_members_default`, `is_active` (solo Administrador)
  - [x] `GET /api/v1/modalities/{id}/limits` → `200` lista de límites por nivel (solo Administrador)
  - [x] `PUT /api/v1/modalities/{id}/limits/{level}` → `200/201` crea o actualiza límite específico (solo Administrador)
  - [x] `DELETE /api/v1/modalities/{id}/limits/{level}` → `204` elimina límite (usa `max_members_default`) (solo Administrador)
  - [x] Función de servicio `get_max_members(modality_id, level)` que consulta `modality_level_limits` y cae de regreso a `max_members_default` si no hay límite específico
- **Dependencias:** T-F03-01, T-F02-03
- **Estado:** ✅ Completada

---

### T-F03-06 — Implementar CRUD de ventanas de fechas (`/date-windows`)
- **Módulo(s):** MOD-02
- **Referencias:** `specs/arch/API.md` §/date-windows, RF-02-01..RF-02-06
- **Descripción:** Gestión de ventanas de fechas para radicación. Incluye validación de que no haya ventanas activas superpuestas del mismo tipo.
- **Criterios de aceptación:**
  - [ ] `GET /api/v1/date-windows` con filtros `window_type`, `academic_period`, `is_active` → `200` (todos los roles)
  - [ ] `POST /api/v1/date-windows` → `201` (solo Administrador). Valida que `start_date < end_date`
  - [ ] `PATCH /api/v1/date-windows/{id}` edita fechas, tipo y `is_active`. Solo si `start_date` no ha llegado aún → `200` (solo Administrador)
  - [ ] `DELETE /api/v1/date-windows/{id}` → `204`. Solo si no hay radicaciones asociadas a esa ventana; si hay → `409` (solo Administrador)
  - [ ] Función de servicio `is_window_active(window_type, project_id)` usada en radicaciones: verifica ventana global activa o ventana extemporánea del proyecto
- **Dependencias:** T-F03-01, T-F02-04
- **Estado:** ⬜ Pendiente

---

### T-F03-07 — Implementar ventanas extemporáneas (`/projects/{id}/extemporaneous-window`)
- **Módulo(s):** MOD-02
- **Referencias:** `specs/arch/API.md` §/projects/{id}/extemporaneous-window, RF-02-04
- **Descripción:** Habilitar o revocar ventanas extemporáneas individuales para un trabajo de grado específico.
- **Criterios de aceptación:**
  - [ ] `POST /projects/{id}/extemporaneous-window` body: `{ window_type, valid_until, notes? }` → `201` (solo Administrador)
  - [ ] `DELETE /projects/{id}/extemporaneous-window` → `204` (solo Administrador). Si no existe → `404`
  - [ ] La ventana extemporánea queda en `extemporaneous_windows` asociada al proyecto
  - [ ] `is_window_active()` del T-F03-06 la considera al verificar si una radicación está permitida
- **Dependencias:** T-F03-06
- **Estado:** ⬜ Pendiente

---

### T-F03-08 — Implementar recuperación de contraseña (Supabase Auth)
- **Módulo(s):** MOD-01
- **Referencias:** RF-01-06, `specs/arch/AUTH.md`
- **Descripción:** La recuperación de contraseña se delega a Supabase Auth. Configurar email template en Supabase y documentar el flujo en el frontend.
- **Criterios de aceptación:**
  - [ ] Email template de recuperación configurado en Supabase (asunto y cuerpo en español)
  - [ ] El flujo de recuperación funciona end-to-end: el usuario recibe el email y puede establecer nueva contraseña
  - [ ] Documentado en `specs/arch/AUTH.md` cómo el frontend llama a `supabase.auth.resetPasswordForEmail()`
- **Dependencias:** T-F01-04
- **Estado:** ⬜ Pendiente

---

### T-F03-09 — Tests de integración: endpoints de users y configuración
- **Módulo(s):** MOD-01, MOD-02
- **Referencias:** `specs/arch/API.md`, `specs/arch/AUTH.md`
- **Descripción:** Tests de integración que cubren los endpoints de la FASE-03: auth, users, academic-programs, modalities y date-windows.
- **Criterios de aceptación:**
  - [ ] Test: crear usuario con rol incorrecto → `400`
  - [ ] Test: desactivar docente con trabajos activos → mensajes de alerta generados
  - [ ] Test: crear ventana de fechas con `start_date >= end_date` → `400`
  - [ ] Test: eliminar ventana con radicaciones → `409`
  - [ ] Test: `GET /users?role=docente&is_active=true` → solo docentes activos en respuesta
  - [ ] Test: `get_max_members` para modalidad con límite específico vs sin límite específico
  - [ ] Tests en `backend/tests/test_config.py`
- **Dependencias:** T-F03-07
- **Estado:** ⬜ Pendiente
