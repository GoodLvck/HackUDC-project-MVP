import hashlib
import json
import math
from urllib import error, request

from core.config import settings


class OllamaEmbedder:
    HASH_DIM = 64

    @classmethod
    def embed_text(cls, text: str) -> list[float]:
        normalized = " ".join(text.strip().split())
        if not normalized:
            return cls._hash_embedding("")

        payload = {
            "model": settings.OLLAMA_EMBED_MODEL,
            "prompt": normalized,
        }
        endpoint = f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/embeddings"
        req = request.Request(
            endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with request.urlopen(req, timeout=settings.OLLAMA_TIMEOUT_SECONDS) as response:
                response_payload = json.loads(response.read().decode("utf-8"))
        except (error.URLError, TimeoutError, json.JSONDecodeError):
            return cls._hash_embedding(normalized)

        embedding = response_payload.get("embedding")
        if not isinstance(embedding, list) or not embedding:
            return cls._hash_embedding(normalized)

        numeric = [float(value) for value in embedding if isinstance(value, (int, float))]
        if not numeric:
            return cls._hash_embedding(normalized)

        return cls._normalize(numeric)

    @classmethod
    def _hash_embedding(cls, text: str) -> list[float]:
        vec = [0.0] * cls.HASH_DIM
        for token in text.lower().split():
            digest = hashlib.md5(token.encode("utf-8")).digest()
            bucket = digest[0] % cls.HASH_DIM
            sign = 1.0 if digest[1] % 2 == 0 else -1.0
            vec[bucket] += sign
        return cls._normalize(vec)

    @classmethod
    def _normalize(cls, vector: list[float]) -> list[float]:
        norm = math.sqrt(sum(value * value for value in vector))
        if norm == 0:
            return vector
        return [value / norm for value in vector]
