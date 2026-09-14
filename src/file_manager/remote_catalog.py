from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path

try:
    from .path_visibility import is_hidden_or_system
except ImportError:
    from path_visibility import is_hidden_or_system


DEFAULT_SOURCE_PATHS = {
    "anime": "Anime",
    "games": "Games",
    "movies": "Movies",
    "series": "series",
}


def build_remote_catalog(
    drive_path: Path,
    remote_folders: dict[str, Path],
    local_folders: dict[str, Path],
    existing_to_be_downloaded: dict[str, list[str]] | None = None,
) -> dict:
    root_path = _common_root(remote_folders)
    drive_available = drive_path.exists()
    root_available = root_path is not None and root_path.exists()

    catalog = {
        "generated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "drive": str(drive_path),
        "drive_imported": drive_available,
        "root_path": str(root_path) if root_path is not None else None,
        "root_available": root_available,
        "names": _empty_sections(),
        "to_be_downloaded": _to_be_downloaded(existing_to_be_downloaded),
        "to_be_downloaded_mode": "manual",
        "categories": {"movies": []},
        "movie_categories": {},
        "sources": {},
    }

    if not drive_available or not root_available or root_path is None:
        return catalog

    for section, default_relative_path in DEFAULT_SOURCE_PATHS.items():
        remote_path = _section_path(section, default_relative_path, remote_folders, root_path)
        local_path = _local_section_path(section, default_relative_path, local_folders)
        remote_names = _collect_section_names(section, remote_path)
        local_names = _collect_section_names(section, local_path)

        catalog["names"][section] = remote_names
        if section == "movies":
            movie_categories = {
                name: _movie_category(name)
                for name in remote_names
            }
            catalog["movie_categories"] = movie_categories
            catalog["categories"]["movies"] = sorted(
                set(movie_categories.values()),
                key=str.casefold,
            )
        catalog["sources"][section] = {
            "remote_path": str(remote_path),
            "remote_available": remote_path.exists(),
            "local_path": str(local_path) if local_path is not None else None,
            "local_available": local_path.exists() if local_path is not None else False,
            "remote_count": len(remote_names),
            "local_count": len(local_names),
            "to_be_downloaded_count": len(catalog["to_be_downloaded"].get(section, [])),
        }

    return catalog


def _collect_section_names(section: str, path: Path | None) -> list[str]:
    if path is None or not path.exists():
        return []

    if section in {"anime", "series"}:
        return _top_level_directory_names(path)

    if section == "games":
        return _top_level_file_and_folder_names(path)

    if section == "movies":
        return _recursive_file_names(path)

    return []


def _top_level_directory_names(path: Path) -> list[str]:
    return sorted(
        {item.name for item in path.iterdir() if item.is_dir() and not is_hidden_or_system(item)},
        key=str.casefold,
    )


def _top_level_file_and_folder_names(path: Path) -> list[str]:
    return sorted(
        {
            item.name
            for item in path.iterdir()
            if (item.is_file() or item.is_dir()) and not is_hidden_or_system(item)
        },
        key=str.casefold,
    )


def _recursive_file_names(path: Path) -> list[str]:
    return sorted(
        {
            item.relative_to(path).as_posix()
            for item in path.rglob("*")
            if item.is_file() and not is_hidden_or_system(item)
        },
        key=str.casefold,
    )


def _movie_category(relative_path: str) -> str:
    parts = Path(relative_path).parts
    return " / ".join(parts[:-1]) if len(parts) > 1 else "Uncategorized"


def _section_path(
    section: str,
    default_relative_path: str,
    folders: dict[str, Path],
    root_path: Path,
) -> Path:
    return folders.get(section, root_path / default_relative_path)


def _local_section_path(
    section: str,
    default_relative_path: str,
    local_folders: dict[str, Path],
) -> Path | None:
    if section in local_folders:
        return local_folders[section]

    root_path = _common_root(local_folders)
    if root_path is None:
        return None

    return root_path / default_relative_path


def _common_root(folders: dict[str, Path]) -> Path | None:
    if not folders:
        return None

    return Path(os.path.commonpath([str(path) for path in folders.values()]))


def _empty_sections() -> dict[str, list[str]]:
    return {
        "anime": [],
        "games": [],
        "movies": [],
        "series": [],
    }


def _to_be_downloaded(existing: dict[str, list[str]] | None) -> dict[str, list[str]]:
    sections = _empty_sections()

    if existing is None:
        return sections
    for section in sections:
        section_items = existing.get(section, [])
        sections[section] = [
            item for item in section_items
            if isinstance(item, str) and item.strip()
        ]

    return sections
