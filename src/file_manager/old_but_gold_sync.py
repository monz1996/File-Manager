from __future__ import annotations

import shutil
from datetime import datetime
from pathlib import Path
from typing import Any

try:
    from .old_but_gold_compare import compare_package_content
except ImportError:
    from old_but_gold_compare import compare_package_content


def sync_package_to_remote(
    package_name: str,
    local_root: Path,
    remote_root: Path,
    delete_remote_extra: bool = False,
    dry_run: bool = False,
) -> dict[str, Any]:
    local_package = local_root / package_name
    remote_package = remote_root / package_name
    result = _base_result(
        package_name,
        local_package,
        remote_package,
        delete_remote_extra,
        dry_run,
    )

    if not local_package.exists():
        result["status"] = "local_package_missing"
        return result

    if not remote_root.exists():
        result["status"] = "remote_root_missing"
        return result

    if remote_package.exists():
        comparison = compare_package_content(package_name, local_root, remote_root)
    else:
        comparison = {
            "different_count": 0,
            "only_local_count": 0,
            "only_remote_count": 0,
            "only_local": sorted(_relative_file_paths(local_package), key=str.casefold),
            "different": [],
            "only_remote": [],
        }
        comparison["only_local_count"] = len(comparison["only_local"])

    result["comparison"] = {
        "different_count": comparison["different_count"],
        "only_local_count": comparison["only_local_count"],
        "only_remote_count": comparison["only_remote_count"],
    }

    if not dry_run:
        remote_package.mkdir(parents=True, exist_ok=True)

    _create_missing_directories(local_package, remote_package, result, dry_run)

    for relative_path in comparison["only_local"]:
        _copy_file(
            local_package / relative_path,
            remote_package / relative_path,
            relative_path,
            result,
            "copied",
            dry_run,
        )

    for relative_path in comparison["different"]:
        _copy_file(
            local_package / relative_path,
            remote_package / relative_path,
            relative_path,
            result,
            "updated",
            dry_run,
        )

    if delete_remote_extra:
        _delete_remote_extras(
            local_package,
            remote_package,
            comparison["only_remote"],
            result,
            dry_run,
        )

    result["status"] = "dry_run" if dry_run else "synced"

    return result


def sync_all_to_remote(
    local_root: Path,
    remote_root: Path,
    delete_remote_extra: bool = False,
    dry_run: bool = False,
) -> dict[str, Any]:
    result = {
        "generated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "local_root": str(local_root),
        "remote_root": str(remote_root),
        "local_root_available": local_root.exists(),
        "remote_root_available": remote_root.exists(),
        "delete_remote_extra": delete_remote_extra,
        "dry_run": dry_run,
        "status": "pending",
        "package_count": 0,
        "copied_count": 0,
        "updated_count": 0,
        "created_directory_count": 0,
        "deleted_count": 0,
        "packages": [],
    }

    if not local_root.exists():
        result["status"] = "local_root_missing"
        return result

    if not remote_root.exists():
        result["status"] = "remote_root_missing"
        return result

    package_names = sorted(
        {item.name for item in local_root.iterdir() if item.is_dir()},
        key=str.casefold,
    )

    for package_name in package_names:
        package_result = sync_package_to_remote(
            package_name,
            local_root,
            remote_root,
            delete_remote_extra=delete_remote_extra,
            dry_run=dry_run,
        )
        result["packages"].append(package_result)
        result["copied_count"] += package_result["copied_count"]
        result["updated_count"] += package_result["updated_count"]
        result["created_directory_count"] += package_result["created_directory_count"]
        result["deleted_count"] += package_result["deleted_count"]

    result["package_count"] = len(result["packages"])
    result["status"] = "dry_run" if dry_run else "synced"

    return result


def _base_result(
    package_name: str,
    local_package: Path,
    remote_package: Path,
    delete_remote_extra: bool,
    dry_run: bool,
) -> dict[str, Any]:
    return {
        "generated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "package": package_name,
        "local_package": str(local_package),
        "remote_package": str(remote_package),
        "local_available": local_package.exists(),
        "remote_available": remote_package.exists(),
        "delete_remote_extra": delete_remote_extra,
        "dry_run": dry_run,
        "status": "pending",
        "comparison": {},
        "copied_count": 0,
        "updated_count": 0,
        "created_directory_count": 0,
        "deleted_count": 0,
        "copied": [],
        "updated": [],
        "created_directories": [],
        "deleted": [],
    }


def _copy_file(
    source: Path,
    destination: Path,
    relative_path: str,
    result: dict[str, Any],
    operation: str,
    dry_run: bool,
) -> None:
    if not dry_run:
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)

    result[f"{operation}_count"] += 1
    result[operation].append(relative_path)


def _delete_remote_extras(
    local_package: Path,
    remote_package: Path,
    relative_paths: list[str],
    result: dict[str, Any],
    dry_run: bool,
) -> None:
    files = [remote_package / relative_path for relative_path in relative_paths]
    local_directory_lookup = _relative_dir_paths(local_package)
    directories = sorted(
        _relative_dir_paths(remote_package) - local_directory_lookup,
        key=lambda relative_path: len(Path(relative_path).parts),
        reverse=True,
    )

    for remote_file in files:
        _delete_remote_path(
            remote_file,
            remote_file.relative_to(remote_package).as_posix(),
            result,
            dry_run,
        )

    for relative_directory in directories:
        remote_directory = remote_package / relative_directory
        _delete_remote_path(
            remote_directory,
            relative_directory,
            result,
            dry_run,
        )


def _delete_remote_path(
    path: Path,
    relative_path: str,
    result: dict[str, Any],
    dry_run: bool,
) -> None:
    if not path.exists():
        return

    if not dry_run:
        if path.is_dir():
            shutil.rmtree(path)
        else:
            path.unlink()

    result["deleted_count"] += 1
    result["deleted"].append(relative_path)


def _relative_file_paths(path: Path) -> set[str]:
    return {
        item.relative_to(path).as_posix()
        for item in path.rglob("*")
        if item.is_file()
    }


def _relative_dir_paths(path: Path) -> set[str]:
    return {
        item.relative_to(path).as_posix()
        for item in path.rglob("*")
        if item.is_dir()
    }


def _create_missing_directories(
    local_package: Path,
    remote_package: Path,
    result: dict[str, Any],
    dry_run: bool,
) -> None:
    local_dirs = _relative_dir_paths(local_package)
    remote_dirs = _relative_dir_paths(remote_package) if remote_package.exists() else set()

    for relative_path in sorted(local_dirs - remote_dirs, key=str.casefold):
        if not dry_run:
            (remote_package / relative_path).mkdir(parents=True, exist_ok=True)

        result["created_directory_count"] += 1
        result["created_directories"].append(relative_path)
