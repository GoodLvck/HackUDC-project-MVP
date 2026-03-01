import math
import re
from collections import Counter
from typing import Iterable

from sqlalchemy.orm import Session

from core.ollama_embedder import OllamaEmbedder
from core.ollama_tagger import OllamaTagger
from models.elements import Category, Message

STOPWORDS = {
    "a",
    "al",
    "algo",
    "and",
    "ante",
    "con",
    "como",
    "de",
    "del",
    "desde",
    "el",
    "ella",
    "en",
    "entre",
    "es",
    "esta",
    "este",
    "esto",
    "for",
    "fue",
    "ha",
    "he",
    "i",
    "in",
    "la",
    "las",
    "le",
    "les",
    "lo",
    "los",
    "me",
    "mi",
    "mis",
    "my",
    "no",
    "o",
    "of",
    "para",
    "pero",
    "por",
    "que",
    "se",
    "si",
    "sin",
    "so",
    "su",
    "sus",
    "te",
    "the",
    "to",
    "tu",
    "un",
    "una",
    "uno",
    "y",
    "yo",
}

WORD_RE = re.compile(r"[a-zA-Z0-9áéíóúñÁÉÍÓÚÑ]{3,}")
MAX_CHILDREN_PER_CATEGORY = 5


class Categorizer:
    ROOT_CATEGORY_NAME = "Main"

    @classmethod
    def ingest_message(
        cls,
        db: Session,
        content: str,
        forced_type: str | None = None,
        obtained_text: str | None = None,
    ) -> Message:
        message_type = forced_type or "text"
        llm_content = content if message_type == "text" else (obtained_text or content)
        tags = cls.generate_tags(content=llm_content)

        message = Message(content=content, tags=tags, type=message_type, category_id=None)
        db.add(message)
        db.flush()

        cls.rebuild_semantic_tree(db)

        db.commit()
        db.refresh(message)
        return message

    @classmethod
    def generate_tags(cls, content: str) -> list[str]:
        lowered = content.lower().strip()
        tags: list[str]

        try:
            tags = OllamaTagger.generate_tags(content=content)
        except RuntimeError:
            tags = cls.extract_text_tags(lowered)

        deduped: list[str] = []
        seen = set()
        for tag in tags:
            clean = tag.strip().lower()
            if not clean or clean in seen:
                continue
            seen.add(clean)
            deduped.append(clean)

        if len(deduped) < 3:
            for tag in cls.extract_text_tags(lowered):
                clean = tag.strip().lower()
                if not clean or clean in seen:
                    continue
                seen.add(clean)
                deduped.append(clean)

        return deduped or ["uncategorized"]

    @classmethod
    def extract_text_tags(cls, content: str) -> list[str]:
        words = WORD_RE.findall(content)
        filtered = [word.lower() for word in words if word.lower() not in STOPWORDS]
        if not filtered:
            return ["nota"]
        counts = Counter(filtered)
        return [word for word, _ in counts.most_common(6)]

    @classmethod
    def rebuild_semantic_tree(cls, db: Session) -> None:
        messages = db.query(Message).order_by(Message.id.asc()).all()
        if not messages:
            return

        for message in messages:
            message.category_id = None

        db.query(Category).delete(synchronize_session=False)
        db.flush()

        root_tags = cls._top_tags(messages)
        root = Category(
            name=cls.ROOT_CATEGORY_NAME,
            tags=root_tags,
            description="Root semantic category",
            parent_id=None,
        )
        db.add(root)
        db.flush()

        embeddings = {message.id: cls._message_embedding(message) for message in messages}
        cls._build_tree(db=db, parent=root, messages=messages, embeddings=embeddings, depth=0)
        cls._refresh_category_tags(db)

    @classmethod
    def _build_tree(
        cls,
        db: Session,
        parent: Category,
        messages: list[Message],
        embeddings: dict[int, list[float]],
        depth: int,
    ) -> None:
        if not messages:
            return

        if len(messages) <= MAX_CHILDREN_PER_CATEGORY:
            for message in messages:
                message.category_id = parent.id
            return

        groups = cls._partition_messages(messages=messages, embeddings=embeddings)
        for idx, group in enumerate(groups, start=1):
            subcategory = Category(
                name=cls._group_name(group, idx=idx, depth=depth),
                tags=cls._top_tags(group),
                description=cls._group_description(group),
                parent_id=parent.id,
            )
            db.add(subcategory)
            db.flush()
            cls._build_tree(
                db=db,
                parent=subcategory,
                messages=group,
                embeddings=embeddings,
                depth=depth + 1,
            )

    @classmethod
    def _partition_messages(
        cls,
        messages: list[Message],
        embeddings: dict[int, list[float]],
    ) -> list[list[Message]]:
        if len(messages) <= MAX_CHILDREN_PER_CATEGORY:
            return [[message] for message in messages]

        k = min(MAX_CHILDREN_PER_CATEGORY, max(2, math.ceil(len(messages) / MAX_CHILDREN_PER_CATEGORY)))
        vectors = [embeddings[message.id] for message in messages]

        centers = cls._initial_centers(vectors=vectors, k=k)
        assignments = [0] * len(messages)

        for _ in range(8):
            changed = False
            for index, vector in enumerate(vectors):
                best_idx = max(range(k), key=lambda center_idx: cls._cosine(vector, centers[center_idx]))
                if assignments[index] != best_idx:
                    assignments[index] = best_idx
                    changed = True
            centers = cls._recompute_centers(vectors=vectors, assignments=assignments, k=k, old_centers=centers)
            if not changed:
                break

        grouped: list[list[Message]] = [[] for _ in range(k)]
        for index, message in enumerate(messages):
            grouped[assignments[index]].append(message)

        non_empty = [group for group in grouped if group]
        if len(non_empty) <= 1:
            return cls._fallback_partition(messages=messages, embeddings=embeddings, k=k)
        return non_empty

    @classmethod
    def _fallback_partition(
        cls,
        messages: list[Message],
        embeddings: dict[int, list[float]],
        k: int,
    ) -> list[list[Message]]:
        # Unsupervised fallback: sort by similarity to the global centroid and split evenly.
        vectors = [embeddings[message.id] for message in messages]
        centroid = cls._normalize([sum(values) / len(vectors) for values in zip(*vectors, strict=False)])
        ranked = sorted(
            messages,
            key=lambda message: cls._cosine(embeddings[message.id], centroid),
            reverse=True,
        )

        chunk_size = math.ceil(len(ranked) / k)
        groups = [ranked[i : i + chunk_size] for i in range(0, len(ranked), chunk_size)]
        return [group for group in groups if group][:MAX_CHILDREN_PER_CATEGORY]

    @classmethod
    def _initial_centers(cls, vectors: list[list[float]], k: int) -> list[list[float]]:
        if k >= len(vectors):
            return [vector[:] for vector in vectors[:k]]
        step = max(1, len(vectors) // k)
        centers = [vectors[min(i * step, len(vectors) - 1)][:] for i in range(k)]
        return centers

    @classmethod
    def _recompute_centers(
        cls,
        vectors: list[list[float]],
        assignments: list[int],
        k: int,
        old_centers: list[list[float]],
    ) -> list[list[float]]:
        dim = len(vectors[0])
        sums = [[0.0] * dim for _ in range(k)]
        counts = [0] * k

        for vector, cluster_idx in zip(vectors, assignments, strict=False):
            counts[cluster_idx] += 1
            for dim_idx, value in enumerate(vector):
                sums[cluster_idx][dim_idx] += value

        centers: list[list[float]] = []
        for cluster_idx in range(k):
            if counts[cluster_idx] == 0:
                centers.append(old_centers[cluster_idx])
                continue
            center = [value / counts[cluster_idx] for value in sums[cluster_idx]]
            centers.append(cls._normalize(center))
        return centers

    @classmethod
    def _message_embedding(cls, message: Message) -> list[float]:
        tag_text = " ".join(message.tags or [])
        semantic_text = tag_text.strip() or message.content
        return OllamaEmbedder.embed_text(semantic_text)

    @classmethod
    def _top_tags(cls, messages: Iterable[Message]) -> list[str]:
        counts: Counter[str] = Counter()
        for message in messages:
            for tag in message.tags or []:
                if tag:
                    counts[tag.lower()] += 1
        if not counts:
            return ["uncategorized"]
        return [tag for tag, _ in counts.most_common(6)]

    @classmethod
    def _group_name(cls, messages: list[Message], idx: int, depth: int) -> str:
        common_tags = cls._common_tags(messages)
        if common_tags:
            if len(common_tags) == 1:
                return cls._compact_label(common_tags[0])
            return cls._compact_label(f"{common_tags[0]} {common_tags[1]}")

        top_tags = cls._top_tags(messages)
        if top_tags:
            return cls._compact_label(top_tags[0])

        return f"Group {depth + 1}-{idx}"

    @classmethod
    def _group_description(cls, messages: list[Message]) -> str:
        common_tags = cls._common_tags(messages)
        if common_tags:
            return f"Items related by: {', '.join(common_tags[:4])}"

        top_tags = cls._top_tags(messages)
        return f"Semantic cluster for: {', '.join(top_tags[:4])}"

    @classmethod
    def _common_tags(cls, messages: list[Message]) -> list[str]:
        if not messages:
            return []

        threshold = max(2, math.ceil(len(messages) * 0.6))
        counts: Counter[str] = Counter()
        for message in messages:
            unique_tags = {tag.lower() for tag in (message.tags or []) if tag}
            counts.update(unique_tags)

        common = [tag for tag, freq in counts.most_common() if freq >= threshold]
        return common[:3]

    @classmethod
    def _compact_label(cls, value: str) -> str:
        compact = " ".join(value.strip().split())
        if not compact:
            return "Group"
        titled = compact.title()
        max_len = 28
        return titled if len(titled) <= max_len else titled[:max_len].rstrip()

    @classmethod
    def _refresh_category_tags(cls, db: Session) -> None:
        categories = db.query(Category).all()
        for category in categories:
            direct_messages = db.query(Message).filter(Message.category_id == category.id).all()
            if direct_messages:
                category.tags = cls._top_tags(direct_messages)
                continue

            child_tags = Counter()
            for child in db.query(Category).filter(Category.parent_id == category.id).all():
                for tag in child.tags or []:
                    child_tags[tag] += 1
            category.tags = [tag for tag, _ in child_tags.most_common(6)] or category.tags
        db.flush()

    @classmethod
    def _cosine(cls, a: list[float], b: list[float]) -> float:
        if not a or not b or len(a) != len(b):
            return -1.0
        return sum(x * y for x, y in zip(a, b, strict=False))

    @classmethod
    def _normalize(cls, vector: list[float]) -> list[float]:
        norm = math.sqrt(sum(value * value for value in vector))
        if norm == 0:
            return vector
        return [value / norm for value in vector]
