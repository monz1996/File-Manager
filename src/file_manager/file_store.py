import json
from pathlib import Path
from typing import Any


DATA_DIRECTORY = Path(__file__).resolve().parent / "data"
FILE_INDEX = DATA_DIRECTORY / "file_index.json"
VIDEO_METADATA = DATA_DIRECTORY / "video_metadata.json"
REMOTE_CATALOG = DATA_DIRECTORY / "remote_catalog.json"
OLD_BUT_GOLD_DIFF = DATA_DIRECTORY / "old_but_gold_diff.json"


def load_file_index() -> list[dict[str, Any]]:
    with FILE_INDEX.open("r", encoding="utf-8") as file:
        data = json.load(file)

    return data.get("files", [])


def load_remote_catalog() -> dict[str, Any]:
    with REMOTE_CATALOG.open("r", encoding="utf-8") as file:
        return json.load(file)


def load_remote_catalog_if_exists() -> dict[str, Any] | None:
    if not REMOTE_CATALOG.exists():
        return None

    return load_remote_catalog()


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

    with REMOTE_CATALOG.open("w", encoding="utf-8") as file:
        json.dump(
            catalog,
            file,
            indent=4,
            ensure_ascii=False,
        )


def save_old_but_gold_diff(diff: dict[str, Any]) -> None:
    DATA_DIRECTORY.mkdir(exist_ok=True)

    with OLD_BUT_GOLD_DIFF.open("w", encoding="utf-8") as file:
        json.dump(
            diff,
            file,
            indent=4,
            ensure_ascii=False,
        )
