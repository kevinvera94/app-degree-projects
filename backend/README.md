# Backend — FastAPI

API REST del sistema de gestión de trabajos de grado USC.

> Stack, principios y variables de entorno: [`specs/arch/INFRA.md`](../specs/arch/INFRA.md)
> Contrato de endpoints: [`specs/arch/API.md`](../specs/arch/API.md)

---

## Setup

```bash
# Desde la raíz del repositorio
cd backend

python3 -m venv .venv
source .venv/bin/activate      # Linux / macOS
# .venv\Scripts\activate       # Windows

pip install -r requirements.txt

cp .env.example .env
# Completar .env con los valores reales del proyecto Supabase
```

---

## Comandos de desarrollo

```bash
# Levantar servidor con hot-reload
uvicorn app.main:app --reload
# → http://localhost:8000
# → Swagger UI: http://localhost:8000/docs
# → Health check: http://localhost:8000/health

# Verificar estilo de código
flake8 app/

# Formatear código
black app/
```

---

## Tests

```bash
# Correr toda la suite
pytest

# Con reporte de cobertura en terminal
pytest --cov=app

# Con reporte HTML (se genera en htmlcov/)
pytest --cov=app --cov-report=html

# Correr un archivo específico
pytest tests/test_ideas.py -v

# Correr un test específico
pytest tests/test_ideas.py::test_create_project -v
```

Cobertura objetivo: ≥ 70% en servicios de negocio críticos.

---

## Estructura

```
backend/
  app/
    main.py             ← instancia FastAPI, routers, CORS, health check
    core/
      config.py         ← variables de entorno (pydantic-settings)
      security.py       ← validación JWT
      dependencies.py   ← get_current_user, require_admin, require_project_member
      database.py       ← engine asyncpg, sesión async
    routers/            ← un archivo por recurso (auth, users, projects, ...)
    schemas/            ← Pydantic schemas (request / response)
    services/           ← lógica de negocio desacoplada de los routers
    models/             ← SQLAlchemy ORM models
    utils/
      date_utils.py     ← cálculo de días hábiles (excluye festivos USC)
      file_utils.py     ← interacción con Supabase Storage
    data/
      usc_holidays.json ← festivos del calendario académico USC
  tests/                ← suite pytest (conftest.py + test_*.py)
  requirements.txt      ← dependencias dev + prod
  requirements-prod.txt ← dependencias solo para producción (sin dev tools)
  Dockerfile            ← imagen para deploy en contenedor
  render.yaml           ← configuración declarativa de Render (en raíz del repo)
  .env.example          ← plantilla de variables de entorno
```

---

## Deploy en Render

El deploy se configura con `render.yaml` en la raíz del repositorio. Ver instrucciones completas en [`specs/arch/INFRA.md`](../specs/arch/INFRA.md).

```bash
# Build command (Render)
pip install -r requirements-prod.txt

# Start command (Render)
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```
