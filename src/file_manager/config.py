from pathlib import Path
import tomllib


CONFIG_FILE = Path("local_config.toml")


def load_config() -> dict[str, Path]:
    with CONFIG_FILE.open("rb") as file:
        config = tomllib.load(file)

    root_path = Path(config["root_path"])

    folders = {
        name: root_path / folder_config["path"]
        for name, folder_config in config.items()
        if name != "root_path"
    }

    return folders