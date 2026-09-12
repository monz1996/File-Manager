from __future__ import annotations

import re
from datetime import datetime
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

try:
    from .downloads_ignore import is_ignored
except ImportError:
    from downloads_ignore import is_ignored


VIDEO_EXTENSIONS = {
    ".3gp", ".avi", ".flv", ".m4v", ".mkv", ".mov", ".mp4",
    ".mpeg", ".mpg", ".webm", ".wmv",
}
BOOK_EXTENSIONS = {".pdf", ".epub", ".mobi", ".azw", ".azw3", ".djvu", ".txt", ".doc", ".docx"}
MUSIC_EXTENSIONS = {".mp3", ".flac", ".wav", ".aac", ".ogg", ".m4a", ".wma"}
PICTURE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".heic", ".tiff"}
ARCHIVE_EXTENSIONS = {".zip", ".rar", ".7z", ".tar", ".gz"}

# Release-scene junk commonly found in downloaded movie/show folder or file names.
RELEASE_TAG_PATTERN = re.compile(
    r"\b("
    r"1080p|720p|480p|2160p|4k|hdr|webrip|web-dl|webdl|bluray|blu-ray|brrip|dvdrip|hdtv|"
    r"x264|x265|h264|h265|hevc|aac|ac3|dd5\.1|dts|"
    r"repack|proper|extended|remastered|multi|dubbed|subbed"
    r")\b",
    re.IGNORECASE,
)
GROUP_TAG_PATTERN = re.compile(r"[\[\(][A-Za-z0-9]{2,15}[\]\)]\s*$")
YEAR_PATTERN = re.compile(r"\((19|20)\d{2}\)|\b(19|20)\d{2}\b")
TRAILING_COUNTER_PATTERN = re.compile(r"\s*[\(\[]\d+[\)\]]\s*$")
SEPARATOR_PATTERN = re.compile(r"[._]+")
MULTI_SPACE_PATTERN = re.compile(r"\s{2,}")
MULTI_DASH_PATTERN = re.compile(r"-{2,}")

FALLBACK_PACKAGE = "New folder"

DEFAULT_EXTENSION_PACKAGE_HINTS = {
    **{ext: "videos" for ext in VIDEO_EXTENSIONS},
    **{ext: "books" for ext in BOOK_EXTENSIONS},
    **{ext: "Music" for ext in MUSIC_EXTENSIONS},
    **{ext: "pictures" for ext in PICTURE_EXTENSIONS},
}


def build_downloads_plan(
    downloads_root: Path,
    old_but_gold_root: Path,
    ignored_names: set[str] | None = None,
) -> dict[str, Any]:
    ignored_names = ignored_names or set()

    result: dict[str, Any] = {
        "generated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "downloads_root": str(downloads_root),
        "old_but_gold_root": str(old_but_gold_root),
        "downloads_available": downloads_root.exists(),
        "old_but_gold_available": old_but_gold_root.exists(),
        "entry_count": 0,
        "ignored_count": 0,
        "entries": [],
        "ignored": [],
    }

    if not result["downloads_available"]:
        return result

    package_names = _existing_package_names(old_but_gold_root)

    entries = sorted(
        (item for item in downloads_root.iterdir() if item.name != "desktop.ini"),
        key=lambda item: item.name.casefold(),
    )

    for entry in entries:
        if is_ignored(entry.name, ignored_names):
            result["ignored"].append(entry.name)
            continue

        result["entries"].append(_build_entry_plan(entry, package_names, old_but_gold_root))

    result["entry_count"] = len(result["entries"])
    result["ignored_count"] = len(result["ignored"])

    return result


def recommend_name_and_package(
    name: str,
    is_dir: bool,
    package_names: list[str],
) -> tuple[str, str, str]:
    """Return (recommended_package, recommended_name, reason)."""
    cleaned_name, was_changed = _clean_name(name)
    package, reason = _recommend_package(name, is_dir, package_names)

    if was_changed:
        reason = f"{reason}; cleaned up release/formatting junk in the name"

    return package, cleaned_name, reason


def _build_entry_plan(
    entry: Path,
    package_names: list[str],
    old_but_gold_root: Path,
) -> dict[str, Any]:
    is_dir = entry.is_dir()
    package, recommended_name, reason = recommend_name_and_package(
        entry.name, is_dir, package_names,
    )
    recommended_relative_path = f"{package}/{recommended_name}"
    destination = old_but_gold_root / package / recommended_name

    return {
        "source_name": entry.name,
        "source_path": str(entry),
        "is_directory": is_dir,
        "size_bytes": _entry_size(entry),
        "recommended_package": package,
        "recommended_name": recommended_name,
        "recommended_relative_path": recommended_relative_path,
        "destination_path": str(destination),
        "destination_exists": destination.exists(),
        "name_changed": recommended_name != entry.name,
        "reason": reason,
    }


def _entry_size(entry: Path) -> int:
    if entry.is_file():
        return entry.stat().st_size

    return sum(path.stat().st_size for path in entry.rglob("*") if path.is_file())


def _existing_package_names(old_but_gold_root: Path) -> list[str]:
    if not old_but_gold_root.exists():
        return []

    return sorted(
        (item.name for item in old_but_gold_root.iterdir() if item.is_dir()),
        key=str.casefold,
    )


def _recommend_package(
    name: str,
    is_dir: bool,
    package_names: list[str],
) -> tuple[str, str]:
    extension = Path(name).suffix.casefold()

    best_match, best_score = _best_package_match(name, package_names)
    if best_score >= 0.6:
        return best_match, f"name closely matches existing package '{best_match}'"

    if not is_dir and extension in DEFAULT_EXTENSION_PACKAGE_HINTS:
        hinted = DEFAULT_EXTENSION_PACKAGE_HINTS[extension]
        matched = _closest_existing(hinted, package_names)
        return matched, f"file extension '{extension}' typically belongs in '{matched}'"

    if is_dir and _looks_like_movie_or_show(name):
        matched = _closest_existing("videos", package_names)
        return matched, f"folder name looks like a movie/show release, suited for '{matched}'"

    if not is_dir and extension in ARCHIVE_EXTENSIONS:
        return FALLBACK_PACKAGE, "archive file with no confident package match, review manually"

    return FALLBACK_PACKAGE, "no confident package match found, review manually"


def _closest_existing(preferred: str, package_names: list[str]) -> str:
    for candidate in package_names:
        if candidate.casefold() == preferred.casefold():
            return candidate

    return preferred


def _best_package_match(name: str, package_names: list[str]) -> tuple[str, float]:
    if not package_names:
        return FALLBACK_PACKAGE, 0.0

    normalized_name = _normalize_for_matching(name)
    best_match = FALLBACK_PACKAGE
    best_score = 0.0

    for package_name in package_names:
        normalized_package = _normalize_for_matching(package_name)
        score = SequenceMatcher(None, normalized_name, normalized_package).ratio()

        if normalized_package and normalized_package in normalized_name:
            score = max(score, 0.75)

        if score > best_score:
            best_score = score
            best_match = package_name

    return best_match, best_score


def _normalize_for_matching(value: str) -> str:
    value = SEPARATOR_PATTERN.sub(" ", value)
    value = re.sub(r"[^\w\s]", " ", value, flags=re.UNICODE)

    return " ".join(value.casefold().split())


def _looks_like_movie_or_show(name: str) -> bool:
    return bool(YEAR_PATTERN.search(name)) or bool(RELEASE_TAG_PATTERN.search(name))


def _clean_name(name: str) -> tuple[str, bool]:
    original = name
    stem = Path(name).stem
    suffix = Path(name).suffix

    cleaned = SEPARATOR_PATTERN.sub(" ", stem)
    cleaned = GROUP_TAG_PATTERN.sub("", cleaned)
    cleaned = RELEASE_TAG_PATTERN.sub(" ", cleaned)
    cleaned = TRAILING_COUNTER_PATTERN.sub("", cleaned)
    cleaned = MULTI_DASH_PATTERN.sub("-", cleaned)
    cleaned = MULTI_SPACE_PATTERN.sub(" ", cleaned)
    cleaned = cleaned.strip(" .-_")

    if not cleaned:
        cleaned = stem.strip()

    cleaned_name = f"{cleaned}{suffix}"

    return cleaned_name, cleaned_name != original
