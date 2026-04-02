FROM python:3.11.9-slim

WORKDIR /app

# Instalar dependencias primero (capa cacheada si no cambia requirements)
COPY requirements-prod.txt .
RUN pip install --no-cache-dir -r requirements-prod.txt

# Copiar código de la aplicación
COPY . .

# Render inyecta $PORT en runtime
CMD uvicorn app.main:app --host 0.0.0.0 --port $PORT
