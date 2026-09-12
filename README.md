# File-Manager &bull; Modern Media Hub & Synchronization System

A high-performance file management, video analytics, spelling auditor, and synchronization system built for local media collections and external hard drive backups.

---

## 🚀 Launch the Modern Web GUI

Start the web application with a single command (automatically launches in your default browser at `http://localhost:8000`):

```powershell
uv run file-manager gui
```

or directly:

```powershell
uv run file-manager-gui
```

---

## 🌟 Web GUI Features (7 Core Tabs)

1. **Activity Log & Revert**:
   - Live transaction log of all file moves (Downloads &rarr; Local), Hard Drive synchronizations (Local &rarr; D:), and disk rename corrections.
   - **1-Click Revert**: Revert any move or rename operation back to its original location/name instantly.
2. **Video Quality & Analytics**:
   - Automatic video metadata analyzer (resolution, bitrate, duration, aspect ratio).
   - Interactive Chart.js visualizations (Video Quality Doughnut breakdown & Top Package Sizes stacked bar chart).
   - Package Cards detailing **Highest/Lowest Quality video**, **Largest/Smallest file size**, file counts, and cumulative duration.
   - Deep-dive video inspector table modal.
3. **Downloads &rarr; Local "Old But Gold" Sync**:
   - Heuristic organizer with automatic junk/release tag stripping.
   - Interactive inline target package and filename editor.
   - Collision detection & warning.
   - Batch and single file moves with transaction tracking.
   - Persistent ignore list for download files.
4. **Local &harr; Hard Drive (D:) Sync**:
   - Real-time or cached path diff comparing `C:/Users/.../old but gold` with `D:/old but gold`.
   - Byte-for-byte package inspection showing identical, different, only-local, and only-remote items.
   - Single-package or All-packages sync with **Dry Run** simulation and **Delete Remote Extras** mirror options.
   - Seamless handling of connected / disconnected external drive states.
5. **Universal Search Hub**:
   - **Local Search**: Fuzzy search with matching highlights, sorting by match score, name, date, folder, and limits.
   - **Remote Search**: Fast fuzzy search across the external drive catalog by section (`anime`, `games`, `movies`, `series`) or source (`names`, `to_be_downloaded`).
   - **Unified Search**: Search both local files and remote catalog in a single prompt.
   - 1-Click relative path copying.
6. **Remote Catalog & "To Be Downloaded" Queue**:
   - Wishlist manager for media to download in the future.
   - Single title addition and multi-line Bulk Add.
   - Categorized viewing (`anime`, `games`, `movies`, `series`) and 1-click removal.
   - Rebuild catalog directly from connected hard drive.
7. **Spelling & Name Quality Audit**:
   - Audits local file and package names for English spelling errors, mojibake/encoding artifacts, repeated duplicate letters, and formatting issues.
   - Editable suggestion input for each detected issue.
   - **1-Click Live Disk Rename**: Renames the file directly on disk and updates `file_index.json` in place with undo support.
   - Persistent ignore rule manager.

---

## ⚙️ Core Data Registries (Loaded Automatically)

1. `file_index.json`: Master index of all local files in `old but gold`.
2. `video_metadata.json`: Resolution, bitrate, dimensions, and duration metrics.
3. `remote_catalog.json`: Indexed media library and wishlist queue from external hard drive.
4. `old_but_gold_diff.json`: Structural diff cache between local folders and hard drive.

---

## 💻 CLI Commands

### Build / Rescan File Indexes:
```powershell
uv run python src/file_manager/main.py
```

### Search `file_index.json`:
```powershell
uv run file-manager search "american psycho" --limit 5
uv run file-manager search "tutorial" --sort created --desc --limit 5
```

### Audit File and Package Names:
```powershell
uv run file-manager audit-names --scope all --limit 20
uv run file-manager audit-names --scope packages
uv run file-manager audit-names --scope files
```

### Remote Drive Catalog & Search:
```powershell
uv run file-manager remote-catalog
uv run file-manager remote-search "batman" --section movies
uv run file-manager remote-add-download games "ELDEN RING"
```

### Hard Drive Comparison & Sync:
```powershell
uv run file-manager old-gold-diff
uv run file-manager old-gold-compare videos
uv run file-manager old-gold-sync --package videos --dry-run
uv run file-manager old-gold-sync --all
```
