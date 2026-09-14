import argparse
import json
from pathlib import Path

try:
    from .config import load_config, load_remote_config, load_root_path
    from .file_sort import SORT_OPTIONS, sort_files
    from .file_store import (
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
    from .remote_catalog import build_remote_catalog
    from .remote_search import REMOTE_SECTIONS, REMOTE_SOURCES, search_remote_catalog
    from .scanner import scan_all_folders
    from .search import search_file_index
    from .video_metadata import collect_video_folder_metadata
    from .gui import main as run_gui
except ImportError:
    from config import load_config, load_remote_config, load_root_path
    from file_sort import SORT_OPTIONS, sort_files
    from file_store import (
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
    from remote_catalog import build_remote_catalog
    from remote_search import REMOTE_SECTIONS, REMOTE_SOURCES, search_remote_catalog
    from scanner import scan_all_folders
    from search import search_file_index
    from video_metadata import collect_video_folder_metadata
    from gui import main as run_gui


def main():
    parser = _build_parser()
    args = parser.parse_args()

    if args.command == "gui":
        gui_args = []
        if getattr(args, "host", None):
            gui_args.extend(["--host", args.host])
        if getattr(args, "port", None):
            gui_args.extend(["--port", str(args.port)])
        if getattr(args, "no_browser", False):
            gui_args.append("--no-browser")
        if getattr(args, "reload", False):
            gui_args.append("--reload")
        run_gui(gui_args)
        return

    if args.command == "search":
        _run_search(args.query, args.limit, args.sort, args.desc)
        return

    if args.command == "list":
        _run_list(args.limit, args.sort, args.desc)
        return

    if args.command == "audit-names":
        _run_name_audit(args.scope, args.limit)
        return

    if args.command == "remote-catalog":
        _run_remote_catalog()
        return

    if args.command == "remote-search":
        _run_remote_search(args.query, args.limit, args.section, args.source)
        return

    if args.command == "remote-add-download":
        _run_remote_add_download(args.section, args.name)
        return

    if args.command == "old-gold-diff":
        _run_old_gold_diff()
        return

    if args.command == "old-gold-compare":
        _run_old_gold_compare(args.package)
        return

    if args.command == "old-gold-sync":
        _run_old_gold_sync(
            args.package,
            args.all,
            args.delete_remote_extra,
            args.dry_run,
        )
        return

    _build_indexes()


def _build_indexes() -> None:
    folders = load_config()
    folders["__root__"] = load_root_path()
    files = scan_all_folders(folders)

    save_files(files)

    if "videos" in folders:
        video_metadata = collect_video_folder_metadata(folders["videos"])
        save_video_metadata(video_metadata)


def _run_search(query: str, limit: int, sort_by: str, descending: bool) -> None:
    results = search_file_index(
        query,
        load_file_index(),
        limit=limit,
        sort_by=sort_by,
        descending=descending,
    )

    print(json.dumps(
        {"query": query, "count": len(results), "results": results},
        indent=4,
        ensure_ascii=False,
    ))


def _run_list(limit: int, sort_by: str, descending: bool) -> None:
    files = sort_files(load_file_index(), sort_by=sort_by, descending=descending)[:limit]

    print(json.dumps(
        {"count": len(files), "sort": sort_by, "descending": descending, "files": files},
        indent=4,
        ensure_ascii=False,
    ))


def _run_name_audit(scope: str, limit: int | None) -> None:
    audit = audit_file_index_names(load_file_index(), scope=scope, limit=limit)

    print(json.dumps(audit, indent=4, ensure_ascii=False))


def _run_remote_catalog() -> None:
    drive_path, remote_folders = load_remote_config()
    local_folders = load_config()
    existing_catalog = load_remote_catalog_if_exists()
    if existing_catalog is not None and not drive_path.exists():
        print(json.dumps(existing_catalog, indent=4, ensure_ascii=False))
        return
    existing_downloads = None
    if (
        existing_catalog is not None
        and existing_catalog.get("to_be_downloaded_mode") == "manual"
    ):
        existing_downloads = existing_catalog.get("to_be_downloaded")

    catalog = build_remote_catalog(
        drive_path,
        remote_folders,
        local_folders,
        existing_to_be_downloaded=existing_downloads,
    )
    save_remote_catalog(catalog)

    print(json.dumps(catalog, indent=4, ensure_ascii=False))


def _run_remote_search(query: str, limit: int, section: str, source: str) -> None:
    results = search_remote_catalog(
        query,
        load_remote_catalog(),
        section=section,
        source=source,
        limit=limit,
    )

    print(json.dumps(
        {
            "query": query,
            "count": len(results),
            "section": section,
            "source": source,
            "results": results,
        },
        indent=4,
        ensure_ascii=False,
    ))


def _run_remote_add_download(section: str, name: str) -> None:
    catalog = load_remote_catalog_if_exists()
    if catalog is None:
        drive_path, remote_folders = load_remote_config()
        catalog = build_remote_catalog(drive_path, remote_folders, load_config())

    downloads = catalog.setdefault("to_be_downloaded", {})
    section_downloads = downloads.setdefault(section, [])

    already_exists = name in section_downloads
    if not already_exists:
        section_downloads.append(name)
        section_downloads.sort(key=str.casefold)

    catalog["to_be_downloaded_mode"] = "manual"

    if section in catalog.get("sources", {}):
        catalog["sources"][section]["to_be_downloaded_count"] = len(section_downloads)

    save_remote_catalog(catalog)

    print(json.dumps(
        {
            "section": section,
            "inserted": name,
            "already_exists": already_exists,
            "to_be_downloaded_count": len(section_downloads),
            "to_be_downloaded": section_downloads,
        },
        indent=4,
        ensure_ascii=False,
    ))


def _remote_old_but_gold_root() -> Path:
    drive_path, _ = load_remote_config()

    drive_root = Path(f"{drive_path.drive}\\") if drive_path.drive else drive_path

    return drive_root / "old but gold"


def _run_old_gold_diff() -> None:
    diff = compare_old_but_gold_paths(load_root_path(), _remote_old_but_gold_root())
    save_old_but_gold_diff(diff)

    print(json.dumps(diff, indent=4, ensure_ascii=False))


def _run_old_gold_compare(package: str) -> None:
    comparison = compare_package_content(package, load_root_path(), _remote_old_but_gold_root())

    print(json.dumps(comparison, indent=4, ensure_ascii=False))


def _run_old_gold_sync(
    package: str | None,
    sync_all: bool,
    delete_remote_extra: bool,
    dry_run: bool,
) -> None:
    local_root = load_root_path()
    remote_root = _remote_old_but_gold_root()

    if sync_all:
        result = sync_all_to_remote(
            local_root,
            remote_root,
            delete_remote_extra=delete_remote_extra,
            dry_run=dry_run,
        )
    else:
        result = sync_package_to_remote(
            package,
            local_root,
            remote_root,
            delete_remote_extra=delete_remote_extra,
            dry_run=dry_run,
        )

    print(json.dumps(result, indent=4, ensure_ascii=False))


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Index and search local files.")
    subparsers = parser.add_subparsers(dest="command")

    gui_parser = subparsers.add_parser("gui", help="Launch the modern Web GUI interface")
    gui_parser.add_argument("--host", default="127.0.0.1", help="Host address")
    gui_parser.add_argument("--port", type=int, default=8000, help="Port number")
    gui_parser.add_argument("--no-browser", action="store_true", help="Do not automatically open the browser")
    gui_parser.add_argument("--reload", action="store_true", help="Enable auto-reload for development")

    search_parser = subparsers.add_parser("search", help="Search file_index.json")
    search_parser.add_argument("query", help="Search text")
    search_parser.add_argument(
        "--sort",
        choices=sorted(SORT_OPTIONS),
        default="match",
        help="Sort search results",
    )
    search_parser.add_argument(
        "--limit",
        type=int,
        default=20,
        help="Maximum number of results to return",
    )
    search_parser.add_argument(
        "--desc",
        action="store_true",
        help="Sort descending. Match sorting is descending by default.",
    )

    list_parser = subparsers.add_parser("list", help="List sorted files from file_index.json")
    list_parser.add_argument(
        "--sort",
        choices=sorted(SORT_OPTIONS - {"match"}),
        default="name",
        help="Sort files",
    )
    list_parser.add_argument(
        "--limit",
        type=int,
        default=20,
        help="Maximum number of files to return",
    )
    list_parser.add_argument(
        "--desc",
        action="store_true",
        help="Sort descending",
    )

    audit_parser = subparsers.add_parser(
        "audit-names",
        help="Find suspicious file and package names in file_index.json",
    )
    audit_parser.add_argument(
        "--scope",
        choices=["all", "files", "packages"],
        default="all",
        help="Choose whether to check files, packages, or both",
    )
    audit_parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Maximum number of issues to return",
    )

    subparsers.add_parser(
        "remote-catalog",
        help="Catalog selected names from the optional remote drive",
    )

    remote_search_parser = subparsers.add_parser(
        "remote-search",
        help="Search remote_catalog.json",
    )
    remote_search_parser.add_argument("query", help="Search text")
    remote_search_parser.add_argument(
        "--section",
        choices=sorted(REMOTE_SECTIONS),
        default="all",
        help="Remote section to search",
    )
    remote_search_parser.add_argument(
        "--source",
        choices=sorted(REMOTE_SOURCES),
        default="all",
        help="Search all remote names or only to_be_downloaded",
    )
    remote_search_parser.add_argument(
        "--limit",
        type=int,
        default=20,
        help="Maximum number of results to return",
    )

    remote_add_parser = subparsers.add_parser(
        "remote-add-download",
        help="Add one string to a remote to_be_downloaded section",
    )
    remote_add_parser.add_argument(
        "section",
        choices=sorted(REMOTE_SECTIONS - {"all"}),
        help="Remote section to update",
    )
    remote_add_parser.add_argument("name", help="Name to add as a plain string")

    subparsers.add_parser(
        "old-gold-diff",
        help="Compare local old but gold with D:/old but gold by case-sensitive relative paths",
    )

    old_gold_compare_parser = subparsers.add_parser(
        "old-gold-compare",
        help="Compare file content byte-for-byte for one old but gold package",
    )
    old_gold_compare_parser.add_argument(
        "package",
        help="Top-level package name to compare, for example videos or Anime",
    )

    old_gold_sync_parser = subparsers.add_parser(
        "old-gold-sync",
        help="Copy local old but gold changes to D:/old but gold",
    )
    old_gold_sync_target = old_gold_sync_parser.add_mutually_exclusive_group(required=True)
    old_gold_sync_target.add_argument(
        "--package",
        help="Top-level package name to sync, for example videos or Anime",
    )
    old_gold_sync_target.add_argument(
        "--all",
        action="store_true",
        help="Sync every top-level local package",
    )
    old_gold_sync_parser.add_argument(
        "--delete-remote-extra",
        action="store_true",
        help="Delete files that exist only on the hard drive",
    )
    old_gold_sync_parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show planned changes without copying or deleting files",
    )

    return parser


if __name__ == "__main__":
    main()
