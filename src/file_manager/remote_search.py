from __future__ import annotations

from typing import Any

try:
    from .search import search_file_index
except ImportError:
    from search import search_file_index


REMOTE_SECTIONS = {"all", "anime", "games", "movies", "series"}
REMOTE_SOURCES = {"all", "names", "to_be_downloaded"}


def search_remote_catalog(
    query: str,
    catalog: dict[str, Any],
    section: str = "all",
    source: str = "all",
    category: str = "all",
    limit: int = 20,
) -> list[dict[str, Any]]:
    if section not in REMOTE_SECTIONS:
        expected = ", ".join(sorted(REMOTE_SECTIONS))
        raise ValueError(f"Unsupported section '{section}'. Expected one of: {expected}.")

    if source not in REMOTE_SOURCES:
        expected = ", ".join(sorted(REMOTE_SOURCES))
        raise ValueError(f"Unsupported source '{source}'. Expected one of: {expected}.")
    if category.strip() == "":
        category = "all"

    entries = _catalog_search_entries(catalog, section=section, source=source, category=category)

    return search_file_index(query, entries, limit=limit, sort_by="match")


def _catalog_search_entries(
    catalog: dict[str, Any],
    section: str,
    source: str,
    category: str,
) -> list[dict[str, Any]]:
    selected_sections = _selected_sections(catalog, section)
    entries = []

    for section_name in selected_sections:
        downloaded_lookup = {
            _normalize_name(name)
            for name in catalog.get("to_be_downloaded", {}).get(section_name, [])
        }
        names_lookup = {
            _normalize_name(name)
            for name in catalog.get("names", {}).get(section_name, [])
        }

        if source == "to_be_downloaded":
            names = catalog.get("to_be_downloaded", {}).get(section_name, [])
        elif source == "names":
            names = catalog.get("names", {}).get(section_name, [])
        else:
            names = _merge_names(
                catalog.get("names", {}).get(section_name, []),
                catalog.get("to_be_downloaded", {}).get(section_name, []),
            )

        for name in names:
            movie_category = _movie_category(catalog, section_name, name)
            if category != "all" and section_name == "movies" and movie_category.casefold() != category.casefold():
                continue
            normalized = _normalize_name(name)
            is_to_be_downloaded = normalized in downloaded_lookup
            in_names = normalized in names_lookup

            if source in {"names", "to_be_downloaded"}:
                entry_source = source
            else:
                entry_source = "names" if in_names else "to_be_downloaded"

            display_name = name.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
            entries.append({
                "folder": section_name,
                "path": name,
                "name": display_name,
                "remote_section": section_name,
                "category": movie_category if section_name == "movies" else None,
                "remote_source": entry_source,
                "is_to_be_downloaded": is_to_be_downloaded,
            })

    return entries


def _movie_category(catalog: dict[str, Any], section: str, name: str) -> str:
    if section != "movies":
        return ""
    category = catalog.get("movie_categories", {}).get(name)
    if isinstance(category, str) and category.strip():
        return category
    parts = name.replace("\\", "/").split("/")
    return " / ".join(parts[:-1]) if len(parts) > 1 else "Uncategorized"


def _selected_sections(catalog: dict[str, Any], section: str) -> list[str]:
    if section != "all":
        return [section]

    section_names = set()
    for source_name in ("names", "to_be_downloaded"):
        section_names.update(catalog.get(source_name, {}).keys())

    return sorted(section_names)


def _normalize_name(name: str) -> str:
    return " ".join(name.casefold().split())


def _merge_names(*name_lists: list[str]) -> list[str]:
    merged: dict[str, str] = {}

    for name_list in name_lists:
        for name in name_list:
            merged.setdefault(_normalize_name(name), name)

    return list(merged.values())
