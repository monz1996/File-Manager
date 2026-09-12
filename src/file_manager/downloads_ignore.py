from __future__ import annotations

import json
from pathlib import Path
from typing import Any

DATA_DIRECTORY = Path(__file__).resolve().parent / "data"
DOWNLOADS_IGNORE_FILE = DATA_DIRECTORY / "downloads_ignore.json"


def load_ignored_names(ignore_file: Path = DOWNLOADS_IGNORE_FILE) -> set[str]:
    if not ignore_file.exists():
        return set()

    with ignore_file.open("r", encoding="utf-8") as file:
        data = json.load(file)

    names = data.get("ignored", [])

    return {str(name) for name in names if isinstance(name, str)}


def add_ignored_name(name: str, ignore_file: Path = DOWNLOADS_IGNORE_FILE) -> set[str]:
    names = load_ignored_names(ignore_file)
    names.add(name)
    _save_ignored_names(names, ignore_file)

    return names


def remove_ignored_name(name: str, ignore_file: Path = DOWNLOADS_IGNORE_FILE) -> set[str]:
    names = load_ignored_names(ignore_file)
    normalized = name.casefold()
    names = {existing for existing in names if existing.casefold() != normalized}
    _save_ignored_names(names, ignore_file)

    return names


def is_ignored(name: str, ignored_names: set[str]) -> bool:
    normalized = name.casefold()

    return any(normalized == ignored.casefold() for ignored in ignored_names)


def save_ignored_names(names: set[str], ignore_file: Path = DOWNLOADS_IGNORE_FILE) -> None:
    """Public wrapper to persist the ignored names set."""
    _save_ignored_names(names, ignore_file)


def _save_ignored_names(names: set[str], ignore_file: Path) -> None:
    ignore_file.parent.mkdir(exist_ok=True)

    payload: dict[str, Any] = {"ignored": sorted(names, key=str.casefold)}

    with ignore_file.open("w", encoding="utf-8") as file:
        json.dump(payload, file, indent=4, ensure_ascii=False)
