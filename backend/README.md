# Backend

## Run API

```bash
cd backend
uv run uvicorn main:app --reload
```

## Ollama en Docker (tags con LLM)

El proyecto usa un modelo ligero personalizado para generar tags.

### 1) Levantar contenedor Ollama

```bash
cd ollama
docker compose up -d ollama
```

### 2) Inicializar modelo personalizado en contenedor

```bash
cd ollama
docker compose run --rm ollama-init
```

Esto descarga `llama3.2` y crea `brainch-model`.

### 3) Arranque/parada manual

```bash
cd ollama
docker compose up -d ollama
docker compose down
```

Ollama queda expuesto en red en `0.0.0.0:11434` (puerto publicado `11434`).

### 4) Config del backend

En `backend/.env`:

```env
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_TAGGER_MODEL=brainch-model
OLLAMA_TIMEOUT_SECONDS=8
```

Si Ollama no está disponible, el backend hace fallback a tags heurísticos.
