from __future__ import annotations

import re
from difflib import SequenceMatcher
from typing import Any

try:
    from .file_sort import sort_files
    from .path_visibility import is_hidden_or_system_text
except ImportError:
    from file_sort import sort_files
    from path_visibility import is_hidden_or_system_text


TOKEN_PATTERN = re.compile(r"[\w]+", re.UNICODE)


def is_excluded_local_entry(file_entry: dict[str, Any]) -> bool:
    folder = str(file_entry.get("folder", "")).casefold().replace("_", " ")
    return folder == "new folder"


def search_file_index(
    query: str,
    files: list[dict[str, Any]],
    limit: int = 20,
    sort_by: str = "match",
    descending: bool = False,
) -> list[dict]:
    query = query.strip()
    if not query:
        return []

    query_normalized = _normalize(query)
    query_tokens = _tokenize(query)
    results = []

    for file_entry in files:
        folder = file_entry.get("folder", "")
        path = file_entry.get("path", "")
        if any(
            is_hidden_or_system_text(str(value))
            for value in (file_entry.get("name", ""), folder, path)
        ):
            continue
        searchable_text = f"{file_entry.get('name', '')} {folder} {path}"
        score, matched_by = _score_match(query_normalized, query_tokens, searchable_text)

        if score <= 0:
            continue

        results.append({
            **file_entry,
            "score": round(score, 3),
            "matched_by": matched_by,
        })

    return sort_files(results, sort_by=sort_by, descending=descending)[:limit]


def _score_match(
    query_normalized: str,
    query_tokens: list[str],
    searchable_text: str,
) -> tuple[float, str]:
    text_normalized = _normalize(searchable_text)
    text_tokens = _tokenize(searchable_text)

    if query_normalized == text_normalized:
        return 100.0, "exact"

    if query_normalized in text_normalized:
        return 85.0 + min(len(query_normalized) / max(len(text_normalized), 1), 0.1), "substring"

    token_score = _token_score(query_tokens, text_tokens)
    fuzzy_score = SequenceMatcher(None, query_normalized, text_normalized).ratio() * 70
    score = max(token_score, fuzzy_score)

    if score >= 45:
        return score, "token" if token_score >= fuzzy_score else "fuzzy"

    return 0.0, "none"


def _token_score(query_tokens: list[str], text_tokens: list[str]) -> float:
    if not query_tokens or not text_tokens:
        return 0.0

    best_scores = []

    for query_token in query_tokens:
        exact_match = query_token in text_tokens
        partial_match = any(query_token in text_token for text_token in text_tokens)
        fuzzy_match = max(
            SequenceMatcher(None, query_token, text_token).ratio()
            for text_token in text_tokens
        )

        if exact_match:
            best_scores.append(80.0)
        elif partial_match:
            best_scores.append(68.0)
        else:
            best_scores.append(fuzzy_match * 60)

    matched_ratio = sum(best_scores) / len(query_tokens)
    coverage_bonus = 10 * (
        sum(1 for score in best_scores if score >= 60) / len(query_tokens)
    )

    return matched_ratio + coverage_bonus


def _normalize(value: str) -> str:
    return " ".join(_tokenize(value))


def _tokenize(value: str) -> list[str]:
    return TOKEN_PATTERN.findall(value.casefold())
