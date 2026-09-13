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
            items = details.get("items")
            if isinstance(items, list) and items:
                for item in reversed(items):
                    src = Path(item["source"])
                    dst = Path(item["destination"])
                    if not dst.exists():
                        return False, f"Cannot revert: target file '{dst}' no longer exists."
                    if src.exists():
                        return False, f"Cannot revert: original path '{src}' already exists."
                    src.parent.mkdir(parents=True, exist_ok=True)
                    shutil.move(str(dst), str(src))
            else:
                src = Path(source_str)
                dst = Path(dest_str)
                if not dst.exists():
                    return False, f"Cannot revert: target file '{dst}' no longer exists."
                src.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(str(dst), str(src))

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
            if not isinstance(copied, list) or not copied:
                return False, "Deleted files are permanently removed and cannot be reverted."
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


def revert_operation_items(
    op_id: str,
    indices: list[int],
    log_file: Path = OPERATIONS_LOG_FILE,
) -> tuple[bool, str]:
    operations = load_operations_log(log_file)
    target_idx = next((idx for idx, op in enumerate(operations) if op.get("id") == op_id), -1)
    if target_idx < 0:
        return False, f"Operation with ID '{op_id}' not found."

    target = operations[target_idx]
    if target.get("status") == "reverted":
        return False, "This operation has already been reverted."

    details = target.setdefault("details", {})
    action_type = target.get("action_type")

    if action_type == "download_move":
        items = details.get("items")
        if not isinstance(items, list):
            items = [{
                "source": target.get("source", ""),
                "destination": target.get("destination", ""),
            }]
    elif action_type == "drive_sync":
        items = []
        copied = details.get("copied", [])
        if isinstance(copied, list):
            items.extend(
                {"remote_path": str(Path(target.get("destination", "")) / relative_path), "relative_path": relative_path}
                for relative_path in copied
                if isinstance(relative_path, str)
            )
        packages = details.get("packages", [])
        if isinstance(packages, list):
            for package_index, package in enumerate(packages):
                if not isinstance(package, dict):
                    continue
                remote_package = package.get("remote_package")
                package_copied = package.get("copied", [])
                if not isinstance(remote_package, str) or not isinstance(package_copied, list):
                    continue
                items.extend(
                    {
                        "remote_path": str(Path(remote_package) / relative_path),
                        "relative_path": relative_path,
                        "package_index": package_index,
                    }
                    for relative_path in package_copied
                    if isinstance(relative_path, str)
                )
    else:
        return False, "Partial revert is only supported for Downloads moves and drive-sync copies."

    selected = set(indices)
    if not selected or any(index < 0 or index >= len(items) for index in selected):
        return False, "The selected operation items are invalid."

    reverted = []
    remaining = []
    try:
        if action_type == "drive_sync":
            for index in sorted(selected, reverse=True):
                remote_path = Path(items[index]["remote_path"])
                if not remote_path.exists():
                    return False, f"Cannot revert: copied file '{remote_path}' no longer exists."
                if remote_path.is_dir():
                    shutil.rmtree(remote_path)
                else:
                    remote_path.unlink()

            remaining = [item for index, item in enumerate(items) if index not in selected]
            if isinstance(details.get("copied"), list):
                details["copied"] = [
                    item["relative_path"] for item in remaining if "package_index" not in item
                ]
                details["copied_count"] = len(details["copied"])
            if isinstance(packages, list):
                for package_index, package in enumerate(packages):
                    if not isinstance(package, dict):
                        continue
                    package["copied"] = [
                        item["relative_path"]
                        for item in remaining
                        if item.get("package_index") == package_index
                    ]
                    package["copied_count"] = len(package["copied"])
            if not remaining:
                target["status"] = "reverted"
                target["reverted_at"] = datetime.now().astimezone().isoformat(timespec="seconds")
            else:
                target["description"] = (
                    f"Synced package with {len(remaining)} copied file(s) remaining"
                )
            operations[target_idx] = target
            save_operations_log(operations, log_file)
            return True, f"Reverted {len(selected)} copied file(s) from the operation."

        for index, item in enumerate(items):
            if index not in selected:
                remaining.append(item)
                continue

            source = Path(item["source"])
            destination = Path(item["destination"])
            if not destination.exists():
                return False, f"Cannot revert: target file '{destination}' no longer exists."
            if source.exists():
                return False, f"Cannot revert: original path '{source}' already exists."
            source.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(destination), str(source))
            reverted.append(item)

        details["items"] = remaining
        details["reverted_items"] = details.get("reverted_items", []) + reverted
        if remaining:
            target["source"] = remaining[0]["source"]
            target["destination"] = remaining[0]["destination"]
            target["description"] = f"Moved {len(remaining)} item(s) from Downloads to Local"
        else:
            target["status"] = "reverted"
            target["reverted_at"] = datetime.now().astimezone().isoformat(timespec="seconds")

        operations[target_idx] = target
        save_operations_log(operations, log_file)
        return True, f"Reverted {len(reverted)} item(s) from the operation."
    except Exception as exc:
        return False, f"Error during partial revert: {str(exc)}"
