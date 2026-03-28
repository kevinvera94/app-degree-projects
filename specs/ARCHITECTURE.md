# ARCHITECTURE.md — Diseño técnico del sistema
> Índice de arquitectura. Para detalle ir a `specs/arch/`.
> Última actualización: 2026-03-28

---

## Visión técnica

Sistema web de tres capas (SPA + API REST + BD relacional) desplegado en servicios cloud gratuitos para el MVP. Diseñado para ser stateless, extensible a otras facultades y con separación clara entre lógica de negocio y persistencia.

---

## Stack tecnológico

| Capa | Tecnología | Justificación |
|---|---|---|
| Frontend | React + Vite | Arranque rápido, ecosistema maduro, componentes reutilizables |
| Backend | FastAPI (Python) | Tipado con Pydantic, OpenAPI automático, ideal para APIs con roles complejos |
| Base de datos | PostgreSQL | Relaciones complejas entre entidades, robusto, transaccional |
| Autenticación | Supabase Auth | JWT + gestión de sesiones, reduce semanas de desarrollo |
| Almacenamiento | Supabase Storage | Carga, visualización y eliminación de archivos (documentos adjuntos) |
| Deploy Frontend | Vercel | CI/CD automático, tier gratuito para MVP |
| Deploy Backend | Render | FastAPI compatible, tier gratuito para MVP |

---

## Diagrama de alto nivel

```
┌─────────────────────────────────────────────────────────┐
│                     CLIENTE (Browser)                   │
│              React + Vite  (Vercel)                     │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTPS / REST JSON
┌───────────────────────▼─────────────────────────────────┐
│                  API REST (Render)                       │
│              FastAPI + Pydantic (Python)                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │ /auth    │ │/projects │ │/reports  │ │  /users   │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
└──────────┬──────────────────────────┬────────────────────┘
           │ SQL (asyncpg)            │ SDK
┌──────────▼──────────┐   ┌──────────▼──────────────────┐
│   PostgreSQL         │   │     Supabase                │
│   (Supabase DB)      │   │  Auth + Storage             │
└─────────────────────┘   └─────────────────────────────┘
```

---

## Principios arquitectónicos

| Principio | Aplicación |
|---|---|
| **Stateless API** | El backend no guarda estado de sesión; el JWT viaja en cada request |
| **Role-based access** | Cada endpoint valida el rol del token antes de ejecutar lógica |
| **Single source of truth** | El estado del trabajo de grado vive en la BD, no en el frontend |
| **Anonimato de jurados** | El backend nunca expone el ID real del jurado al cliente del estudiante |
| **Extensibilidad** | `faculty_id` en entidades clave permite multi-facultad sin reescritura |
| **Trazabilidad** | Todo cambio de estado se registra en `project_status_history` |
| **Separación de concerns** | Routers → validación de entrada / Services → lógica de negocio / Models → BD |

---

## Estructura de carpetas del proyecto

```
app-degree-projects/
  specs/
    BRIEF.md
    PRD.md
    ARCHITECTURE.md          ← este archivo (índice)
    TASKS.md
    DECISIONS.md
    prd/                     ← requerimientos funcionales (MOD-01 … MOD-17)
    arch/                    ← detalle técnico de arquitectura
      DATA-MODEL.md
      API.md
      AUTH.md
      INFRA.md
  frontend/                  ← React + Vite
    src/
      components/
      pages/
      hooks/
      services/
      utils/
      types/
  backend/                   ← FastAPI
    app/
      routers/
      models/
      schemas/
      services/
      core/
      utils/
  .gitignore
  CLAUDE.md
  README.md
```

---

## Documentos de arquitectura

| Documento | Contenido |
|---|---|
| `specs/arch/DATA-MODEL.md` | Entidades, campos, relaciones y diagrama ER |
| `specs/arch/API.md` | Endpoints por router, métodos, descripción y roles permitidos |
| `specs/arch/AUTH.md` | Estrategia de autenticación, flujo JWT, matriz de permisos por rol |
| `specs/arch/INFRA.md` | Variables de entorno, despliegue, entornos dev/prod |
| `specs/DESIGN.md` | Paleta de colores, tokens visuales e identidad gráfica USC |

---

## Decisiones técnicas clave

Ver `specs/DECISIONS.md` para el registro completo. Resumen:

- PostgreSQL sobre NoSQL: el modelo de datos tiene relaciones complejas y transacciones críticas (cambios de estado)
- Supabase Auth sobre JWT propio: reduce tiempo de implementación para el MVP
- FastAPI sobre Django/Flask: tipado estricto con Pydantic facilita validación de reglas de negocio complejas
- Sharding de documentación: PRD y ARCHITECTURE divididos en archivos por módulo para optimizar consumo de contexto en agentes
