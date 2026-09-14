from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

try:
    from .config import load_remote_config, load_root_path
except ImportError:
    from config import load_remote_config, load_root_path


DATA_DIRECTORY = Path(__file__).resolve().parent / "data"
FILE_INDEX = DATA_DIRECTORY / "file_index.json"
VIDEO_METADATA = DATA_DIRECTORY / "video_metadata.json"
REMOTE_CATALOG = DATA_DIRECTORY / "remote_catalog.json"
OLD_BUT_GOLD_DIFF = DATA_DIRECTORY / "old_but_gold_diff.json"
DOWNLOADS_CUSTOM = DATA_DIRECTORY / "downloads_custom.json"


SECTION_FILE_NAMES = {
    "anime": "Anime.json",
    "games": "Games.json",
    "movies": "Movies.json",
    "series": "Series.json",
}


def load_file_index() -> list[dict[str, Any]]:
    if not FILE_INDEX.exists():
        return []
    with FILE_INDEX.open("r", encoding="utf-8") as file:
        data = json.load(file)
    return data.get("files", [])


def load_remote_catalog() -> dict[str, Any]:
    if not REMOTE_CATALOG.exists():
        return {"names": {}, "to_be_downloaded": {}, "sources": {}}
    with REMOTE_CATALOG.open("r", encoding="utf-8") as file:
        return json.load(file)


def load_remote_catalog_if_exists() -> dict[str, Any] | None:
    if not REMOTE_CATALOG.exists():
        # Check if 4 local content json files exist and construct catalog from them
        local_content_cat = _load_from_content_json_files()
        if local_content_cat:
            save_remote_catalog(local_content_cat)
            return local_content_cat
        return None

    return load_remote_catalog()


def _load_from_content_json_files() -> dict[str, Any] | None:
    try:
        local_root = load_root_path()
        content_dir = local_root / "Content"
        if not content_dir.exists():
            return None

        names: dict[str, list[str]] = {}
        to_be_downloaded: dict[str, list[str]] = {}

        found_any = False
        for sec, filename in SECTION_FILE_NAMES.items():
            fpath = content_dir / filename
            if fpath.exists():
                found_any = True
                try:
                    with fpath.open("r", encoding="utf-8") as f:
                        data = json.load(f)
                    names[sec] = data.get("items", [])
                    to_be_downloaded[sec] = data.get("to_be_downloaded", [])
                except Exception:
                    pass

        if not found_any:
            return None

        return {
            "generated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
            "names": names,
            "to_be_downloaded": to_be_downloaded,
            "to_be_downloaded_mode": "manual",
            "sources": {},
        }
    except Exception:
        return None


def _merge_persisted_to_be_downloaded(cat: dict[str, Any]) -> None:
    """Ensure no to_be_downloaded items are ever lost by loading from Content/ JSON files."""
    if "to_be_downloaded" not in cat:
        cat["to_be_downloaded"] = {}

    # Check local Content/ folder
    try:
        local_root = load_root_path()
        local_content = local_root / "Content"
        if local_content.exists():
            for sec, filename in SECTION_FILE_NAMES.items():
                fpath = local_content / filename
                if fpath.exists():
                    try:
                        with fpath.open("r", encoding="utf-8") as f:
                            data = json.load(f)
                        saved_tbd = data.get("to_be_downloaded", [])
                        current = set(cat["to_be_downloaded"].get(sec, []))
                        for item in saved_tbd:
                            if item not in current:
                                cat["to_be_downloaded"].setdefault(sec, []).append(item)
                    except Exception:
                        pass
    except Exception:
        pass

    # Check remote drive Content/ folder if available
    try:
        drive_path, _ = load_remote_config()
        remote_root = Path(f"{drive_path.drive}\\") if drive_path.drive else drive_path
        remote_content = remote_root / "old but gold" / "Content"
        if remote_content.exists():
            for sec, filename in SECTION_FILE_NAMES.items():
                fpath = remote_content / filename
                if fpath.exists():
                    try:
                        with fpath.open("r", encoding="utf-8") as f:
                            data = json.load(f)
                        saved_tbd = data.get("to_be_downloaded", [])
                        current = set(cat["to_be_downloaded"].get(sec, []))
                        for item in saved_tbd:
                            if item not in current:
                                cat["to_be_downloaded"].setdefault(sec, []).append(item)
                    except Exception:
                        pass
    except Exception:
        pass


def save_files(files: dict[str, list[dict[str, Any]]]) -> None:
    DATA_DIRECTORY.mkdir(exist_ok=True)

    stored_files = []
    for folder_name, file_entries in files.items():
        for file_entry in file_entries:
            stored_files.append({
                "folder": folder_name,
                **file_entry,
            })

    with FILE_INDEX.open("w", encoding="utf-8") as file:
        json.dump(
            {"files": stored_files},
            file,
            indent=4,
            ensure_ascii=False,
        )


def save_video_metadata(metadata: dict[str, Any]) -> None:
    DATA_DIRECTORY.mkdir(exist_ok=True)
    with VIDEO_METADATA.open("w", encoding="utf-8") as file:
        json.dump(
            metadata,
            file,
            indent=4,
            ensure_ascii=False,
        )


def save_remote_catalog(catalog: dict[str, Any]) -> None:
    DATA_DIRECTORY.mkdir(exist_ok=True)

    # 1. Save master remote_catalog.json
    with REMOTE_CATALOG.open("w", encoding="utf-8") as file:
        json.dump(
            catalog,
            file,
            indent=4,
            ensure_ascii=False,
        )

    # 2. Save 4 individual section JSON files to local Content/ folder
    now_iso = datetime.now().astimezone().isoformat(timespec="seconds")
    names_dict = catalog.get("names", {})
    tbd_dict = catalog.get("to_be_downloaded", {})

    target_content_directories = _catalog_content_directories()

    for content_dir in target_content_directories:
        for section, filename in SECTION_FILE_NAMES.items():
            items = names_dict.get(section, [])
            tbd_items = tbd_dict.get(section, [])
            section_data = {
                "section": section.capitalize(),
                "updated_at": now_iso,
                "total_items": len(items),
                "items": sorted(items, key=str.casefold),
                "to_be_downloaded_count": len(tbd_items),
                "to_be_downloaded": sorted(tbd_items, key=str.casefold),
            }
            out_path = content_dir / filename
            with out_path.open("w", encoding="utf-8") as f:
                json.dump(section_data, f, indent=4, ensure_ascii=False)


def _catalog_content_directories() -> list[Path]:
    """Return local and remote Content folders used by catalog scans."""
    directories: list[Path] = []

    local_content = load_root_path() / "Content"
    local_content.mkdir(parents=True, exist_ok=True)
    directories.append(local_content)

    drive_path, _ = load_remote_config()
    if drive_path.drive:
        remote_root = Path(f"{drive_path.drive}\\")
    else:
        remote_root = drive_path
    if remote_root.exists():
        remote_content = remote_root / "old but gold" / "Content"
        remote_content.mkdir(parents=True, exist_ok=True)
        directories.append(remote_content)

    return directories


def save_old_but_gold_diff(diff: dict[str, Any]) -> None:
    DATA_DIRECTORY.mkdir(exist_ok=True)
    with OLD_BUT_GOLD_DIFF.open("w", encoding="utf-8") as file:
        json.dump(
            diff,
            file,
            indent=4,
            ensure_ascii=False,
        )


def load_downloads_custom_state() -> dict[str, Any]:
    if not DOWNLOADS_CUSTOM.exists():
        return {"custom_names": {}, "ignored_suggestions": []}
    try:
        with DOWNLOADS_CUSTOM.open("r", encoding="utf-8") as file:
            return json.load(file)
    except Exception:
        return {"custom_names": {}, "ignored_suggestions": []}


def save_downloads_custom_state(state: dict[str, Any]) -> None:
    DATA_DIRECTORY.mkdir(exist_ok=True)
    with DOWNLOADS_CUSTOM.open("w", encoding="utf-8") as file:
        json.dump(state, file, indent=4, ensure_ascii=False)
