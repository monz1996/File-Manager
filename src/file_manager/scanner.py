from datetime import datetime
from pathlib import Path

try:
    from .path_visibility import is_hidden_or_system
except ImportError:
    from path_visibility import is_hidden_or_system


def scan_folder(folder_path: Path) -> list[dict]:
    """Return all files inside a folder and its subfolders."""
    return [
        _build_file_entry(file, folder_path)
        for file in folder_path.rglob("*")
        if file.is_file() and not is_hidden_or_system(file)
    ]


def scan_all_folders(folders: dict[str, Path]) -> dict[str, list[dict]]:
    result = {}
    root_path = folders.get("__root__")

    if root_path is not None:
        result["old but gold"] = scan_direct_files(root_path)

    configured_paths = {
        path.resolve()
        for name, path in folders.items()
        if name != "__root__" and path.exists()
    }
    for folder_name, folder_path in folders.items():
        if folder_name == "__root__":
            continue
        result[folder_name] = scan_folder(folder_path)

    if root_path is not None and root_path.exists():
        for child in root_path.iterdir():
            if child.is_dir() and child.resolve() not in configured_paths:
                result.setdefault(child.name, scan_folder(child))

    return result


def scan_direct_files(folder_path: Path) -> list[dict]:
    """Scan only files directly inside a root so configured subfolders are not duplicated."""
    if not folder_path.exists() or not folder_path.is_dir():
        return []

    return [
        _build_file_entry(file, folder_path)
        for file in folder_path.iterdir()
        if file.is_file() and not is_hidden_or_system(file)
    ]


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
