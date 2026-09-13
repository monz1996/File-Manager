from __future__ import annotations

import os
import string
import subprocess
from pathlib import Path
from typing import Any
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


def get_available_drives() -> list[str]:
    """Return all currently mounted drive roots on Windows, e.g. ['C:\\', 'D:\\']."""
    drives = []
    for letter in string.ascii_uppercase:
        drive = f"{letter}:\\"
        if os.path.exists(drive):
            drives.append(drive)
    return drives


def check_hard_drive_status() -> dict[str, Any]:
    """Check if the configured external hard drive is currently plugged in and mounted."""
    drive_path, _ = load_remote_config()
    drive_root = Path(f"{drive_path.drive}\\") if drive_path.drive else drive_path
    
    # Check if drive root exists
    drive_mounted = False
    try:
        drive_mounted = os.path.exists(str(drive_root))
    except Exception:
        drive_mounted = False

    remote_old_but_gold = drive_root / "old but gold"
    old_but_gold_exists = False
    if drive_mounted:
        try:
            old_but_gold_exists = remote_old_but_gold.exists()
        except Exception:
            old_but_gold_exists = False

    available_drives = get_available_drives()

    return {
        "drive_letter": str(drive_path),
        "drive_root": str(drive_root),
        "drive_mounted": drive_mounted,
        "old_but_gold_path": str(remote_old_but_gold),
        "old_but_gold_available": old_but_gold_exists,
        "available_drives": available_drives,
    }


def eject_hard_drive() -> tuple[bool, str]:
    """Safely request Windows to eject the configured external drive."""
    drive_path, _ = load_remote_config()
    drive_root = f"{drive_path.drive}\\"
    if not drive_path.drive:
        return False, "The configured remote path is not on a mounted drive."

    if not os.path.exists(drive_root):
        return False, f"Drive {drive_path.drive} is already disconnected."

    script = (
        "$shell = New-Object -ComObject Shell.Application; "
        "$drive = $shell.Namespace(17).ParseName($args[0]); "
        "if ($null -eq $drive) { throw 'The configured drive could not be found.' }; "
        "$drive.InvokeVerb('Eject')"
    )
    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", script, drive_root],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=15,
            check=False,
        )
    except subprocess.TimeoutExpired:
        return False, "Timed out while requesting drive ejection."
    except OSError as exc:
        return False, f"Could not start the Windows eject command: {exc}"

    if result.returncode != 0:
        error = result.stderr.strip() or result.stdout.strip() or "Windows rejected the eject request."
        return False, error
    return True, f"Eject requested for drive {drive_path.drive}."
