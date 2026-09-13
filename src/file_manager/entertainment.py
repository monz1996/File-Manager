from __future__ import annotations

import mimetypes
import json
import secrets
from datetime import datetime
from pathlib import Path
from typing import Any

from .config import load_config, load_root_path
from .file_store import FILE_INDEX, VIDEO_METADATA, load_file_index
from .path_visibility import is_hidden_or_system
from .search import normalize_search_text, score_search_match


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".tif", ".tiff", ".heic", ".jfif"}
VIDEO_EXTENSIONS = {".3gp", ".avi", ".flv", ".m4v", ".mkv", ".mov", ".mp4", ".mpeg", ".mpg", ".webm", ".wmv", ".ts", ".m2ts"}
AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg", ".opus", ".wma"}


def media_kind(path: Path) -> str:
    extension = path.suffix.casefold()
    if extension in IMAGE_EXTENSIONS:
        return "image"
    if extension in VIDEO_EXTENSIONS:
        return "video"
    if extension in AUDIO_EXTENSIONS:
        return "audio"
    return "file"


def scan_entertainment(root: Path, query: str = "", sort_by: str = "recommended", descending: bool = False, limit: int = 100) -> list[dict[str, Any]]:
    if not root.exists() or not root.is_dir():
        return []

    excluded_root = (root / "New folder").resolve()
    now = datetime.now().timestamp()
    query_normalized = normalize_search_text(query)
    query_tokens = query_normalized.split()
    known_durations = _load_known_durations(root)
    random_source = secrets.SystemRandom()
    entries: list[dict[str, Any]] = []

    for path in _iter_entertainment_paths(root):
        if not path.is_file() or is_hidden_or_system(path):
            continue
        try:
            resolved = path.resolve()
            if resolved == excluded_root or excluded_root in resolved.parents:
                continue
            stat = path.stat()
        except OSError:
            continue

        kind = media_kind(path)
        relative_path = path.relative_to(root)
        length_seconds = known_durations.get(str(relative_path).casefold(), 0)
        searchable = f"{path.name} {relative_path}"
        match_score, _ = score_search_match(query_normalized, query_tokens, searchable) if query_tokens else (0.0, "none")
        if query_tokens and match_score <= 0:
            continue

        age_days = max(0.0, (now - stat.st_ctime) / 86400)
        # Every recommendation request gets a new novelty signal, while search
        # relevance and freshness still keep results useful.
        novelty = random_source.uniform(0.0, 100.0 if not query_tokens else 35.0)
        recommendation = (
            match_score * 2
            + max(0.0, 20.0 - min(age_days, 20.0))
            + {"video": 3, "image": 2, "audio": 1}.get(kind, 0)
            + novelty
        )
        entries.append({
            "name": path.name,
            "path": str(resolved),
            "relative_path": str(relative_path),
            "extension": path.suffix.casefold(),
            "kind": kind,
            "mime_type": mimetypes.guess_type(path.name)[0] or "application/octet-stream",
            "size_bytes": stat.st_size,
            "created_at": datetime.fromtimestamp(stat.st_ctime).astimezone().isoformat(timespec="seconds"),
            "created_timestamp": stat.st_ctime,
            "modified_at": datetime.fromtimestamp(stat.st_mtime).astimezone().isoformat(timespec="seconds"),
            "modified_timestamp": stat.st_mtime,
            "length_seconds": length_seconds,
            "match_score": round(match_score, 3),
            "recommendation_score": round(recommendation, 3),
            "novelty_score": round(novelty, 3),
        })

    entries.sort(key=lambda entry: _sort_key(entry, sort_by), reverse=descending)
    return entries[: max(1, min(limit, 500))]


def _iter_entertainment_paths(root: Path):
    """Use the existing index to avoid blocking the API on a full disk walk."""
    if FILE_INDEX.exists():
        try:
            folders = load_config()
            folder_map = {name.casefold(): path for name, path in folders.items()}
            indexed_paths = []
            for entry in load_file_index():
                folder_name = str(entry.get("folder", "")).casefold()
                if folder_name == "new_folder":
                    continue
                folder = folder_map.get(folder_name)
                relative_path = entry.get("path") or entry.get("name")
                if folder is not None and relative_path:
                    indexed_paths.append(folder / str(relative_path))
            if indexed_paths:
                yield from indexed_paths
                return
        except (OSError, ValueError, KeyError):
            pass

    if root == load_root_path():
        yield from (path for path in root.rglob("*") if path.is_file())


def _load_known_durations(root: Path) -> dict[str, float]:
    """Reuse the existing video metadata registry when it has duration data."""
    if not VIDEO_METADATA.exists():
        return {}
    try:
        with VIDEO_METADATA.open("r", encoding="utf-8") as file:
            data = json.load(file)
    except (OSError, ValueError):
        return {}

    durations: dict[str, float] = {}
    video_root = root / "videos"
    for package in data.get("packages", []):
        for video in package.get("videos", []):
            relative = video.get("path")
            duration = video.get("duration_seconds")
            if relative and isinstance(duration, (int, float)):
                durations[str(video_root.joinpath(relative).relative_to(root)).casefold()] = float(duration)
    return durations


def _sort_key(entry: dict[str, Any], sort_by: str) -> Any:
    if sort_by == "name":
        return str(entry["name"]).casefold()
    if sort_by in {"date", "created", "date_added"}:
        return entry["created_timestamp"]
    if sort_by == "modified":
        return entry["modified_timestamp"]
    if sort_by == "size":
        return entry["size_bytes"]
    if sort_by in {"length", "duration"}:
        return entry["length_seconds"]
    if sort_by == "type":
        return (entry["kind"], str(entry["name"]).casefold())
    return entry["recommendation_score"]


def is_safe_entertainment_path(root: Path, target: Path) -> bool:
    try:
        resolved_root = root.resolve()
        resolved_target = target.resolve()
        excluded_root = (resolved_root / "New folder").resolve()
        return resolved_target.is_relative_to(resolved_root) and not resolved_target.is_relative_to(excluded_root)
    except (OSError, ValueError):
        return False


def preview_path(root: Path, requested_path: str) -> Path:
    target = Path(requested_path)
    if not is_safe_entertainment_path(root, target) or not target.is_file():
        raise FileNotFoundError(requested_path)
    return target.resolve()
