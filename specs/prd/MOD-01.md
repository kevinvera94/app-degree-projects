# MOD-01 — Autenticación y gestión de usuarios
> Parte del PRD. Ver índice en `specs/PRD.md`.

**Descripción:** Control de acceso al sistema y administración de usuarios y sus roles.
**Actores:** Administrador, Docente, Estudiante.

| ID | Requerimiento | Actor |
|---|---|---|
| RF-01-01 | El sistema permite el registro de nuevos usuarios con: nombre completo, email institucional, contraseña y rol (Administrador, Docente, Estudiante) | Administrador |
| RF-01-02 | El sistema permite el inicio de sesión con email y contraseña | Todos |
| RF-01-03 | El sistema restringe el acceso a las funcionalidades según el rol del usuario autenticado | Todos |
| RF-01-04 | El Administrador puede crear, editar, activar y desactivar usuarios | Administrador |
| RF-01-05 | El Administrador puede cambiar el rol de un usuario existente | Administrador |
| RF-01-06 | El sistema permite al usuario recuperar su contraseña por email | Todos |
| RF-01-07 | El sistema permite al Administrador configurar los parámetros globales: límite de integrantes por modalidad/nivel, modalidades disponibles por nivel académico, días hábiles de alerta para vencimiento de jurados | Administrador |
| RF-01-08 | Un usuario sin sesión activa no puede acceder a ninguna pantalla funcional del sistema | Todos |
