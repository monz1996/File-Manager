from __future__ import annotations

import json
import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

DATA_DIRECTORY = Path(__file__).resolve().parent / "data"
OPERATIONS_LOG_FILE = DATA_DIRECTORY / "operations_log.json"


def load_operations_log(log_file: Path = OPERATIONS_LOG_FILE) -> list[dict[str, Any]]:
    if not log_file.exists():
        return []

    try:
        with log_file.open("r", encoding="utf-8") as file:
            data = json.load(file)
            return data.get("operations", [])
    except Exception:
        return []


def save_operations_log(operations: list[dict[str, Any]], log_file: Path = OPERATIONS_LOG_FILE) -> None:
    DATA_DIRECTORY.mkdir(parents=True, exist_ok=True)
    with log_file.open("w", encoding="utf-8") as file:
        json.dump({"operations": operations}, file, indent=4, ensure_ascii=False)


def record_operation(
    action_type: str,
    source: str,
    destination: str,
    description: str,
    details: dict[str, Any] | None = None,
    status: str = "completed",
    log_file: Path = OPERATIONS_LOG_FILE,
) -> dict[str, Any]:
    operations = load_operations_log(log_file)
    entry = {
        "id": str(uuid.uuid4()),
        "timestamp": datetime.now().astimezone().isoformat(timespec="seconds"),
        "action_type": action_type,
        "source": source,
        "destination": destination,
        "description": description,
        "details": details or {},
        "status": status,
    }
    operations.insert(0, entry)
    save_operations_log(operations, log_file)
    return entry


def revert_operation(op_id: str, log_file: Path = OPERATIONS_LOG_FILE) -> tuple[bool, str]:
    operations = load_operations_log(log_file)
    target = None
    target_idx = -1

    for idx, op in enumerate(operations):
        if op.get("id") == op_id:
            target = op
            target_idx = idx
            break

    if not target:
        return False, f"Operation with ID '{op_id}' not found."

    if target.get("status") == "reverted":
        return False, "This operation has already been reverted."

    action_type = target.get("action_type")
    source_str = target.get("source")
    dest_str = target.get("destination")
    details = target.get("details", {})

    try:
        if action_type == "download_move":
            src = Path(source_str)
            dst = Path(dest_str)
            if not dst.exists():
                return False, f"Cannot revert: target file '{dst}' no longer exists."
            src.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(dst, src)

        elif action_type in ("local_rename", "audit_rename"):
            src = Path(source_str)
            dst = Path(dest_str)
            if not dst.exists():
                return False, f"Cannot revert: renamed file '{dst}' no longer exists."
            if src.exists():
                return False, f"Cannot revert: original path '{src}' already exists."
            src.parent.mkdir(parents=True, exist_ok=True)
            dst.rename(src)

        elif action_type == "drive_sync":
            copied = details.get("copied", [])
            remote_root = Path(dest_str)
            for rel in copied:
                rem_file = remote_root / rel
                if rem_file.exists():
                    rem_file.unlink()

        else:
            return False, f"Unsupported action type '{action_type}' for revert."

        target["status"] = "reverted"
        target["reverted_at"] = datetime.now().astimezone().isoformat(timespec="seconds")
        operations[target_idx] = target
        save_operations_log(operations, log_file)
        return True, "Operation successfully reverted."

    except Exception as exc:
        return False, f"Error during revert: {str(exc)}"
