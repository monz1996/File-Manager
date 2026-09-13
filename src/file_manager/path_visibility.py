from __future__ import annotations

from pathlib import Path


HIDDEN_ATTRIBUTE = 0x2
SYSTEM_ATTRIBUTE = 0x4
SYSTEM_NAMES = {
    "desktop.ini",
    "thumbs.db",
    "$recycle.bin",
    "system volume information",
}


def is_hidden_or_system(path: Path) -> bool:
    parts = [part for part in path.parts if part not in {".", ".."}]
    if any(part.startswith(".") or part.casefold() in SYSTEM_NAMES for part in parts):
        return True

    try:
        attributes = getattr(path.stat(), "st_file_attributes", 0)
    except OSError:
        attributes = 0

    return bool(attributes & (HIDDEN_ATTRIBUTE | SYSTEM_ATTRIBUTE))


def is_hidden_or_system_text(value: str) -> bool:
    parts = value.replace("\\", "/").split("/")
    return any(
        part.startswith(".") or part.casefold() in SYSTEM_NAMES
        for part in parts
        if part not in {"", ".", ".."}
    )
