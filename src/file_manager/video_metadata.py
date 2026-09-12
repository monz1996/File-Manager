from __future__ import annotations

import subprocess
from datetime import datetime
from pathlib import Path
from typing import BinaryIO


VIDEO_EXTENSIONS = {
    ".3gp",
    ".avi",
    ".flv",
    ".m4v",
    ".mkv",
    ".mov",
    ".mp4",
    ".mpeg",
    ".mpg",
    ".webm",
    ".wmv",
}

MP4_EXTENSIONS = {".m4v", ".mov", ".mp4"}


def collect_video_folder_metadata(videos_folder: Path) -> dict:
    packages = []

    for package_path in sorted(videos_folder.iterdir(), key=lambda path: path.name.casefold()):
        if not package_path.is_dir():
            continue

        package_files = [path for path in package_path.rglob("*") if path.is_file()]
        video_files = [
            path for path in package_files
            if path.suffix.casefold() in VIDEO_EXTENSIONS
        ]

        videos = [_build_video_entry(path, videos_folder) for path in sorted(video_files)]
        total_size_bytes = sum(path.stat().st_size for path in package_files)
        total_video_size_bytes = sum(path.stat().st_size for path in video_files)
        known_durations = [
            video["duration_seconds"]
            for video in videos
            if video["duration_seconds"] is not None
        ]
        known_quality_count = sum(
            1 for video in videos
            if video["quality"]["width"] is not None and video["quality"]["height"] is not None
        )

        packages.append({
            "name": package_path.name,
            "path": package_path.relative_to(videos_folder).as_posix(),
            "size_bytes": total_size_bytes,
            "size_readable": _format_bytes(total_size_bytes),
            "video_size_bytes": total_video_size_bytes,
            "video_size_readable": _format_bytes(total_video_size_bytes),
            "file_count": len(package_files),
            "video_count": len(video_files),
            "other_file_count": len(package_files) - len(video_files),
            "extensions": _count_extensions(package_files),
            "total_duration_seconds": round(sum(known_durations), 3),
            "total_duration_readable": _format_duration(sum(known_durations)),
            "videos_with_known_duration": len(known_durations),
            "videos_with_known_quality": known_quality_count,
            "quality_counts": _count_quality_labels(videos),
            "videos": videos,
        })

    total_size_bytes = sum(package["size_bytes"] for package in packages)
    total_duration_seconds = sum(package["total_duration_seconds"] for package in packages)

    return {
        "generated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "source_folder": str(videos_folder),
        "package_count": len(packages),
        "total_size_bytes": total_size_bytes,
        "total_size_readable": _format_bytes(total_size_bytes),
        "video_file_count": sum(package["video_count"] for package in packages),
        "total_duration_seconds": round(total_duration_seconds, 3),
        "total_duration_readable": _format_duration(total_duration_seconds),
        "videos_with_known_quality": sum(
            package["videos_with_known_quality"] for package in packages
        ),
        "quality_counts": _merge_quality_counts(packages),
        "packages": packages,
    }


def _build_video_entry(path: Path, videos_folder: Path) -> dict:
    stat = path.stat()
    duration_seconds = _get_video_duration_seconds(path)
    quality = _get_video_quality_metadata(path, stat.st_size, duration_seconds)

    return {
        "name": path.name,
        "path": path.relative_to(videos_folder).as_posix(),
        "extension": path.suffix.casefold(),
        "size_bytes": stat.st_size,
        "size_readable": _format_bytes(stat.st_size),
        "duration_seconds": duration_seconds,
        "duration_readable": _format_duration(duration_seconds),
        "quality": quality,
        "created_at": datetime.fromtimestamp(stat.st_ctime).astimezone().isoformat(timespec="seconds"),
        "modified_at": datetime.fromtimestamp(stat.st_mtime).astimezone().isoformat(timespec="seconds"),
    }


def _get_video_duration_seconds(path: Path) -> float | None:
    if path.suffix.casefold() not in MP4_EXTENSIONS:
        return _read_windows_shell_duration_seconds(path)

    try:
        return _read_mp4_duration_seconds(path)
    except (OSError, ValueError, ZeroDivisionError):
        return _read_windows_shell_duration_seconds(path)


def _read_mp4_duration_seconds(path: Path) -> float | None:
    with path.open("rb") as file:
        file_size = path.stat().st_size

        for atom_type, content_start, atom_end in _iter_atoms(file, 0, file_size):
            if atom_type != b"moov":
                continue

            return _read_mvhd_duration_seconds(file, content_start, atom_end)

    return None


def _read_mvhd_duration_seconds(file: BinaryIO, start: int, end: int) -> float | None:
    for atom_type, content_start, atom_end in _iter_atoms(file, start, end):
        if atom_type != b"mvhd":
            continue

        file.seek(content_start)
        version = file.read(1)
        file.read(3)

        if version == b"\x01":
            file.read(16)
            timescale = int.from_bytes(file.read(4), "big")
            duration = int.from_bytes(file.read(8), "big")
        else:
            file.read(8)
            timescale = int.from_bytes(file.read(4), "big")
            duration = int.from_bytes(file.read(4), "big")

        if timescale <= 0 or file.tell() > atom_end:
            return None

        return round(duration / timescale, 3)

    return None


def _get_video_quality_metadata(
    path: Path,
    size_bytes: int,
    duration_seconds: float | None,
) -> dict:
    dimensions = _get_video_dimensions(path)
    width, height = dimensions if dimensions is not None else (None, None)
    bitrate_kbps = _estimate_bitrate_kbps(size_bytes, duration_seconds)

    return {
        "width": width,
        "height": height,
        "resolution": _format_resolution(width, height),
        "quality_label": _quality_label(height),
        "aspect_ratio": _aspect_ratio(width, height),
        "estimated_total_bitrate_kbps": bitrate_kbps,
    }


def _get_video_dimensions(path: Path) -> tuple[int, int] | None:
    if path.suffix.casefold() not in MP4_EXTENSIONS:
        return _read_windows_shell_dimensions(path)

    try:
        return _read_mp4_dimensions(path)
    except (OSError, ValueError):
        return _read_windows_shell_dimensions(path)


def _read_mp4_dimensions(path: Path) -> tuple[int, int] | None:
    with path.open("rb") as file:
        file_size = path.stat().st_size

        for atom_type, content_start, atom_end in _iter_atoms(file, 0, file_size):
            if atom_type != b"moov":
                continue

            dimensions = _read_moov_dimensions(file, content_start, atom_end)
            if dimensions is not None:
                return dimensions

    return None


def _read_moov_dimensions(file: BinaryIO, start: int, end: int) -> tuple[int, int] | None:
    for atom_type, content_start, atom_end in _iter_atoms(file, start, end):
        if atom_type != b"trak":
            continue

        dimensions = _read_trak_dimensions(file, content_start, atom_end)
        if dimensions is not None:
            return dimensions

    return None


def _read_trak_dimensions(file: BinaryIO, start: int, end: int) -> tuple[int, int] | None:
    for atom_type, content_start, atom_end in _iter_atoms(file, start, end):
        if atom_type != b"tkhd":
            continue

        dimensions = _read_tkhd_dimensions(file, content_start, atom_end)
        if dimensions is not None:
            return dimensions

    return None


def _read_tkhd_dimensions(file: BinaryIO, start: int, end: int) -> tuple[int, int] | None:
    file.seek(start)
    version = file.read(1)
    file.read(3)

    dimensions_offset = start + (88 if version == b"\x01" else 76)
    if dimensions_offset + 8 > end:
        return None

    file.seek(dimensions_offset)
    width = int.from_bytes(file.read(4), "big") / 65536
    height = int.from_bytes(file.read(4), "big") / 65536

    if width <= 0 or height <= 0:
        return None

    return round(width), round(height)


def _iter_atoms(file: BinaryIO, start: int, end: int):
    position = start

    while position + 8 <= end:
        file.seek(position)
        size_bytes = file.read(4)
        atom_type = file.read(4)

        if len(size_bytes) < 4 or len(atom_type) < 4:
            break

        atom_size = int.from_bytes(size_bytes, "big")
        header_size = 8

        if atom_size == 1:
            atom_size = int.from_bytes(file.read(8), "big")
            header_size = 16
        elif atom_size == 0:
            atom_size = end - position

        atom_end = position + atom_size
        content_start = position + header_size

        if atom_size < header_size or atom_end > end:
            break

        yield atom_type, content_start, atom_end

        position = atom_end


def _read_windows_shell_duration_seconds(path: Path) -> float | None:
    command = (
        "$path = $args[0]; "
        "$shell = New-Object -ComObject Shell.Application; "
        "$folder = $shell.Namespace((Split-Path -LiteralPath $path)); "
        "$item = $folder.ParseName((Split-Path -Leaf $path)); "
        "$folder.GetDetailsOf($item, 27)"
    )

    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-Command", command, str(path)],
            capture_output=True,
            check=False,
            encoding="utf-8",
            errors="ignore",
            text=True,
            timeout=10,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None

    if result.returncode != 0:
        return None

    return _parse_duration((result.stdout or "").strip())


def _read_windows_shell_dimensions(path: Path) -> tuple[int, int] | None:
    command = (
        "$path = $args[0]; "
        "$shell = New-Object -ComObject Shell.Application; "
        "$folder = $shell.Namespace((Split-Path -LiteralPath $path)); "
        "$item = $folder.ParseName((Split-Path -Leaf $path)); "
        "$width = $folder.GetDetailsOf($item, 316); "
        "$height = $folder.GetDetailsOf($item, 314); "
        "Write-Output \"$width,$height\""
    )

    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-Command", command, str(path)],
            capture_output=True,
            check=False,
            encoding="utf-8",
            errors="ignore",
            text=True,
            timeout=10,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None

    if result.returncode != 0:
        return None

    parts = (result.stdout or "").strip().split(",")
    if len(parts) != 2:
        return None

    width = _parse_int(parts[0])
    height = _parse_int(parts[1])

    if width is None or height is None:
        return None

    return width, height


def _parse_duration(duration: str) -> float | None:
    parts = duration.split(":")

    if len(parts) != 3 or not all(part.isdigit() for part in parts):
        return None

    hours, minutes, seconds = (int(part) for part in parts)

    return float(hours * 3600 + minutes * 60 + seconds)


def _parse_int(value: str) -> int | None:
    digits = "".join(character for character in value if character.isdigit())

    if not digits:
        return None

    return int(digits)


def _estimate_bitrate_kbps(size_bytes: int, duration_seconds: float | None) -> int | None:
    if duration_seconds is None or duration_seconds <= 0:
        return None

    return round((size_bytes * 8) / duration_seconds / 1000)


def _format_resolution(width: int | None, height: int | None) -> str | None:
    if width is None or height is None:
        return None

    return f"{width}x{height}"


def _quality_label(height: int | None) -> str | None:
    if height is None:
        return None

    if height >= 2160:
        return "4K"
    if height >= 1440:
        return "1440p"
    if height >= 1080:
        return "1080p"
    if height >= 720:
        return "720p"
    if height >= 480:
        return "480p"
    if height >= 360:
        return "360p"

    return f"{height}p"


def _aspect_ratio(width: int | None, height: int | None) -> str | None:
    if width is None or height is None or height <= 0:
        return None

    def gcd(left: int, right: int) -> int:
        while right:
            left, right = right, left % right
        return left

    divisor = gcd(width, height)

    return f"{width // divisor}:{height // divisor}"


def _count_quality_labels(videos: list[dict]) -> dict[str, int]:
    counts: dict[str, int] = {}

    for video in videos:
        label = video["quality"]["quality_label"] or "unknown"
        counts[label] = counts.get(label, 0) + 1

    return dict(sorted(counts.items()))


def _merge_quality_counts(packages: list[dict]) -> dict[str, int]:
    counts: dict[str, int] = {}

    for package in packages:
        for label, count in package["quality_counts"].items():
            counts[label] = counts.get(label, 0) + count

    return dict(sorted(counts.items()))


def _count_extensions(files: list[Path]) -> dict[str, int]:
    counts: dict[str, int] = {}

    for path in files:
        extension = path.suffix.casefold() or "<none>"
        counts[extension] = counts.get(extension, 0) + 1

    return dict(sorted(counts.items()))


def _format_bytes(size_bytes: int) -> str:
    units = ["B", "KB", "MB", "GB", "TB"]
    size = float(size_bytes)

    for unit in units:
        if size < 1024 or unit == units[-1]:
            return f"{size:.2f} {unit}" if unit != "B" else f"{size_bytes} B"
        size /= 1024

    return f"{size_bytes} B"


def _format_duration(seconds: float | None) -> str | None:
    if seconds is None:
        return None

    rounded_seconds = int(round(seconds))
    hours, remainder = divmod(rounded_seconds, 3600)
    minutes, seconds = divmod(remainder, 60)

    return f"{hours:02}:{minutes:02}:{seconds:02}"
