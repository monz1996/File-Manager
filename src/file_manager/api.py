from __future__ import annotations

import json
import os
import shutil
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from starlette.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

try:
    from .config import load_config, load_remote_config, load_root_path, check_hard_drive_status
    from .downloads_ignore import add_ignored_name, load_ignored_names, remove_ignored_name, save_ignored_names
    from .downloads_plan import build_downloads_plan, recommend_name_and_package
    from .file_sort import SORT_OPTIONS, sort_files
    from .file_store import (
        FILE_INDEX,
        OLD_BUT_GOLD_DIFF,
        REMOTE_CATALOG,
        VIDEO_METADATA,
        DOWNLOADS_CUSTOM,
        load_downloads_custom_state,
        save_downloads_custom_state,
        load_file_index,
        load_remote_catalog,
        load_remote_catalog_if_exists,
        save_files,
        save_old_but_gold_diff,
        save_remote_catalog,
        save_video_metadata,
    )
    from .name_audit import audit_file_index_names
    from .old_but_gold_compare import compare_old_but_gold_paths, compare_package_content, compare_arbitrary_paths
    from .old_but_gold_sync import sync_all_to_remote, sync_package_to_remote
    from .operation_manager import operation_manager
    from .operations import (
        load_operations_log,
        record_operation,
        revert_operation,
        revert_operation_items,
        save_operations_log,
    )
    from .audit_ignore import add_ignored_audit, is_audit_ignored, load_ignored_audit, remove_ignored_audit
    from .remote_catalog import build_remote_catalog
    from .remote_search import REMOTE_SECTIONS, REMOTE_SOURCES, search_remote_catalog
    from .scanner import scan_all_folders
    from .search import search_file_index
    from .video_metadata import collect_video_folder_metadata, find_video_package_paths
    from .entertainment import preview_path, scan_entertainment, get_video_thumbnail, clear_thumbnail_cache, is_thumbnail_generation_available
except ImportError:
    from config import load_config, load_remote_config, load_root_path, check_hard_drive_status
    from downloads_ignore import add_ignored_name, load_ignored_names, remove_ignored_name, save_ignored_names
    from downloads_plan import build_downloads_plan, recommend_name_and_package
    from file_sort import SORT_OPTIONS, sort_files
    from file_store import (
        FILE_INDEX,
        OLD_BUT_GOLD_DIFF,
        REMOTE_CATALOG,
        VIDEO_METADATA,
        DOWNLOADS_CUSTOM,
        load_downloads_custom_state,
        save_downloads_custom_state,
        load_file_index,
        load_remote_catalog,
        load_remote_catalog_if_exists,
        save_files,
        save_old_but_gold_diff,
        save_remote_catalog,
        save_video_metadata,
    )
    from name_audit import audit_file_index_names
    from old_but_gold_compare import compare_old_but_gold_paths, compare_package_content, compare_arbitrary_paths
    from old_but_gold_sync import sync_all_to_remote, sync_package_to_remote
    from operation_manager import operation_manager
    from operations import (
        load_operations_log,
        record_operation,
        revert_operation,
        revert_operation_items,
        save_operations_log,
    )
    from audit_ignore import add_ignored_audit, is_audit_ignored, load_ignored_audit, remove_ignored_audit
    from remote_catalog import build_remote_catalog
    from remote_search import REMOTE_SECTIONS, REMOTE_SOURCES, search_remote_catalog
    from scanner import scan_all_folders
    from search import search_file_index
    from video_metadata import collect_video_folder_metadata, find_video_package_paths
    from entertainment import preview_path, scan_entertainment, get_video_thumbnail, clear_thumbnail_cache, is_thumbnail_generation_available

app = FastAPI(title="File Manager API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _get_downloads_folder() -> Path:
    user_home = Path.home()
    downloads_path = user_home / "Downloads"
    return downloads_path


def _remote_old_but_gold_root() -> Path:
    drive_path, _ = load_remote_config()
    drive_root = Path(f"{drive_path.drive}\\") if drive_path.drive else drive_path
    return drive_root / "old but gold"


def _get_file_info(file_path: Path) -> dict[str, Any]:
    if not file_path.exists():
        return {"exists": False, "size_bytes": 0, "size_readable": "0 B", "modified_at": None}
    stat = file_path.stat()
    size = stat.st_size
    units = ["B", "KB", "MB", "GB"]
    s = float(size)
    readable = f"{size} B"
    for unit in units:
        if s < 1024 or unit == units[-1]:
            readable = f"{s:.2f} {unit}" if unit != "B" else f"{size} B"
            break
        s /= 1024
    return {
        "exists": True,
        "size_bytes": size,
        "size_readable": readable,
        "modified_at": datetime.fromtimestamp(stat.st_mtime).astimezone().isoformat(timespec="seconds"),
    }


# ==========================================
# 1. System Status & 4 Core Data Files
# ==========================================

@app.get("/api/status")
def get_system_status():
    local_root = load_root_path()
    drive_path, _ = load_remote_config()
    downloads_path = _get_downloads_folder()

    file_index_info = _get_file_info(FILE_INDEX)
    video_meta_info = _get_file_info(VIDEO_METADATA)
    remote_cat_info = _get_file_info(REMOTE_CATALOG)
    old_diff_info = _get_file_info(OLD_BUT_GOLD_DIFF)

    files_count = 0
    if FILE_INDEX.exists():
        try:
            files_count = len(load_file_index())
        except Exception:
            pass

    videos_count = 0
    packages_count = 0
    if VIDEO_METADATA.exists():
        try:
            with VIDEO_METADATA.open("r", encoding="utf-8") as f:
                vm = json.load(f)
                videos_count = vm.get("video_file_count", 0)
                packages_count = vm.get("package_count", 0)
        except Exception:
            pass

    catalog_entries_count = 0
    to_be_downloaded_count = 0
    if REMOTE_CATALOG.exists():
        try:
            rc = load_remote_catalog()
            names_dict = rc.get("names", {})
            catalog_entries_count = sum(len(v) for v in names_dict.values())
            tbd_dict = rc.get("to_be_downloaded", {})
            to_be_downloaded_count = sum(len(v) for v in tbd_dict.values())
        except Exception:
            pass

    return {
        "connected": {
            "local_root": {"path": str(local_root), "available": local_root.exists()},
            "downloads": {"path": str(downloads_path), "available": downloads_path.exists()},
            "remote_drive": {"path": str(drive_path), "available": drive_path.exists()},
            "remote_old_but_gold": {"path": str(_remote_old_but_gold_root()), "available": _remote_old_but_gold_root().exists()},
        },
        "data_files": {
            "file_index": {**file_index_info, "records_count": files_count, "description": "Local indexed files registry"},
            "video_metadata": {**video_meta_info, "records_count": videos_count, "packages_count": packages_count, "description": "Videos folder resolution & duration metadata"},
            "remote_catalog": {**remote_cat_info, "records_count": catalog_entries_count, "to_be_downloaded_count": to_be_downloaded_count, "description": "Hard drive movies, anime, games, series catalog"},
            "old_but_gold_diff": {**old_diff_info, "description": "Local vs Hard Drive diff registry"},
        },
        "operations_count": len(load_operations_log()),
    }


@app.get("/api/status/drive")
def get_drive_status():
    """Lightweight endpoint for polling hard drive connection status."""
    return check_hard_drive_status()


@app.post("/api/shutdown")
def shutdown_app():
    server = getattr(app.state, "server", None)
    if server is None:
        raise HTTPException(status_code=503, detail="The GUI server does not support programmatic shutdown.")
    server.should_exit = True
    return {"success": True, "message": "File Manager is shutting down."}


# ==========================================
# 2. Activity / Operations History & Revert
# ==========================================

class PartialRevertRequest(BaseModel):
    indices: list[int]


class DeleteOperationsRequest(BaseModel):
    ids: list[str]


@app.get("/api/history")
def get_operations_history():
    return {"operations": load_operations_log()}


@app.post("/api/history/revert/{op_id}")
def revert_op(op_id: str):
    success, message = revert_operation(op_id)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"success": True, "message": message, "operations": load_operations_log()}


@app.post("/api/history/delete")
def delete_operations(req: DeleteOperationsRequest):
    operations = load_operations_log()
    ids = set(req.ids)
    if not ids:
        raise HTTPException(status_code=400, detail="At least one activity ID is required.")

    remaining = [operation for operation in operations if operation.get("id") not in ids]
    deleted_count = len(operations) - len(remaining)
    if deleted_count == 0:
        raise HTTPException(status_code=404, detail="No matching activities were found.")

    save_operations_log(remaining)
    return {
        "success": True,
        "deleted_count": deleted_count,
        "operations": remaining,
    }


@app.post("/api/history/revert/{op_id}/items")
def revert_op_items(op_id: str, req: PartialRevertRequest):
    success, message = revert_operation_items(op_id, req.indices)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"success": True, "message": message, "operations": load_operations_log()}


# ==========================================
# 3. Video Metadata & Analytics Graphs
# ==========================================

def _enrich_package_analytics(package: dict[str, Any]) -> dict[str, Any]:
    videos = package.get("videos", [])
    if not videos:
        return {
            **package,
            "highest_quality_video": None,
            "lowest_quality_video": None,
            "highest_file_size_video": None,
            "lowest_file_size_video": None,
            "shortest_duration_video": None,
            "longest_duration_video": None,
        }

    known_quality = [
        video for video in videos
        if video.get("quality", {}).get("height") is not None
        and video.get("quality", {}).get("quality_label")
    ]
    known_duration = [
        video for video in videos
        if video.get("duration_seconds") is not None
    ]
    known_size = [
        video for video in videos
        if video.get("size_bytes") is not None and video.get("size_bytes") > 0
    ]

    highest_q = max(known_quality, key=lambda v: v.get("quality", {}).get("height") or 0) if known_quality else None
    lowest_q = min(known_quality, key=lambda v: v.get("quality", {}).get("height") or 0) if known_quality else None
    highest_s = max(known_size, key=lambda v: v.get("size_bytes", 0)) if known_size else None
    lowest_s = min(known_size, key=lambda v: v.get("size_bytes", 0)) if known_size else None
    shortest_d = min(known_duration, key=lambda v: v.get("duration_seconds") or 0) if known_duration else None
    longest_d = max(known_duration, key=lambda v: v.get("duration_seconds") or 0) if known_duration else None

    return {
        **package,
        "highest_quality_video": {
            "name": highest_q["name"],
            "resolution": highest_q.get("quality", {}).get("resolution"),
            "quality_label": highest_q.get("quality", {}).get("quality_label"),
            "size_readable": highest_q.get("size_readable"),
            "path": highest_q.get("path"),
        } if highest_q else None,
        "lowest_quality_video": {
            "name": lowest_q["name"],
            "resolution": lowest_q.get("quality", {}).get("resolution"),
            "quality_label": lowest_q.get("quality", {}).get("quality_label"),
            "size_readable": lowest_q.get("size_readable"),
            "path": lowest_q.get("path"),
        } if lowest_q else None,
        "highest_file_size_video": {
            "name": highest_s["name"],
            "size_bytes": highest_s["size_bytes"],
            "size_readable": highest_s["size_readable"],
            "resolution": highest_s.get("quality", {}).get("resolution"),
            "quality_label": highest_s.get("quality", {}).get("quality_label"),
            "path": highest_s.get("path"),
        } if highest_s else None,
        "lowest_file_size_video": {
            "name": lowest_s["name"],
            "size_bytes": lowest_s["size_bytes"],
            "size_readable": lowest_s["size_readable"],
            "resolution": lowest_s.get("quality", {}).get("resolution"),
            "quality_label": lowest_s.get("quality", {}).get("quality_label"),
            "path": lowest_s.get("path"),
        } if lowest_s else None,
        "shortest_duration_video": {
            "name": shortest_d["name"],
            "duration_seconds": shortest_d.get("duration_seconds"),
            "duration_readable": shortest_d.get("duration_readable"),
            "size_readable": shortest_d.get("size_readable"),
            "quality_label": shortest_d.get("quality", {}).get("quality_label"),
            "path": shortest_d.get("path"),
        } if shortest_d else None,
        "longest_duration_video": {
            "name": longest_d["name"],
            "duration_seconds": longest_d.get("duration_seconds"),
            "duration_readable": longest_d.get("duration_readable"),
            "size_readable": longest_d.get("size_readable"),
            "quality_label": longest_d.get("quality", {}).get("quality_label"),
            "path": longest_d.get("path"),
        } if longest_d else None,
    }


@app.get("/api/video-metadata")
def get_video_metadata():
    videos_folder = load_config().get("videos")
    data: dict[str, Any] = {}
    if VIDEO_METADATA.exists():
        with VIDEO_METADATA.open("r", encoding="utf-8") as f:
            data = json.load(f)

    if videos_folder and videos_folder.exists():
        expected_paths = {
            path.relative_to(videos_folder).as_posix()
            for path in find_video_package_paths(videos_folder)
        }
        cached_paths = {package.get("path") for package in data.get("packages", [])}
        if expected_paths != cached_paths:
            save_video_metadata(collect_video_folder_metadata(videos_folder))
            with VIDEO_METADATA.open("r", encoding="utf-8") as f:
                data = json.load(f)

    if not data:
        return {"packages": [], "quality_counts": {}, "total_size_readable": "0 B", "package_count": 0}

    enriched_packages = [_enrich_package_analytics(p) for p in data.get("packages", [])]
    return {
        **data,
        "packages": enriched_packages,
    }


@app.post("/api/video-metadata/rescan")
def rescan_video_metadata():
    folders = load_config()
    if "videos" not in folders or not folders["videos"].exists():
        raise HTTPException(status_code=400, detail="Videos folder path not found or does not exist.")
    video_meta = collect_video_folder_metadata(folders["videos"])
    save_video_metadata(video_meta)
    return get_video_metadata()


# ==========================================
# 4. Downloads -> Local Old But Gold Sync
# ==========================================

class MoveItemRequest(BaseModel):
    source_path: str
    target_package: str
    target_name: str


class BatchMoveRequest(BaseModel):
    items: list[MoveItemRequest]


@app.get("/api/downloads/plan")
def get_downloads_plan():
    downloads_root = _get_downloads_folder()
    local_root = load_root_path()
    ignored = load_ignored_names()
    plan = build_downloads_plan(downloads_root, local_root, ignored_names=ignored)
    
    # Also provide list of existing packages for the package selector dropdown
    package_names = []
    if local_root.exists():
        package_names = sorted(
            [item.name for item in local_root.iterdir() if item.is_dir()],
            key=str.casefold,
        )
    return {**plan, "available_packages": package_names}


@app.post("/api/downloads/move")
def move_download_files(req: BatchMoveRequest):
    local_root = load_root_path()
    results = []
    moved_items = []

    for item in req.items:
        src = Path(item.source_path)
        if not src.exists():
            results.append({"source": item.source_path, "success": False, "error": "Source file not found"})
            continue
        dest_dir = local_root / item.target_package
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest_file = dest_dir / item.target_name

        try:
            shutil.move(str(src), str(dest_file))
            moved_items.append({
                "source": str(src),
                "destination": str(dest_file),
                "package": item.target_package,
                "target_name": item.target_name,
                "is_directory": dest_file.is_dir(),
                "size_bytes": dest_file.stat().st_size if dest_file.is_file() else 0,
            })
            results.append({"source": str(src), "destination": str(dest_file), "success": True})
        except Exception as exc:
            results.append({"source": str(src), "success": False, "error": str(exc)})

    if moved_items:
        first_item = moved_items[0]
        record_operation(
            action_type="download_move",
            source=first_item["source"] if len(moved_items) == 1 else "Downloads",
            destination=first_item["destination"] if len(moved_items) == 1 else str(local_root),
            description=f"Moved {len(moved_items)} item(s) from Downloads to Local",
            details={
                "items": moved_items,
                "count": len(moved_items),
            },
        )

    # Auto refresh file index in background or return updated results
    return {"results": results, "count": len(results)}


@app.get("/api/downloads/ignore")
def get_ignored_downloads():
    return {"ignored": sorted(load_ignored_names(), key=str.casefold)}


class IgnoreItemRequest(BaseModel):
    name: str


@app.post("/api/downloads/ignore")
def add_download_ignore(req: IgnoreItemRequest):
    updated = add_ignored_name(req.name)
    return {"ignored": sorted(updated, key=str.casefold)}


@app.delete("/api/downloads/ignore/{name}")
def delete_download_ignore(name: str):
    updated = remove_ignored_name(name)
    return {"ignored": sorted(updated, key=str.casefold)}


class BatchIgnoreRequest(BaseModel):
    names: list[str]


@app.post("/api/downloads/ignore-batch")
def add_download_ignore_batch(req: BatchIgnoreRequest):
    updated = load_ignored_names()
    for name in req.names:
        updated.add(name)
    save_ignored_names(updated)
    return {"ignored": sorted(updated, key=str.casefold)}


@app.get("/api/downloads/browse-packages")
def browse_packages(path: str = ""):
    """Browse subdirectories within the local old but gold root for deep navigation."""
    local_root = load_root_path()
    target = local_root if not path else local_root / path

    if not target.exists():
        return {"path": path, "subdirs": [], "error": "Path not found"}

    subdirs = sorted(
        [item.name for item in target.iterdir() if item.is_dir()],
        key=str.casefold,
    )
    return {"path": path, "subdirs": subdirs}


class SuggestNameRequest(BaseModel):
    source_name: str
    current_suggestion: str = ""
    seed: int = 0


@app.post("/api/downloads/suggest-name")
def suggest_alt_name(req: SuggestNameRequest):
    """Generate a different name suggestion each time by applying alternative cleaning strategies."""
    from pathlib import Path as _Path
    from .downloads_plan import (
        YEAR_PATTERN, clean_download_name,
    )

    name = req.source_name
    suffix = _Path(name).suffix
    ignored_suggestions = load_downloads_custom_state().get("ignored_suggestions", [])

    strategies = []

    # Strategy 0: Basic clean (same as default)
    cleaned_name, _ = clean_download_name(name)
    s = _Path(cleaned_name).stem
    strategies.append(s)

    # Strategy 1: Title Case
    s1 = strategies[0].title()
    strategies.append(s1)

    # Strategy 2: Remove year
    s2 = YEAR_PATTERN.sub("", strategies[0])
    s2 = " ".join(s2.split()).strip(" .-_")
    strategies.append(s2)

    # Strategy 3: Uppercase first letter only
    s3 = strategies[0].capitalize() if strategies[0] else strategies[0]
    strategies.append(s3)

    # Filter out strategies matching current suggestion or ignored
    candidates = []
    for idx, s in enumerate(strategies):
        full = f"{s}{suffix}"
        if full == req.current_suggestion:
            continue
        if full in ignored_suggestions:
            continue
        candidates.append((idx, full))

    if not candidates:
        # Keep the result clean even when every alternate suggestion is ignored.
        cleaned_name, _ = clean_download_name(name)
        return {"suggestion": cleaned_name, "strategy": "cleaned", "seed": req.seed}

    # Use seed to pick different result each time
    pick_idx = req.seed % len(candidates)
    chosen = candidates[pick_idx]
    return {"suggestion": chosen[1], "strategy": f"strategy_{chosen[0]}", "seed": req.seed + 1}


@app.post("/api/downloads/ignore-suggestion")
def ignore_suggestion(req: IgnoreItemRequest):
    """Persist that a suggested name should not be offered again."""
    state = load_downloads_custom_state()
    ignored = state.setdefault("ignored_suggestions", [])
    if req.name and req.name not in ignored:
        ignored.append(req.name)
    state["ignored_suggestions"] = sorted(ignored, key=str.casefold)
    save_downloads_custom_state(state)
    return {"ignored_suggestions": state["ignored_suggestions"]}


@app.get("/api/downloads/custom-state")
def get_downloads_custom_state():
    return load_downloads_custom_state()


# ==========================================
# 5. Local Old But Gold <-> Hard Drive (D:)
# ==========================================

@app.get("/api/operations/current")
def get_current_operation():
    return {"operation": operation_manager.current()}


@app.post("/api/operations/stop")
def stop_current_operation():
    operation = operation_manager.request_stop()
    if operation is None:
        return {"operation": None, "stopped": False}
    return {"operation": operation, "stopped": True}


@app.get("/api/old-gold/diff")
def get_old_gold_diff(refresh: bool = False):
    local_root = load_root_path()
    remote_root = _remote_old_but_gold_root()

    if refresh:
        diff = compare_old_but_gold_paths(local_root, remote_root)
        save_old_but_gold_diff(diff)
        return diff

    if OLD_BUT_GOLD_DIFF.exists():
        with OLD_BUT_GOLD_DIFF.open("r", encoding="utf-8") as f:
            return json.load(f)

    diff = compare_old_but_gold_paths(local_root, remote_root)
    save_old_but_gold_diff(diff)
    return diff


@app.get("/api/old-gold/compare/{package}")
def compare_package(package: str):
    local_root = load_root_path()
    remote_root = _remote_old_but_gold_root()
    return compare_package_content(package, local_root, remote_root)


class SyncRequest(BaseModel):
    package: str | None = None
    sync_all: bool = False
    delete_remote_extra: bool = True
    dry_run: bool = False


@app.post("/api/old-gold/sync")
def sync_old_gold(req: SyncRequest):
    local_root = load_root_path()
    remote_root = _remote_old_but_gold_root()
    label = "Syncing all packages" if req.sync_all else f"Syncing {req.package}"

    try:
        _, stop_event = operation_manager.start("drive_sync", label)
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    try:
        def on_progress(processed: int, total: int, path: str) -> None:
            operation_manager.update(
                phase="byte_compare",
                processed=processed,
                total=total,
                current_path=path,
            )

        if req.sync_all:
            result = sync_all_to_remote(
                local_root,
                remote_root,
                delete_remote_extra=req.delete_remote_extra,
                dry_run=req.dry_run,
                stop_event=stop_event,
                on_progress=on_progress,
            )
            if result.get("status") == "stopped":
                return result
            if not req.dry_run:
                record_operation(
                    action_type="drive_sync",
                    source=str(local_root),
                    destination=str(remote_root),
                    description=f"Synced all packages to remote drive (Copied: {result['copied_count']}, Updated: {result['updated_count']}, Deleted: {result['deleted_count']})",
                    details=result,
                )
                diff = compare_old_but_gold_paths(local_root, remote_root)
                save_old_but_gold_diff(diff)
            return result

        if not req.package:
            raise HTTPException(status_code=400, detail="Package name or sync_all=true is required.")

        result = sync_package_to_remote(
            req.package,
            local_root,
            remote_root,
            delete_remote_extra=req.delete_remote_extra,
            dry_run=req.dry_run,
            stop_event=stop_event,
            on_progress=on_progress,
        )
        if result.get("status") == "stopped":
            return result
        if not req.dry_run:
            record_operation(
                action_type="drive_sync",
                source=str(local_root / req.package),
                destination=str(remote_root / req.package),
                description=f"Synced package '{req.package}' to remote drive (Copied: {result['copied_count']}, Updated: {result['updated_count']}, Deleted: {result['deleted_count']})",
                details=result,
            )
            diff = compare_old_but_gold_paths(local_root, remote_root)
            save_old_but_gold_diff(diff)

        return result
    finally:
        operation_manager.finish("stopped" if stop_event.is_set() else "completed")


class ByteCompareRequest(BaseModel):
    local_path: str
    remote_path: str | None = None


@app.post("/api/compare/byte")
def compare_byte_paths(req: ByteCompareRequest):
    """Byte-by-byte comparison of two arbitrary directories."""
    local_path = Path(req.local_path)
    local_root = load_root_path()
    remote_root = _remote_old_but_gold_root()

    if not local_path.exists() or not local_path.is_dir():
        raise HTTPException(status_code=400, detail="The selected local folder does not exist.")

    if req.remote_path:
        remote_path = Path(req.remote_path)
    else:
        try:
            relative_path = local_path.resolve().relative_to(local_root.resolve())
        except ValueError as exc:
            raise HTTPException(
                status_code=400,
                detail=f"Select a folder inside the local old but gold directory: {local_root}",
            ) from exc
        remote_path = remote_root / relative_path

    if not remote_path.exists() or not remote_path.is_dir():
        raise HTTPException(
            status_code=404,
            detail=f"The matching folder does not exist on the hard drive: {remote_path}",
        )

    try:
        _, stop_event = operation_manager.start("byte_compare", "Byte-by-byte directory comparison")
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    try:
        def on_progress(processed: int, total: int, path: str) -> None:
            operation_manager.update(
                phase="byte_compare",
                processed=processed,
                total=total,
                current_path=path,
            )

        return compare_arbitrary_paths(
            local_path,
            remote_path,
            should_stop=stop_event.is_set,
            on_progress=on_progress,
        )
    finally:
        operation_manager.finish("stopped" if stop_event.is_set() else "completed")


@app.get("/api/browse-dirs")
def browse_dirs(path: str = ""):
    """Browse directories on the filesystem for the byte compare directory pickers."""
    target = Path(path) if path else Path.home()
    if not target.exists():
        return {"path": path, "dirs": [], "error": "Path not found"}

    try:
        dirs = sorted(
            [item.name for item in target.iterdir() if item.is_dir()],
            key=str.casefold,
        )
    except PermissionError:
        return {"path": path, "dirs": [], "error": "Permission denied"}

    return {"path": str(target), "parent": str(target.parent) if str(target.parent) != str(target) else None, "dirs": dirs}


class MoveSelectedRequest(BaseModel):
    package: str
    files: list[str]
    delete_files: list[str] | None = None


@app.post("/api/old-gold/move-selected")
def move_selected_to_remote(req: MoveSelectedRequest):
    """Copy local selections and delete selected remote-only files."""
    local_root = load_root_path()
    remote_root = _remote_old_but_gold_root()

    if not remote_root.exists():
        raise HTTPException(status_code=400, detail="Remote drive is not connected.")
    local_pkg = local_root / req.package
    remote_pkg = remote_root / req.package

    copied = []
    deleted = []
    errors = []
    for rel_path in req.files:
        src = local_pkg / rel_path
        dst = remote_pkg / rel_path
        if not src.exists():
            errors.append({"file": rel_path, "error": "Source not found"})
            continue
        try:
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(str(src), str(dst))
            copied.append(rel_path)
        except Exception as exc:
            errors.append({"file": rel_path, "error": str(exc)})

    for rel_path in req.delete_files or []:
        remote_file = remote_pkg / rel_path
        if not remote_file.exists():
            errors.append({"file": rel_path, "error": "Remote file not found"})
            continue
        try:
            if remote_file.is_dir():
                shutil.rmtree(remote_file)
            else:
                remote_file.unlink()
            deleted.append(rel_path)
        except Exception as exc:
            errors.append({"file": rel_path, "error": str(exc)})

    if copied or deleted:
        record_operation(
            action_type="drive_sync",
            source=str(local_pkg),
            destination=str(remote_pkg),
            description=f"Updated remote package '{req.package}' (copied {len(copied)}, deleted {len(deleted)}).",
            details={
                "copied": copied,
                "copied_count": len(copied),
                "deleted": deleted,
                "deleted_count": len(deleted),
                "updated_count": 0,
            },
        )
        diff = compare_old_but_gold_paths(local_root, remote_root)
        save_old_but_gold_diff(diff)

    return {
        "copied_count": len(copied),
        "copied": copied,
        "deleted_count": len(deleted),
        "deleted": deleted,
        "errors": errors,
    }

@app.get("/api/search/local")
def search_local(
    query: str = Query(..., min_length=1),
    sort_by: str = "match",
    descending: bool = False,
    folder: str | None = None,
    limit: int = 50,
):
    files = load_file_index()
    if folder:
        files = [f for f in files if f.get("folder", "").casefold() == folder.casefold()]

    results = search_file_index(query, files, limit=limit, sort_by=sort_by, descending=descending)
    return {"query": query, "count": len(results), "results": results}


@app.get("/api/search/remote")
def search_remote(
    query: str = Query(..., min_length=1),
    section: str = "all",
    source: str = "all",
    category: str = "all",
    limit: int = 50,
):
    catalog = load_remote_catalog_if_exists()
    if not catalog:
        return {"query": query, "count": 0, "results": []}

    results = search_remote_catalog(
        query,
        catalog,
        section=section,
        source=source,
        category=category,
        limit=limit,
    )
    return {
        "query": query,
        "count": len(results),
        "section": section,
        "source": source,
        "category": category,
        "results": results,
    }


@app.get("/api/search/unified")
def search_unified(query: str = Query(..., min_length=1), category: str = "all", limit: int = 40):
    files = [
        file for file in (load_file_index() if FILE_INDEX.exists() else [])
    ]
    local_res = search_file_index(query, files, limit=limit, sort_by="match")
    # Tag each local result with location
    for r in local_res:
        r["location"] = "local"

    catalog = load_remote_catalog_if_exists()
    remote_res = search_remote_catalog(query, catalog, category=category, limit=limit) if catalog else []
    # Tag each remote result with location
    for r in remote_res:
        r["location"] = "remote_drive" if r.get("remote_source") == "names" else "remote_catalog"

    # Also check which remote catalog items exist on the local drive
    local_names_set = {f.get("name", "").casefold() for f in files}
    for r in remote_res:
        r["also_in_local"] = r.get("name", "").casefold() in local_names_set

    return {
        "query": query,
        "local": {"count": len(local_res), "results": local_res},
        "remote": {"count": len(remote_res), "results": remote_res},
    }


@app.get("/api/entertainment")
async def get_entertainment(
    query: str = "",
    sort_by: str = "recommended",
    descending: bool = False,
    limit: int = 100,
):
    """Rank playable and previewable files from old but gold for the Entertainment tab."""
    root = load_root_path()
    results = await run_in_threadpool(
        scan_entertainment,
        root,
        query,
        sort_by,
        descending,
        limit,
    )
    return {
        "root": str(root),
        "excluded_path": str(root / "New folder"),
        "query": query,
        "count": len(results),
        "results": results,
        "thumbnails_available": is_thumbnail_generation_available(),
    }


@app.get("/api/entertainment/preview")
def entertainment_preview(path: str):
    root = load_root_path()
    try:
        target = preview_path(root, path)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Entertainment file was not found.") from exc
    return FileResponse(target, media_type=None, filename=target.name)


@app.get("/api/entertainment/thumbnail")
async def entertainment_thumbnail(path: str):
    """Generate and serve a thumbnail for a video file."""
    root = load_root_path()
    try:
        target = preview_path(root, path)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Entertainment file was not found.") from exc
    
    # Generate thumbnail asynchronously
    thumbnail_path = await run_in_threadpool(get_video_thumbnail, target)
    
    if thumbnail_path is None or not thumbnail_path.exists():
        # Return 404 if thumbnail generation failed (e.g., ffmpeg not available)
        # The frontend will handle this by showing the fallback gradient
        raise HTTPException(status_code=404, detail="Thumbnail generation failed or ffmpeg not available.")
    
    return FileResponse(
        thumbnail_path,
        media_type="image/jpeg",
        filename=thumbnail_path.name,
        headers={"Cache-Control": "public, max-age=86400, immutable"},
    )


@app.post("/api/entertainment/thumbnails/clear")
def clear_thumbnails():
    """Clear the video thumbnail cache."""
    count = clear_thumbnail_cache()
    return {"success": True, "deleted_count": count}


# ==========================================
# 7. Remote Catalog & To-Be-Downloaded
# ==========================================

@app.get("/api/remote-catalog")
def get_remote_catalog():
    cat = load_remote_catalog_if_exists()
    if not cat:
        return {"names": {}, "to_be_downloaded": {}, "sources": {}}
    return cat


@app.post("/api/remote-catalog/rebuild")
def rebuild_catalog_endpoint():
    drive_path, remote_folders = load_remote_config()
    local_folders = load_config()

    # Always preserve existing to-be-downloaded from ALL sources
    existing_catalog = load_remote_catalog_if_exists()
    if existing_catalog is not None and not drive_path.exists():
        return existing_catalog
    existing_downloads: dict[str, list[str]] | None = None
    if existing_catalog is not None:
        existing_downloads = existing_catalog.get("to_be_downloaded", {})
        if existing_catalog.get("to_be_downloaded_mode") != "manual" and not any(existing_downloads.values()):
            existing_downloads = None

    cat = build_remote_catalog(
        drive_path,
        remote_folders,
        local_folders,
        existing_to_be_downloaded=existing_downloads,
    )
    # Double-check: merge any persisted to-be-downloaded from Content/ JSON files
    if existing_catalog is not None and existing_catalog.get("to_be_downloaded"):
        merged_tbd = cat.get("to_be_downloaded", {})
        for sec, items in existing_catalog["to_be_downloaded"].items():
            existing_set = {i.casefold() for i in merged_tbd.get(sec, [])}
            for item in items:
                if item.casefold() not in existing_set:
                    merged_tbd.setdefault(sec, []).append(item)
        cat["to_be_downloaded"] = merged_tbd
        cat["to_be_downloaded_mode"] = "manual"

    save_remote_catalog(cat)
    return cat


class AddDownloadItemRequest(BaseModel):
    section: str
    names: list[str]


@app.post("/api/remote-catalog/add-download")
def add_to_be_downloaded(req: AddDownloadItemRequest):
    catalog = load_remote_catalog_if_exists()
    if catalog is None:
        drive_path, remote_folders = load_remote_config()
        catalog = build_remote_catalog(drive_path, remote_folders, load_config())

    downloads = catalog.setdefault("to_be_downloaded", {})
    section_downloads = downloads.setdefault(req.section, [])

    added_count = 0
    for name in req.names:
        clean = name.strip()
        if clean and clean not in section_downloads:
            section_downloads.append(clean)
            added_count += 1

    section_downloads.sort(key=str.casefold)
    catalog["to_be_downloaded_mode"] = "manual"

    if req.section in catalog.get("sources", {}):
        catalog["sources"][req.section]["to_be_downloaded_count"] = len(section_downloads)

    save_remote_catalog(catalog)
    return {
        "section": req.section,
        "added_count": added_count,
        "to_be_downloaded_count": len(section_downloads),
        "items": section_downloads,
    }


class RemoveDownloadItemRequest(BaseModel):
    section: str
    name: str


@app.post("/api/remote-catalog/remove-download")
def remove_to_be_downloaded(req: RemoveDownloadItemRequest):
    catalog = load_remote_catalog_if_exists()
    if not catalog:
        raise HTTPException(status_code=400, detail="Remote catalog not found.")

    section_downloads = catalog.get("to_be_downloaded", {}).get(req.section, [])
    target_norm = req.name.strip().casefold()
    new_list = [item for item in section_downloads if item.casefold() != target_norm]

    catalog["to_be_downloaded"][req.section] = new_list
    if req.section in catalog.get("sources", {}):
        catalog["sources"][req.section]["to_be_downloaded_count"] = len(new_list)

    save_remote_catalog(catalog)
    return {"section": req.section, "removed": req.name, "to_be_downloaded_count": len(new_list), "items": new_list}


# ==========================================
# 8. Name Audit & Spell Checker / Fixer
# ==========================================

@app.get("/api/audit/names")
def get_name_audit(scope: str = "all", limit: int | None = None):
    files = [
        file for file in load_file_index()
    ]
    audit_res = audit_file_index_names(files, scope=scope, limit=limit)
    ignored = load_ignored_audit()

    # Filter out ignored issues
    filtered_issues = []
    for issue in audit_res["issues"]:
        item_name = issue.get("name", "")
        if not is_audit_ignored(item_name, ignored):
            suggestions = [
                issue_detail.get("suggestion")
                for issue_detail in issue.get("issues", [])
                if issue_detail.get("suggestion")
            ]
            if suggestions:
                issue["suggested_name"] = suggestions[-1]
            filtered_issues.append(issue)

    return {
        **audit_res,
        "count": len(filtered_issues),
        "issues": filtered_issues,
        "ignored_count": len(ignored),
    }


class RenameItemRequest(BaseModel):
    type: str  # "file" or "package"
    folder: str
    path: str
    current_name: str
    new_name: str


class BatchRenameRequest(BaseModel):
    items: list[RenameItemRequest]


@app.post("/api/audit/rename")
def rename_audit_item(req: RenameItemRequest):
    root_path = load_root_path()
    local_folders = load_config()

    folder_root = (
        root_path
        if req.folder.casefold() in {"old but gold", "__root__"}
        else local_folders.get(req.folder.lower(), root_path / req.folder)
    )
    source_path = folder_root / req.path

    if not source_path.exists():
        # Fallback to direct root path
        source_path = root_path / req.folder / req.path

    if not source_path.exists():
        raise HTTPException(status_code=404, detail=f"Target path '{source_path}' does not exist on disk.")

    dest_path = source_path.parent / req.new_name
    if dest_path.exists():
        raise HTTPException(status_code=400, detail=f"Destination '{dest_path.name}' already exists.")

    try:
        source_path.rename(dest_path)

        # Record operation
        record_operation(
            action_type="audit_rename",
            source=str(source_path),
            destination=str(dest_path),
            description=f"Renamed '{req.current_name}' to '{req.new_name}' in {req.folder}",
            details={"type": req.type, "folder": req.folder, "old_name": req.current_name, "new_name": req.new_name},
        )

        # Update file_index.json
        _update_file_index_after_rename(req.folder, req.path, req.new_name, req.type == "package")

        return {"success": True, "old_name": req.current_name, "new_name": req.new_name}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/audit/rename-batch")
def rename_audit_batch(req: BatchRenameRequest):
    """Batch rename multiple files/packages at once."""
    root_path = load_root_path()
    local_folders = load_config()
    results = []

    for item in req.items:
        folder_root = (
            root_path
            if item.folder.casefold() in {"old but gold", "__root__"}
            else local_folders.get(item.folder.lower(), root_path / item.folder)
        )
        source_path = folder_root / item.path
        if not source_path.exists():
            source_path = root_path / item.folder / item.path

        if not source_path.exists():
            results.append({"source": item.path, "success": False, "error": "Not found"})
            continue

        dest_path = source_path.parent / item.new_name
        if dest_path.exists() and dest_path != source_path:
            results.append({"source": item.path, "success": False, "error": "Destination exists"})
            continue

        try:
            source_path.rename(dest_path)
            record_operation(
                action_type="audit_rename",
                source=str(source_path),
                destination=str(dest_path),
                description=f"Batch renamed '{item.current_name}' to '{item.new_name}' in {item.folder}",
                details={"type": item.type, "folder": item.folder, "old_name": item.current_name, "new_name": item.new_name},
            )
            _update_file_index_after_rename(item.folder, item.path, item.new_name, item.type == "package")
            results.append({"source": item.path, "success": True, "old_name": item.current_name, "new_name": item.new_name})
        except Exception as exc:
            results.append({"source": item.path, "success": False, "error": str(exc)})

    return {"results": results, "count": len(results)}


def _update_file_index_after_rename(folder: str, old_rel_path: str, new_name: str, is_package: bool):
    try:
        files = load_file_index()
        norm_folder = folder.casefold()

        for entry in files:
            if entry.get("folder", "").casefold() != norm_folder:
                continue
            entry_path = entry.get("path", "").replace("\\", "/")

            if not is_package:
                if entry_path.casefold() == old_rel_path.replace("\\", "/").casefold():
                    parts = entry_path.rsplit("/", 1)
                    new_rel = f"{parts[0]}/{new_name}" if len(parts) > 1 else new_name
                    entry["name"] = new_name
                    entry["path"] = new_rel
            else:
                prefix = old_rel_path.replace("\\", "/")
                if entry_path.startswith(prefix):
                    remainder = entry_path[len(prefix):]
                    parent_part = prefix.rsplit("/", 1)
                    new_prefix = f"{parent_part[0]}/{new_name}" if len(parent_part) > 1 else new_name
                    entry["path"] = f"{new_prefix}{remainder}"

        with FILE_INDEX.open("w", encoding="utf-8") as f:
            json.dump({"files": files}, f, indent=4, ensure_ascii=False)
    except Exception:
        pass


@app.get("/api/audit/ignore")
def get_audit_ignored():
    return {"ignored": sorted(load_ignored_audit(), key=str.casefold)}


@app.post("/api/audit/ignore")
def add_audit_ignore(req: IgnoreItemRequest):
    updated = add_ignored_audit(req.name)
    return {"ignored": sorted(updated, key=str.casefold)}


@app.delete("/api/audit/ignore/{name}")
def delete_audit_ignore(name: str):
    updated = remove_ignored_audit(name)
    return {"ignored": sorted(updated, key=str.casefold)}


# ==========================================
# 9. Global Rescan
# ==========================================

@app.post("/api/rescan-all")
def rescan_all():
    folders = load_config()
    folders["__root__"] = load_root_path()
    files = scan_all_folders(folders)
    save_files(files)

    if "videos" in folders and folders["videos"].exists():
        video_metadata = collect_video_folder_metadata(folders["videos"])
        save_video_metadata(video_metadata)

    return get_system_status()


# ==========================================
# 10. Open local files & package file-type stats
# ==========================================

VIDEO_OPEN_EXTENSIONS = {
    ".3gp", ".avi", ".flv", ".m4v", ".mkv", ".mov", ".mp4",
    ".mpeg", ".mpg", ".webm", ".wmv", ".ts", ".m2ts",
}
IMAGE_OPEN_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".tif", ".tiff", ".heic", ".jfif",
}
VLC_CANDIDATES = [
    Path(r"C:\Program Files\VideoLAN\VLC\vlc.exe"),
    Path(r"C:\Program Files (x86)\VideoLAN\VLC\vlc.exe"),
]


class OpenFileRequest(BaseModel):
    path: str
    folder: str | None = None
    absolute: bool = False


def _resolve_open_path(req: OpenFileRequest) -> Path:
    raw = Path(req.path)
    if req.absolute or raw.is_absolute():
        return raw.resolve()

    folders = load_config()
    if req.folder:
        folder_key = req.folder.casefold()
        if folder_key in {"old but gold", "__root__"}:
            return (load_root_path() / req.path).resolve()
        matched = next((path for name, path in folders.items() if name.casefold() == folder_key), None)
        if matched is None:
            raise HTTPException(status_code=404, detail=f"Unknown folder '{req.folder}'.")
        return (matched / req.path).resolve()

    # Fall back to searching file index for a unique relative path match
    root = load_root_path()
    candidate = (root / req.path).resolve()
    if candidate.exists():
        return candidate

    raise HTTPException(status_code=404, detail="File path could not be resolved.")


def _find_vlc() -> Path | None:
    for candidate in VLC_CANDIDATES:
        if candidate.exists():
            return candidate
    return None


@app.post("/api/open-file")
def open_local_file(req: OpenFileRequest):
    target = _resolve_open_path(req)
    if not target.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {target}")

    suffix = target.suffix.casefold()
    in_recordings = any(part.casefold() == "recordings" for part in target.parts)

    try:
        if suffix in VIDEO_OPEN_EXTENSIONS or (in_recordings and suffix in VIDEO_OPEN_EXTENSIONS | {".wav", ".mp3", ".m4a", ".aac", ".flac"}):
            vlc = _find_vlc()
            if vlc is not None:
                subprocess.Popen([str(vlc), str(target)], close_fds=True)
                return {"opened": True, "app": "vlc", "path": str(target)}

        if suffix in IMAGE_OPEN_EXTENSIONS:
            # Use the exact file association so Windows opens the selected image,
            # rather than launching Photos without a reliable file argument.
            os.startfile(str(target))  # type: ignore[attr-defined]
            return {"opened": True, "app": "default-image-viewer", "path": str(target)}

        os.startfile(str(target))  # type: ignore[attr-defined]
        return {"opened": True, "app": "default", "path": str(target)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to open file: {exc}") from exc


@app.get("/api/file-type-stats")
def get_file_type_stats(exclude_new_folder: bool = True):
    """Aggregate file-type statistics per package (similar shape to video analytics)."""
    files = load_file_index()
    folders = load_config()

    packages: dict[str, dict[str, Any]] = {}

    for entry in files:
        folder = entry.get("folder") or "unknown"
        if exclude_new_folder and folder.casefold().replace(" ", "_") == "new_folder":
            continue
        rel_path = entry.get("path") or entry.get("name") or ""
        normalized_path = rel_path.replace("\\", "/").strip("/")
        path_parts = normalized_path.split("/") if normalized_path else []
        package_name = "/".join(path_parts[:-1]) if len(path_parts) > 1 else folder
        key = f"{folder}/{package_name}" if package_name != folder else folder
        display_name = package_name
        folder_root = (
            load_root_path()
            if folder.casefold() in {"old but gold", "__root__"}
            else folders.get(str(folder).lower(), load_root_path() / str(folder))
        )
        local_package_path = folder_root / Path(*path_parts[:-1]) if len(path_parts) > 1 else folder_root

        pkg = packages.setdefault(key, {
            "id": key,
            "folder": folder,
            "name": display_name,
            "relative_path": package_name if package_name != folder else folder,
            "file_count": 0,
            "size_bytes": 0,
            "extensions": {},
            "files": [],
            "local_path": str(local_package_path),
        })
        ext = (entry.get("extension") or "<none>").casefold()
        size = int(entry.get("size_bytes") or 0)
        pkg["file_count"] += 1
        pkg["size_bytes"] += size
        pkg["extensions"][ext] = pkg["extensions"].get(ext, 0) + 1
        file_info = {
            "name": entry.get("name"),
            "path": entry.get("path"),
            "folder": folder,
            "extension": ext,
            "size_bytes": size,
            "size_readable": _format_size_bytes(size),
        }
        pkg["files"].append(file_info)

    package_list = []
    for pkg in packages.values():
        size = pkg["size_bytes"]
        package_list.append({
            **pkg,
            "size_readable": _format_size_bytes(size),
            "extensions": dict(sorted(pkg["extensions"].items(), key=lambda item: (-item[1], item[0]))),
            "extension_count": len(pkg["extensions"]),
            "top_extension": next(iter(sorted(pkg["extensions"].items(), key=lambda item: (-item[1], item[0]))), ("", 0))[0],
        })

    package_list.sort(key=lambda item: (-item["size_bytes"], item["name"].casefold()))

    folder_summary: dict[str, dict[str, Any]] = {}
    for pkg in package_list:
        folder = pkg["folder"]
        summary = folder_summary.setdefault(folder, {
            "folder": folder,
            "package_count": 0,
            "file_count": 0,
            "size_bytes": 0,
            "extensions": {},
            "files": [],
            "local_path": str(
                load_root_path()
                if folder.casefold() in {"old but gold", "__root__"}
                else folders.get(str(folder).lower(), load_root_path() / str(folder))
            ),
            "relative_path": folder,
        })
        summary["package_count"] += 1
        summary["file_count"] += pkg["file_count"]
        summary["size_bytes"] += pkg["size_bytes"]
        summary["files"].extend(pkg["files"])
        for ext, count in pkg["extensions"].items():
            summary["extensions"][ext] = summary["extensions"].get(ext, 0) + count

    for summary in folder_summary.values():
        summary["size_readable"] = _format_size_bytes(summary["size_bytes"])
        summary["extensions"] = dict(sorted(summary["extensions"].items(), key=lambda item: (-item[1], item[0])))

    total_size = sum(pkg["size_bytes"] for pkg in package_list)
    return {
        "generated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "package_count": len(package_list),
        "file_count": sum(pkg["file_count"] for pkg in package_list),
        "total_size_bytes": total_size,
        "total_size_readable": _format_size_bytes(total_size),
        "folders": sorted(folder_summary.values(), key=lambda item: (-item["size_bytes"], item["folder"])),
        "packages": package_list,
        "configured_folders": sorted(folders.keys()),
    }


def _format_size_bytes(size_bytes: int) -> str:
    units = ["B", "KB", "MB", "GB", "TB"]
    size = float(size_bytes)
    for unit in units:
        if size < 1024 or unit == units[-1]:
            return f"{size:.2f} {unit}" if unit != "B" else f"{size_bytes} B"
        size /= 1024
    return f"{size_bytes} B"


# ==========================================
# Mount Frontend Static Assets
# ==========================================

STATIC_DIR = Path(__file__).resolve().parent / "static"
if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
