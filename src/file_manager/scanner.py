from datetime import datetime
from pathlib import Path


def scan_folder(folder_path: Path) -> list[dict]:
    """Return all files inside a folder and its subfolders."""
    return [
        _build_file_entry(file, folder_path)
        for file in folder_path.rglob("*")
        if file.is_file()
    ]


def scan_all_folders(folders: dict[str, Path]) -> dict[str, list[dict]]:
    result = {}

    for folder_name, folder_path in folders.items():
        result[folder_name] = scan_folder(folder_path)

    return result


def _build_file_entry(file_path: Path, folder_path: Path) -> dict:
    stat = file_path.stat()
    relative_path = file_path.relative_to(folder_path)

    return {
        "name": file_path.name,
        "path": relative_path.as_posix(),
        "extension": file_path.suffix.casefold(),
        "size_bytes": stat.st_size,
        "created_at": datetime.fromtimestamp(stat.st_ctime).astimezone().isoformat(timespec="seconds"),
        "created_timestamp": stat.st_ctime,
        "modified_at": datetime.fromtimestamp(stat.st_mtime).astimezone().isoformat(timespec="seconds"),
        "modified_timestamp": stat.st_mtime,
    }
