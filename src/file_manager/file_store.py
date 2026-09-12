import json
from pathlib import Path


DATA_DIRECTORY = Path("data")
FILE_INDEX = DATA_DIRECTORY / "file_index.json"


def save_files(files: dict[str, list[Path]]) -> None:
    DATA_DIRECTORY.mkdir(exist_ok=True)

    stored_files = []

    for folder_name, file_paths in files.items():
        for file_path in file_paths:
            stored_files.append({
                "folder": folder_name,
                "path": file_path.as_posix()
            })

    with FILE_INDEX.open("w", encoding="utf-8") as file:
        json.dump(
            {"files": stored_files},
            file,
            indent=4,
            ensure_ascii=False,
        )