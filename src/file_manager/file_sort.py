from __future__ import annotations

from typing import Any


SORT_OPTIONS = {"name", "created", "folder", "match"}


def sort_files(
    files: list[dict[str, Any]],
    sort_by: str = "name",
    descending: bool = False,
) -> list[dict[str, Any]]:
    if sort_by not in SORT_OPTIONS:
        expected = ", ".join(sorted(SORT_OPTIONS))
        raise ValueError(f"Unsupported sort option '{sort_by}'. Expected one of: {expected}.")

    if sort_by == "match":
        return sorted(files, key=_match_key)
    elif sort_by == "created":
        key = _created_key
    elif sort_by == "folder":
        key = _folder_key
    else:
        key = _name_key

    return sorted(files, key=key, reverse=descending)


def _name_key(file_entry: dict[str, Any]) -> tuple[str, str]:
    return (
        str(file_entry.get("name") or _path_name(file_entry)).casefold(),
        str(file_entry.get("path", "")).casefold(),
    )


def _created_key(file_entry: dict[str, Any]) -> tuple[float, str]:
    return (
        float(file_entry.get("created_timestamp") or 0),
        str(file_entry.get("path", "")).casefold(),
    )


def _folder_key(file_entry: dict[str, Any]) -> tuple[str, str, str]:
    return (
        str(file_entry.get("folder", "")).casefold(),
        str(file_entry.get("name") or _path_name(file_entry)).casefold(),
        str(file_entry.get("path", "")).casefold(),
    )


def _match_key(file_entry: dict[str, Any]) -> tuple[float, str, str]:
    return (
        -float(file_entry.get("score") or 0),
        str(file_entry.get("folder", "")).casefold(),
        str(file_entry.get("path", "")).casefold(),
    )


def _path_name(file_entry: dict[str, Any]) -> str:
    return str(file_entry.get("path", "")).replace("\\", "/").rsplit("/", 1)[-1]
