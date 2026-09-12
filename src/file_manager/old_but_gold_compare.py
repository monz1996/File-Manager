from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any


def compare_old_but_gold_paths(local_root: Path, remote_root: Path) -> dict[str, Any]:
    result = _base_result(local_root, remote_root)

    if not result["remote_root_available"]:
        return result

    package_names = sorted(
        _top_level_names(local_root) | _top_level_names(remote_root),
        key=str.casefold,
    )

    for package_name in package_names:
        local_package = local_root / package_name
        remote_package = remote_root / package_name
        local_paths = _relative_paths(local_package) if local_package.exists() else set()
        remote_paths = _relative_paths(remote_package) if remote_package.exists() else set()
        only_local = sorted(local_paths - remote_paths, key=str.casefold)
        only_remote = sorted(remote_paths - local_paths, key=str.casefold)

        result["packages"].append({
            "package": package_name,
            "local_available": local_package.exists(),
            "remote_available": remote_package.exists(),
            "local_count": len(local_paths),
            "remote_count": len(remote_paths),
            "only_local_count": len(only_local),
            "only_remote_count": len(only_remote),
            "only_local": only_local,
            "only_remote": only_remote,
        })

    result["package_count"] = len(result["packages"])
    result["packages_with_differences_count"] = sum(
        1 for package in result["packages"]
        if package["only_local_count"] or package["only_remote_count"]
    )

    return result


def compare_package_content(
    package_name: str,
    local_root: Path,
    remote_root: Path,
    chunk_size: int = 1024 * 1024,
) -> dict[str, Any]:
    local_package = local_root / package_name
    remote_package = remote_root / package_name

    result = {
        "generated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "package": package_name,
        "local_package": str(local_package),
        "remote_package": str(remote_package),
        "local_available": local_package.exists(),
        "remote_available": remote_package.exists(),
        "compared_count": 0,
        "same_count": 0,
        "different_count": 0,
        "only_local_count": 0,
        "only_remote_count": 0,
        "same": [],
        "different": [],
        "only_local": [],
        "only_remote": [],
    }

    if not local_package.exists() or not remote_package.exists():
        return result

    local_files = _relative_file_paths(local_package)
    remote_files = _relative_file_paths(remote_package)
    common_files = sorted(local_files & remote_files, key=str.casefold)

    result["only_local"] = sorted(local_files - remote_files, key=str.casefold)
    result["only_remote"] = sorted(remote_files - local_files, key=str.casefold)
    result["only_local_count"] = len(result["only_local"])
    result["only_remote_count"] = len(result["only_remote"])

    for relative_path in common_files:
        local_file = local_package / relative_path
        remote_file = remote_package / relative_path
        is_same = _same_file_content(local_file, remote_file, chunk_size)
        result["compared_count"] += 1

        if is_same:
            result["same_count"] += 1
            result["same"].append(relative_path)
        else:
            result["different_count"] += 1
            result["different"].append(relative_path)

    return result


def _base_result(local_root: Path, remote_root: Path) -> dict[str, Any]:
    return {
        "generated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "comparison": "case_sensitive_relative_paths",
        "local_root": str(local_root),
        "remote_root": str(remote_root),
        "local_root_available": local_root.exists(),
        "remote_root_available": remote_root.exists(),
        "package_count": 0,
        "packages_with_differences_count": 0,
        "packages": [],
    }


def _top_level_names(path: Path) -> set[str]:
    if not path.exists():
        return set()

    return {item.name for item in path.iterdir() if item.is_dir()}


def _relative_paths(path: Path) -> set[str]:
    return {
        item.relative_to(path).as_posix()
        for item in path.rglob("*")
    }


def _relative_file_paths(path: Path) -> set[str]:
    return {
        item.relative_to(path).as_posix()
        for item in path.rglob("*")
        if item.is_file()
    }


def _same_file_content(local_file: Path, remote_file: Path, chunk_size: int) -> bool:
    if local_file.stat().st_size != remote_file.stat().st_size:
        return False

    with local_file.open("rb") as left, remote_file.open("rb") as right:
        while True:
            left_chunk = left.read(chunk_size)
            right_chunk = right.read(chunk_size)

            if left_chunk != right_chunk:
                return False

            if not left_chunk:
                return True
