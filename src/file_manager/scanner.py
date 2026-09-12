from pathlib import Path


def scan_folder(folder_path: Path) -> list[Path]:
    """Return all files inside a folder and its subfolders."""
    return [
        file.relative_to(folder_path)
        for file in folder_path.rglob("*")
        if file.is_file()
    ]


def scan_all_folders(folders: dict[str, Path]) -> dict[str, list[Path]]:
    result = {}

    for folder_name, folder_path in folders.items():
        result[folder_name] = scan_folder(folder_path)

    return result