from pathlib import Path
import tomllib


BASE_DIRECTORY = Path(__file__).resolve().parent
CONFIG_FILE = BASE_DIRECTORY / "local_config.toml"
REMOTE_CONFIG_FILE = BASE_DIRECTORY / "remote_config.toml"


def load_config(config_file: Path = CONFIG_FILE) -> dict[str, Path]:
    with config_file.open("rb") as file:
        config = tomllib.load(file)

    root_path = load_root_path(config_file)

    folders = {
        name: root_path / folder_config["path"]
        for name, folder_config in config.items()
        if isinstance(folder_config, dict) and "path" in folder_config
    }

    return folders


def load_root_path(config_file: Path = CONFIG_FILE) -> Path:
    with config_file.open("rb") as file:
        config = tomllib.load(file)

    return Path(config["root_path"])


def load_remote_config() -> tuple[Path, dict[str, Path]]:
    with REMOTE_CONFIG_FILE.open("rb") as file:
        config = tomllib.load(file)

    drive_path = Path(config.get("path", "D:"))

    return drive_path, load_config(REMOTE_CONFIG_FILE)
