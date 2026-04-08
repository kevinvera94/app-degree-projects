# Frontend — React + Vite

Interfaz web del sistema de gestión de trabajos de grado USC.

> Variables de entorno y deploy: [`specs/arch/INFRA.md`](../specs/arch/INFRA.md)
> Paleta de colores e identidad visual: [`specs/DESIGN.md`](../specs/DESIGN.md)

---

## Setup

```bash
# Desde la raíz del repositorio
cd frontend

npm install

cp .env.example .env
# Completar .env con la URL del backend y las claves públicas de Supabase
```

---

## Comandos de desarrollo

```bash
# Levantar servidor de desarrollo con hot-reload
npm run dev
# → http://localhost:5173

# Compilar para producción
npm run build
# Salida en dist/

# Previsualizar el build de producción localmente
npm run preview

# Verificar estilo de código
npm run lint

# Corregir errores de lint automáticamente
npm run lint:fix

# Formatear código con Prettier
npm run format
```

---

## Tests E2E (Playwright)

```bash
# Instalar browsers (solo la primera vez)
npx playwright install

# Configurar credenciales de prueba
cp e2e/.env.e2e.example e2e/.env.e2e
# Completar con emails y contraseñas de usuarios de prueba en Supabase

# Correr la suite completa (requiere backend y frontend levantados)
npm run test:e2e

# Modo UI — útil para depurar tests paso a paso
npm run test:e2e:ui

# Ver el reporte HTML del último run
npm run test:e2e:report
```

Los tests están organizados en `e2e/specs/` por flujo y rol (admin, estudiante, docente).

---

## Estructura

```
frontend/
  src/
    components/
      ui/               ← botones, inputs, modales, tablas, badges
      layout/           ← sidebar, navbar, page wrapper
      forms/            ← formularios reutilizables por módulo
    pages/
      auth/             ← login, recuperación de contraseña
      admin/            ← dashboard, proyectos, configuración, reportes, mensajes
      estudiante/       ← dashboard, inscripción, radicación, historial
      docente/          ← dashboard, ficha de proyecto, calificación
    hooks/              ← custom hooks (useAuth, useProject, ...)
    services/           ← llamadas a la API (wrappers de axios)
    types/              ← tipos e interfaces TypeScript
    utils/              ← helpers de fechas, formato y validación
    routes/             ← definición de rutas con React Router
    context/            ← AuthContext
  e2e/                  ← tests Playwright
    fixtures.ts         ← páginas autenticadas por rol (adminPage, ...)
    specs/              ← archivos de test por flujo
  index.html
  vite.config.ts
  tailwind.config.js
  .env.example          ← plantilla de variables de entorno
```

---

## Deploy en Vercel

```
Framework preset : Vite
Build command    : npm run build
Output directory : dist
Root directory   : frontend
```

Variables de entorno requeridas en el dashboard de Vercel:

| Variable | Descripción |
|---|---|
| `VITE_API_BASE_URL` | URL del backend en Render |
| `VITE_SUPABASE_URL` | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clave pública anon de Supabase |

Ver instrucciones completas en [`specs/arch/INFRA.md`](../specs/arch/INFRA.md).
