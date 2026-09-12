from __future__ import annotations

import json
import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

try:
    from .config import load_config, load_remote_config, load_root_path
    from .downloads_ignore import add_ignored_name, load_ignored_names, remove_ignored_name
    from .downloads_plan import build_downloads_plan
    from .file_sort import SORT_OPTIONS, sort_files
    from .file_store import (
        FILE_INDEX,
        OLD_BUT_GOLD_DIFF,
        REMOTE_CATALOG,
        VIDEO_METADATA,
        load_file_index,
        load_remote_catalog,
        load_remote_catalog_if_exists,
        save_files,
        save_old_but_gold_diff,
        save_remote_catalog,
        save_video_metadata,
    )
    from .name_audit import audit_file_index_names
    from .old_but_gold_compare import compare_old_but_gold_paths, compare_package_content
    from .old_but_gold_sync import sync_all_to_remote, sync_package_to_remote
    from .operations import load_operations_log, record_operation, revert_operation
    from .audit_ignore import add_ignored_audit, is_audit_ignored, load_ignored_audit, remove_ignored_audit
    from .remote_catalog import build_remote_catalog
    from .remote_search import REMOTE_SECTIONS, REMOTE_SOURCES, search_remote_catalog
    from .scanner import scan_all_folders
    from .search import search_file_index
    from .video_metadata import collect_video_folder_metadata
except ImportError:
    from config import load_config, load_remote_config, load_root_path
    from downloads_ignore import add_ignored_name, load_ignored_names, remove_ignored_name
    from downloads_plan import build_downloads_plan
    from file_sort import SORT_OPTIONS, sort_files
    from file_store import (
        FILE_INDEX,
        OLD_BUT_GOLD_DIFF,
        REMOTE_CATALOG,
        VIDEO_METADATA,
        load_file_index,
        load_remote_catalog,
        load_remote_catalog_if_exists,
        save_files,
        save_old_but_gold_diff,
        save_remote_catalog,
        save_video_metadata,
    )
    from name_audit import audit_file_index_names
    from old_but_gold_compare import compare_old_but_gold_paths, compare_package_content
    from old_but_gold_sync import sync_all_to_remote, sync_package_to_remote
    from operations import load_operations_log, record_operation, revert_operation
    from audit_ignore import add_ignored_audit, is_audit_ignored, load_ignored_audit, remove_ignored_audit
    from remote_catalog import build_remote_catalog
    from remote_search import REMOTE_SECTIONS, REMOTE_SOURCES, search_remote_catalog
    from scanner import scan_all_folders
    from search import search_file_index
    from video_metadata import collect_video_folder_metadata

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
    drive_root = Path(f"{drive_path.drive}\\\\") if drive_path.drive else drive_path
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


# ==========================================
# 2. Activity / Operations History & Revert
# ==========================================

@app.get("/api/history")
def get_operations_history():
    return {"operations": load_operations_log()}


@app.post("/api/history/revert/{op_id}")
def revert_op(op_id: str):
    success, message = revert_operation(op_id)
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
        }

    # Sort by height / quality
    def quality_key(v):
        return v.get("quality", {}).get("height") or 0

    sorted_by_quality = sorted(videos, key=quality_key)
    sorted_by_size = sorted(videos, key=lambda v: v.get("size_bytes", 0))

    highest_q = sorted_by_quality[-1] if sorted_by_quality else None
    lowest_q = sorted_by_quality[0] if sorted_by_quality else None
    highest_s = sorted_by_size[-1] if sorted_by_size else None
    lowest_s = sorted_by_size[0] if sorted_by_size else None

    return {
        **package,
        "highest_quality_video": {
            "name": highest_q["name"],
            "resolution": highest_q.get("quality", {}).get("resolution"),
            "quality_label": highest_q.get("quality", {}).get("quality_label") or "Unknown",
            "size_readable": highest_q.get("size_readable"),
            "path": highest_q.get("path"),
        } if highest_q else None,
        "lowest_quality_video": {
            "name": lowest_q["name"],
            "resolution": lowest_q.get("quality", {}).get("resolution"),
            "quality_label": lowest_q.get("quality", {}).get("quality_label") or "Unknown",
            "size_readable": lowest_q.get("size_readable"),
            "path": lowest_q.get("path"),
        } if lowest_q else None,
        "highest_file_size_video": {
            "name": highest_s["name"],
            "size_bytes": highest_s["size_bytes"],
            "size_readable": highest_s["size_readable"],
            "resolution": highest_s.get("quality", {}).get("resolution"),
            "quality_label": highest_s.get("quality", {}).get("quality_label") or "Unknown",
            "path": highest_s.get("path"),
        } if highest_s else None,
        "lowest_file_size_video": {
            "name": lowest_s["name"],
            "size_bytes": lowest_s["size_bytes"],
            "size_readable": lowest_s["size_readable"],
            "resolution": lowest_s.get("quality", {}).get("resolution"),
            "quality_label": lowest_s.get("quality", {}).get("quality_label") or "Unknown",
            "path": lowest_s.get("path"),
        } if lowest_s else None,
    }


@app.get("/api/video-metadata")
def get_video_metadata():
    if not VIDEO_METADATA.exists():
        return {"packages": [], "quality_counts": {}, "total_size_readable": "0 B", "package_count": 0}
    with VIDEO_METADATA.open("r", encoding="utf-8") as f:
        data = json.load(f)

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
            # Record operation
            record_operation(
                action_type="download_move",
                source=str(src),
                destination=str(dest_file),
                description=f"Moved '{src.name}' to '{item.target_package}/{item.target_name}'",
                details={
                    "package": item.target_package,
                    "target_name": item.target_name,
                    "is_directory": dest_file.is_dir(),
                    "size_bytes": dest_file.stat().st_size if dest_file.is_file() else 0,
                },
            )
            results.append({"source": str(src), "destination": str(dest_file), "success": True})
        except Exception as exc:
            results.append({"source": str(src), "success": False, "error": str(exc)})

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


# ==========================================
# 5. Local Old But Gold <-> Hard Drive (D:)
# ==========================================

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
    delete_remote_extra: bool = False
    dry_run: bool = False


@app.post("/api/old-gold/sync")
def sync_old_gold(req: SyncRequest):
    local_root = load_root_path()
    remote_root = _remote_old_but_gold_root()

    if req.sync_all:
        result = sync_all_to_remote(
            local_root,
            remote_root,
            delete_remote_extra=req.delete_remote_extra,
            dry_run=req.dry_run,
        )
        if not req.dry_run:
            record_operation(
                action_type="drive_sync",
                source=str(local_root),
                destination=str(remote_root),
                description=f"Synced all packages to remote drive (Copied: {result['copied_count']}, Updated: {result['updated_count']}, Deleted: {result['deleted_count']})",
                details=result,
            )
            # update diff
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
    )
    if not req.dry_run:
        record_operation(
            action_type="drive_sync",
            source=str(local_root / req.package),
            destination=str(remote_root / req.package),
            description=f"Synced package '{req.package}' to remote drive (Copied: {result['copied_count']}, Updated: {result['updated_count']}, Deleted: {result['deleted_count']})",
            details=result,
        )
        # update diff
        diff = compare_old_but_gold_paths(local_root, remote_root)
        save_old_but_gold_diff(diff)

    return result


# ==========================================
# 6. Universal Search Hub
# ==========================================

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
    limit: int = 50,
):
    catalog = load_remote_catalog_if_exists()
    if not catalog:
        return {"query": query, "count": 0, "results": []}

    results = search_remote_catalog(query, catalog, section=section, source=source, limit=limit)
    return {"query": query, "count": len(results), "section": section, "source": source, "results": results}


@app.get("/api/search/unified")
def search_unified(query: str = Query(..., min_length=1), limit: int = 40):
    files = load_file_index() if FILE_INDEX.exists() else []
    local_res = search_file_index(query, files, limit=limit, sort_by="match")

    catalog = load_remote_catalog_if_exists()
    remote_res = search_remote_catalog(query, catalog, limit=limit) if catalog else []

    return {
        "query": query,
        "local": {"count": len(local_res), "results": local_res},
        "remote": {"count": len(remote_res), "results": remote_res},
    }


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
    existing_catalog = load_remote_catalog_if_exists()
    existing_downloads = None
    if existing_catalog is not None and existing_catalog.get("to_be_downloaded_mode") == "manual":
        existing_downloads = existing_catalog.get("to_be_downloaded")

    cat = build_remote_catalog(
        drive_path,
        remote_folders,
        local_folders,
        existing_to_be_downloaded=existing_downloads,
    )
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
    files = load_file_index()
    audit_res = audit_file_index_names(files, scope=scope, limit=limit)
    ignored = load_ignored_audit()

    # Filter out ignored issues
    filtered_issues = []
    for issue in audit_res["issues"]:
        item_name = issue.get("name", "")
        if not is_audit_ignored(item_name, ignored):
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

    folder_root = local_folders.get(req.folder.lower(), root_path / req.folder)
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
    files = scan_all_folders(folders)
    save_files(files)

    if "videos" in folders and folders["videos"].exists():
        video_metadata = collect_video_folder_metadata(folders["videos"])
        save_video_metadata(video_metadata)

    return get_system_status()


# ==========================================
# Mount Frontend Static Assets
# ==========================================

STATIC_DIR = Path(__file__).resolve().parent / "static"
if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
