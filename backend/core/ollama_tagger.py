import json
import re
from urllib import request, error

from core.config import settings
from core.prompts import TAGGING_SYSTEM_PROMPT


class OllamaTagger:
    MIN_TAGS = 10
    MAX_TAGS = 14

    @classmethod
    def generate_tags(cls, content: str) -> list[str]:
        tags = cls._request_tags(prompt=content)
        if len(tags) < cls.MIN_TAGS:
            expansion_prompt = (
                f"Input: {content}\n"
                f"Current tags: {json.dumps(tags)}\n"
                f"Return ONLY a JSON array with {cls.MIN_TAGS}-{cls.MAX_TAGS} unique lowercase English tags. "
                "Keep the current tags and add new specific + broad tags."
            )
            expanded = cls._request_tags(prompt=expansion_prompt)
            tags = cls._merge_unique(tags, expanded)

        if len(tags) < cls.MIN_TAGS:
            tags = cls._merge_unique(tags, cls._fallback_general_tags(content))
            tags = tags[: cls.MAX_TAGS]

        if not tags:
            raise RuntimeError("Ollama returned no valid tags")
        return tags

    @classmethod
    def _request_tags(cls, prompt: str) -> list[str]:
        payload = {
            "model": settings.OLLAMA_TAGGER_MODEL,
            "system": TAGGING_SYSTEM_PROMPT,
            "prompt": prompt,
            "stream": False,
        }
        endpoint = f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/generate"
        body = json.dumps(payload).encode("utf-8")
        req = request.Request(
            endpoint,
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with request.urlopen(req, timeout=settings.OLLAMA_TIMEOUT_SECONDS) as response:
                response_payload = json.loads(response.read().decode("utf-8"))
        except (error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise RuntimeError(f"Ollama unavailable: {exc}") from exc

        raw_text = response_payload.get("response", "").strip()
        if not raw_text:
            raise RuntimeError("Empty response from Ollama")

        structured = cls._parse_tags_payload(raw_text)
        if not isinstance(structured, list):
            raise RuntimeError("Ollama response is not a tag list")
        return cls._sanitize_tags(structured)[: cls.MAX_TAGS]

    @classmethod
    def _parse_tags_payload(cls, raw_text: str) -> list[str]:
        # Strict JSON first.
        try:
            parsed = json.loads(raw_text)
        except json.JSONDecodeError:
            parsed = None

        # Accept {"tags": [...]} envelopes.
        if isinstance(parsed, dict) and isinstance(parsed.get("tags"), list):
            return parsed["tags"]
        if isinstance(parsed, list):
            return parsed

        # Accept pseudo-json arrays with single quotes.
        single_quote_array = re.search(r"\[[^\]]*\]", raw_text, re.DOTALL)
        if single_quote_array:
            candidate = single_quote_array.group(0).replace("'", '"')
            try:
                parsed_array = json.loads(candidate)
                if isinstance(parsed_array, list):
                    return parsed_array
            except json.JSONDecodeError:
                pass

        # Accept set-like payloads from bad examples: {'a','b'}.
        set_like = re.search(r"\{[^}]*\}", raw_text, re.DOTALL)
        if set_like:
            candidate = set_like.group(0).replace("{", "[").replace("}", "]").replace("'", '"')
            try:
                parsed_array = json.loads(candidate)
                if isinstance(parsed_array, list):
                    return parsed_array
            except json.JSONDecodeError:
                pass

        raise RuntimeError(f"Ollama returned non-parseable tags: {raw_text[:200]}")

    @classmethod
    def _sanitize_tags(cls, tags: list[str]) -> list[str]:
        cleaned: list[str] = []
        seen = set()

        for tag in tags:
            if not isinstance(tag, str):
                continue
            normalized = " ".join(tag.lower().strip().split())
            if not normalized or normalized in seen:
                continue
            seen.add(normalized)
            cleaned.append(normalized)

        return cleaned

    @classmethod
    def _merge_unique(cls, base: list[str], extra: list[str]) -> list[str]:
        merged = list(base)
        seen = set(base)
        for tag in extra:
            if tag in seen:
                continue
            seen.add(tag)
            merged.append(tag)
            if len(merged) >= cls.MAX_TAGS:
                break
        return merged

    @classmethod
    def _fallback_general_tags(cls, content: str) -> list[str]:
        lowered = content.lower()
        tags: list[str] = []
        if lowered.startswith("http://") or lowered.startswith("https://"):
            tags.extend(["website", "online", "information", "resource", "content", "topic"])
            if any(keyword in lowered for keyword in ["shop", "store", "product", "buy"]):
                tags.extend(["ecommerce", "shopping", "product", "purchase"])
            if any(keyword in lowered for keyword in ["blog", "article", "news"]):
                tags.extend(["article", "reading", "media", "publication"])
        tags.extend(["category", "concept", "context", "general", "theme", "domain", "activity", "object"])
        return cls._sanitize_tags(tags)
