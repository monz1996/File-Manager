from __future__ import annotations

import re
import struct
from datetime import datetime
from pathlib import Path
from typing import Any

try:
    from .downloads_ignore import is_ignored
    from .path_visibility import is_hidden_or_system
    from .video_metadata import _get_video_duration_seconds
except ImportError:
    from downloads_ignore import is_ignored
    from path_visibility import is_hidden_or_system
    from video_metadata import _get_video_duration_seconds


VIDEO_EXTENSIONS = {
    ".3gp", ".avi", ".flv", ".m4v", ".mkv", ".mov", ".mp4",
    ".mpeg", ".mpg", ".m2ts", ".ogv", ".ts", ".vob", ".webm", ".wmv",
}
BOOK_EXTENSIONS = {".pdf", ".epub", ".mobi", ".azw", ".azw3", ".djvu", ".txt", ".doc", ".docx"}
MUSIC_EXTENSIONS = {".mp3", ".flac", ".wav", ".aac", ".ogg", ".m4a", ".wma"}
PICTURE_EXTENSIONS = {
    ".avif", ".bmp", ".gif", ".heic", ".ico", ".jfif", ".jpeg", ".jpg",
    ".jxl", ".png", ".psd", ".raw", ".svg", ".tga", ".tiff", ".webp",
}
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
SOURCE_TAG_PATTERN = re.compile(
    r"\b(?:ytdown|y2mate)(?:\s*[\._-]?\s*com)?\b|\b(?:youtube|media)\b",
    re.IGNORECASE,
)
GROUP_TAG_PATTERN = re.compile(r"[\[\(][A-Za-z0-9]{2,15}[\]\)]\s*$")
YEAR_PATTERN = re.compile(r"\((19|20)\d{2}\)|\b(19|20)\d{2}\b")
TRAILING_COUNTER_PATTERN = re.compile(r"\s*[\(\[]\d+[\)\]]\s*$")
SEPARATOR_PATTERN = re.compile(r"[._-]+")
MULTI_SPACE_PATTERN = re.compile(r"\s{2,}")

FALLBACK_PACKAGE = "New folder"

DEFAULT_EXTENSION_PACKAGE_HINTS = {
    **{ext: "videos" for ext in VIDEO_EXTENSIONS},
    **{ext: "books" for ext in BOOK_EXTENSIONS},
    **{ext: "Music" for ext in MUSIC_EXTENSIONS},
    **{ext: "pictures" for ext in PICTURE_EXTENSIONS},
}

GENERIC_PACKAGE_NAMES = {
    "game", "games", "movie", "movies", "series", "anime", "cartoon",
    "english", "arabic", "compilation", "compilations", "stickman",
    "cinematic", "cinematics", "song", "songs", "music", "phone",
    "long", "video", "videos",
}

ARABIC_PATTERN = re.compile(r"[\u0600-\u06ff]")
RECORDING_PATTERN = re.compile(r"\brecord(?:ing|ings|ed)?\b", re.IGNORECASE)
SPANKBANG_PATTERN = re.compile(r"\bspankbang\b", re.IGNORECASE)


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
        (item for item in downloads_root.iterdir() if not is_hidden_or_system(item)),
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
    package, reason = _recommend_package(
        entry.name, is_dir, package_names, source_path=entry,
    )
    cleaned_name, was_changed = clean_download_name(entry.name)
    recommended_name = cleaned_name
    if was_changed:
        reason = f"{reason}; cleaned up release/formatting junk in the name"
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
        (
            item.relative_to(old_but_gold_root).as_posix()
            for item in old_but_gold_root.rglob("*")
            if item.is_dir()
        ),
        key=str.casefold,
    )


def _recommend_package(
    name: str,
    is_dir: bool,
    package_names: list[str],
    source_path: Path | None = None,
) -> tuple[str, str]:
    extension = Path(name).suffix.casefold()

    if SPANKBANG_PATTERN.search(name):
        package = _closest_existing("New folder/testdisk-7.1-WIP/recup_dir.2", package_names)
        return package, "name contains 'SpankBang', routed to the recovery folder"

    if not is_dir and extension in PICTURE_EXTENSIONS:
        package = _closest_existing("pictures", package_names)
        return package, "image file routed to pictures"

    if RECORDING_PATTERN.search(name):
        package = _closest_existing("Recordings", package_names)
        return package, "recording routed to Recordings"

    matched_package = _match_package_by_name(name, package_names, extension)
    if matched_package:
        return matched_package, f"name matches existing package '{matched_package}'"

    if not is_dir and extension in VIDEO_EXTENSIONS:
        duration = _video_duration(source_path)
        language = _media_language(name)
        if duration is not None and duration < 4 * 60:
            package = f"Songs/{language}" if language else "Songs"
            return _closest_existing(package, package_names), "short video routed to Songs by filename language"
        if duration is not None and 4 * 60 < duration < 9 * 60:
            package = f"videos/{language}" if language else "videos"
            return _closest_existing(package, package_names), "medium-length video routed to videos by filename language"
        if duration is not None and duration > 9 * 60:
            package = _closest_existing("videos/long videos", package_names)
            return package, "long video routed to long videos"

    if not is_dir and extension == ".pdf":
        package = _closest_existing("books", package_names)
        return package, "PDF file routed to books"

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


def _match_package_by_name(
    name: str,
    package_names: list[str],
    extension: str,
) -> str | None:
    normalized_name = _normalize_for_matching(Path(name).stem)
    compact_name = normalized_name.replace(" ", "")
    candidates: list[tuple[int, int, str]] = []

    for package_name in package_names:
        package_leaf = Path(package_name).name
        package_tokens = [
            token for token in _normalize_for_matching(package_leaf).split()
            if token not in GENERIC_PACKAGE_NAMES
        ]
        normalized_package = " ".join(package_tokens)
        compact_package = normalized_package.replace(" ", "")
        if len(compact_package) < 4 or not normalized_package:
            continue

        if normalized_package not in normalized_name and compact_package not in compact_name:
            continue

        category_rank = _package_category_rank(package_name, extension)
        candidates.append((category_rank, len(compact_package), package_name))

    if not candidates:
        return None

    candidates.sort(key=lambda candidate: (-candidate[0], -candidate[1], candidate[2].casefold()))
    return candidates[0][2]


def _package_category_rank(package_name: str, extension: str) -> int:
    root = package_name.split("/", 1)[0].casefold()
    if extension in VIDEO_EXTENSIONS and root == "videos":
        return 3
    if extension in MUSIC_EXTENSIONS and root in {"songs", "music"}:
        return 3
    if extension in PICTURE_EXTENSIONS and root == "pictures":
        return 3
    if extension in BOOK_EXTENSIONS and root == "books":
        return 3
    return 1


def _video_duration(source_path: Path | None) -> float | None:
    if source_path is None:
        return None
    try:
        return _get_video_duration_seconds(source_path)
    except (OSError, ValueError, ZeroDivisionError, struct.error):
        return None


def _media_language(name: str) -> str | None:
    if ARABIC_PATTERN.search(name):
        return "Arabic"

    letters = [character for character in Path(name).stem if character.isalpha()]
    if letters and all("A" <= character <= "Z" or "a" <= character <= "z" for character in letters):
        return "English"
    return None


def _normalize_for_matching(value: str) -> str:
    value = SEPARATOR_PATTERN.sub(" ", value)
    value = re.sub(r"[^\w\s]", " ", value, flags=re.UNICODE)

    return " ".join(value.casefold().split())


def _looks_like_movie_or_show(name: str) -> bool:
    return bool(YEAR_PATTERN.search(name)) or bool(RELEASE_TAG_PATTERN.search(name))


def clean_download_name(name: str) -> tuple[str, bool]:
    original = name
    stem = Path(name).stem
    suffix = Path(name).suffix

    cleaned = SEPARATOR_PATTERN.sub(" ", stem)
    cleaned = SOURCE_TAG_PATTERN.sub(" ", cleaned)
    cleaned = GROUP_TAG_PATTERN.sub("", cleaned)
    cleaned = RELEASE_TAG_PATTERN.sub(" ", cleaned)
    cleaned = TRAILING_COUNTER_PATTERN.sub("", cleaned)
    cleaned = MULTI_SPACE_PATTERN.sub(" ", cleaned)
    cleaned = cleaned.strip(" .-_")

    if not cleaned:
        cleaned = stem.strip()

    cleaned_name = f"{cleaned}{suffix}"

    return cleaned_name, cleaned_name != original


_clean_name = clean_download_name
