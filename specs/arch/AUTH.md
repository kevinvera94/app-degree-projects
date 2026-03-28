# AUTH.md — Autenticación y autorización
> Estrategia de autenticación, flujo JWT, roles y matriz de permisos.
> Última actualización: 2026-03-28

---

## Estrategia de autenticación

Se usa **Supabase Auth** como proveedor de identidad. El backend FastAPI valida el JWT emitido por Supabase en cada request.

```
Cliente                  Supabase Auth             Backend FastAPI
  │                           │                          │
  │── POST /auth/login ───────►│                          │
  │◄── JWT (access + refresh)─│                          │
  │                           │                          │
  │── GET /api/projects ──────────────────────────────►  │
  │      Authorization: Bearer <JWT>                     │
  │                           │◄─ verify JWT ────────────│
  │                           │─── claims ──────────────►│
  │◄────────────────────────────── response ─────────────│
```

- **Token:** JWT firmado por Supabase (RS256)
- **Claims:** `sub` (user_id), `role`, `email`
- **Expiración:** access token 1 hora / refresh token 7 días
- **Almacenamiento en cliente:** `httpOnly cookie` o `localStorage` (decisión de implementación)

---

## Roles del sistema

| Rol | Descripción |
|---|---|
| `administrador` | Secretaria, directores de programa, cualquier persona designada por el CTG. Gestiona el sistema y materializa decisiones del CTG |
| `docente` | Docente registrado. Su función concreta (Director o Jurado) es por proyecto, no un permiso global |
| `estudiante` | Inscribe ideas, radica documentos, consulta estado de su trabajo |

---

## Matriz de permisos por módulo

| Acción | Administrador | Docente (Director) | Docente (Jurado) | Estudiante |
|---|:---:|:---:|:---:|:---:|
| Crear/editar usuarios | ✅ | ❌ | ❌ | ❌ |
| Configurar modalidades y parámetros | ✅ | ❌ | ❌ | ❌ |
| Gestionar ventanas de fechas | ✅ | ❌ | ❌ | ❌ |
| Habilitar ventana extemporánea | ✅ | ❌ | ❌ | ❌ |
| Ver listado de todos los trabajos | ✅ | ❌ | ❌ | ❌ |
| Ver detalle de su trabajo | ✅ | ✅ (asignados) | ✅ (asignados) | ✅ (propios) |
| Inscribir idea | ❌ | ❌ | ❌ | ✅ |
| Aprobar/rechazar idea | ✅ | ❌ | ❌ | ❌ |
| Asignar director al trabajo | ✅ | ❌ | ❌ | ❌ |
| Radicar anteproyecto | ❌ | ❌ | ❌ | ✅ |
| Asignar jurados | ✅ | ❌ | ❌ | ❌ |
| Registrar calificación | ❌ | ❌ | ✅ (asignados) | ❌ |
| Ver identidad de jurados | ✅ | ✅ (propio trab.) | ❌ | ❌ |
| Emitir Vo.Bo. del director | ❌ | ✅ (asignados) | ❌ | ❌ |
| Radicar producto final | ❌ | ❌ | ❌ | ✅ |
| Aprobar/rechazar producto final | ✅ | ❌ | ❌ | ❌ |
| Registrar sustentación | ✅ | ❌ | ❌ | ❌ |
| Emitir acta | ✅ | ❌ | ❌ | ❌ |
| Suspender por plagio | ✅ | ❌ | ❌ | ❌ |
| Ver reportes | ✅ | ❌ | ❌ | ❌ |
| Mensajería | ✅ | ✅ | ✅ | ✅ |

---

## Anonimato de jurados

El sistema garantiza que el **estudiante nunca pueda identificar a los jurados**:

1. **En la API:** los endpoints que retornan datos de jurados al estudiante **nunca incluyen** `docente_id`, `full_name` ni `email`. Solo retornan `juror_number` (`1`, `2` o `3`)
2. **En mensajería:** el campo `sender_display` del mensaje se usa en lugar del nombre real (`Jurado 1`, `Jurado 2`)
3. **En evaluaciones:** el endpoint de consulta de calificaciones para el estudiante omite la identidad del evaluador
4. **Regla de implementación:** cualquier serializer/schema que exponga datos de evaluaciones al rol `estudiante` debe filtrar los campos de identidad del jurado en la capa de servicio, no solo en el frontend

---

## Validación de acceso a recursos por proyecto

Además del rol, el backend valida que el usuario **pertenezca al proyecto** antes de permitir el acceso:

| Rol | Regla de pertenencia |
|---|---|
| `estudiante` | Debe estar en `project_members` con `is_active = true` |
| `docente` (Director) | Debe estar en `project_directors` con `is_active = true` |
| `docente` (Jurado) | Debe estar en `project_jurors` con `is_active = true` |
| `administrador` | Acceso a todos los proyectos sin restricción de pertenencia |

---

## Dependencias de seguridad (FastAPI)

```python
# core/dependencies.py

async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    """Valida JWT de Supabase y retorna el usuario."""

async def require_admin(user: User = Depends(get_current_user)) -> User:
    """Lanza 403 si el rol no es administrador."""

async def require_docente(user: User = Depends(get_current_user)) -> User:
    """Lanza 403 si el rol no es docente."""

async def require_project_member(
    project_id: UUID,
    user: User = Depends(get_current_user)
) -> User:
    """Valida que el usuario tenga acceso al proyecto específico."""
```
