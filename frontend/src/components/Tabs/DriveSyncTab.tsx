import React, { useState, useEffect } from 'react';
import { 
  HardDrive, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Eye, 
  X, 
  FolderSync,
  Layers,
  Search,
  FolderPlus,
} from 'lucide-react';
import type { OldGoldDiffResponse, OldGoldDiffPackage, SystemStatus } from '../../types';

interface DriveSyncTabProps {
  status: SystemStatus | null;
  onOperationDone?: () => void;
}

export const DriveSyncTab: React.FC<DriveSyncTabProps> = ({ status, onOperationDone }) => {
  const [diff, setDiff] = useState<OldGoldDiffResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [dryRun, setDryRun] = useState(false);
  const [deleteRemoteExtra, setDeleteRemoteExtra] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState<OldGoldDiffPackage | null>(null);
  const [movingFiles, setMovingFiles] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Record<string, boolean>>({});
  const [moveFeedback, setMoveFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string; result?: any } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastSelectedIdx, setLastSelectedIdx] = useState<number | null>(null);

  const isDriveAvailable = status?.connected.remote_drive.available ?? false;

  const fetchDiff = async (refresh: boolean = false): Promise<OldGoldDiffResponse | null> => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/old-gold/diff?refresh=${refresh}`);
      if (res.ok) {
        const data = await res.json();
        setDiff(data);
        return data;
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
    return null;
  };

  useEffect(() => {
    fetchDiff(true);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedPackage) {
        setSelectedPackage(null);
        setSelectedFiles({});
        setMoveFeedback(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedPackage]);

  const handleSync = async (packageName: string | null, isAll: boolean = false) => {
    const targetDesc = isAll ? 'ALL packages' : `package '${packageName}'`;
    const actionDesc = dryRun ? 'perform a DRY RUN test sync for' : 'SYNC';
    
    if (!dryRun && !window.confirm(`Are you sure you want to ${actionDesc} ${targetDesc} to the Hard Drive (D:)?`)) {
      return;
    }

    setSyncing(isAll ? 'all' : packageName);
    setFeedback(null);

    const payload = {
      package: packageName,
      sync_all: isAll,
      delete_remote_extra: deleteRemoteExtra,
      dry_run: dryRun,
    };

    try {
      const res = await fetch('/api/old-gold/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({
          type: 'success',
          message: dryRun
            ? `[Dry Run Simulation] Planned ${data.copied_count || 0} copies, ${data.updated_count || 0} updates, ${data.deleted_count || 0} deletions.`
            : `Sync completed! Copied: ${data.copied_count || 0}, Updated: ${data.updated_count || 0}, Deleted: ${data.deleted_count || 0}.`,
          result: data,
        });
        fetchDiff(true);
        if (onOperationDone) onOperationDone();
      } else {
        setFeedback({ type: 'error', message: data.detail || 'Failed to sync with drive.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Network error while executing sync.' });
    } finally {
      setSyncing(null);
    }
  };

  const handleFileWithRange = (file: string, idx: number, e: React.MouseEvent) => {
    const files = selectedPackage?.only_local || [];
    if (e.shiftKey && lastSelectedIdx !== null) {
      const start = Math.min(lastSelectedIdx, idx);
      const end = Math.max(lastSelectedIdx, idx);
      const updated = { ...selectedFiles };
      for (let i = start; i <= end; i++) {
        if (files[i]) updated[files[i]] = true;
      }
      setSelectedFiles(updated);
    } else {
      setSelectedFiles((prev) => ({ ...prev, [file]: !prev[file] }));
      setLastSelectedIdx(idx);
    }
  };

  const handleSelectAllFiles = () => {
    if (!selectedPackage) return;
    const allSelected = selectedPackage.only_local.every((f) => selectedFiles[f]);
    const updated: Record<string, boolean> = {};
    if (!allSelected) {
      selectedPackage.only_local.forEach((f) => { updated[f] = true; });
    }
    setSelectedFiles(updated);
  };

  const handleMoveSelected = async () => {
    if (!selectedPackage) return;
    const filesToCopy = selectedPackage.only_local.filter((file) => selectedFiles[file]);
    const filesToDelete = selectedPackage.only_remote.filter((file) => selectedFiles[file]);
    const selectedCount = filesToCopy.length + filesToDelete.length;
    if (selectedCount === 0) return;
    if (!window.confirm(`Apply ${selectedCount} selected change(s) to the remote drive?`)) return;

    setMovingFiles(true);
    setMoveFeedback(null);
    try {
      const res = await fetch('/api/old-gold/move-selected', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          package: selectedPackage.package,
          files: filesToCopy,
          delete_files: filesToDelete,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMoveFeedback({
          type: 'success',
          message: `Copied ${data.copied_count} file(s) and deleted ${data.deleted_count} remote file(s).`,
        });
        setSelectedFiles({});
        const refreshedDiff = await fetchDiff(true);
        if (onOperationDone) onOperationDone();
        const updated = refreshedDiff?.packages.find((p) => p.package === selectedPackage.package);
        if (updated) {
          setSelectedPackage(updated);
        } else {
          setSelectedPackage(null);
        }
      } else {
        setMoveFeedback({ type: 'error', message: data.detail || 'Failed to move files.' });
      }
    } catch (err) {
      setMoveFeedback({ type: 'error', message: 'Network error while moving files.' });
    } finally {
      setMovingFiles(false);
    }
  };

  const packages = diff?.packages || [];
  const packagesWithDiffs = packages.filter((p) => p.only_local_count > 0 || p.only_remote_count > 0);

  const filteredPackages = packages.filter((p) =>
    !searchQuery ||
    p.package.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.only_local.some((f) => f.toLowerCase().includes(searchQuery.toLowerCase())) ||
    p.only_remote.some((f) => f.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const selectedFileCount = Object.values(selectedFiles).filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-800 via-indigo-900/30 to-slate-800 border border-slate-700 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Local &harr; Hard Drive (D:) Sync</h2>
                {isDriveAvailable ? (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Drive Connected
                  </span>
                ) : (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-semibold flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Drive Disconnected
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Compare and synchronize packages between <code className="text-indigo-300">C:/Users/.../old but gold</code> and <code className="text-emerald-300">D:/old but gold</code>.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter packages..."
              className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-600 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-400"
            />
          </div>
          <button
            onClick={() => fetchDiff(true)}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Re-Compare Paths</span>
          </button>
        </div>
      </div>

      {/* Disconnected Drive Warning */}
      {!isDriveAvailable && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-xs text-amber-300">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-amber-200 block">External Hard Drive (D:) is currently not connected.</span>
            <p className="text-slate-300 mt-0.5">
              The diff data displayed below is cached from the latest scan stored in <code className="text-indigo-300 font-mono">old_but_gold_diff.json</code>. You can inspect differences or reconnect the hard drive and click "Re-Compare Paths" to sync.
            </p>
          </div>
        </div>
      )}

      {/* Controls & Sync Options */}
      <div className="p-4 rounded-xl bg-slate-800 border border-slate-700 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-500 focus:ring-indigo-400 bg-slate-700 border-slate-600 cursor-pointer"
            />
            <span className={dryRun ? 'text-indigo-300 font-bold' : ''}>Dry Run (Preview Only)</span>
          </label>

          <label className="flex items-center gap-2 text-xs font-medium text-slate-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={deleteRemoteExtra}
              onChange={(e) => setDeleteRemoteExtra(e.target.checked)}
              className="w-4 h-4 rounded text-rose-500 focus:ring-rose-400 bg-slate-700 border-slate-600 cursor-pointer"
            />
            <span className={deleteRemoteExtra ? 'text-rose-400 font-semibold' : 'text-slate-300'}>
              Delete Remote Extras (Mirror Local)
            </span>
          </label>
        </div>

        <button
          onClick={() => handleSync(null, true)}
          disabled={!isDriveAvailable || syncing !== null || packages.length === 0}
          className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition cursor-pointer disabled:opacity-40"
        >
          <FolderSync className={`w-4 h-4 ${syncing === 'all' ? 'animate-spin' : ''}`} />
          <span>{syncing === 'all' ? 'Syncing All...' : dryRun ? 'Test Sync All (Dry Run)' : 'Sync All Packages to D:'}</span>
        </button>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-medium animate-in fade-in duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700">
          <span className="text-xs text-slate-300 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-400" /> Total Packages
          </span>
          <p className="text-xl font-extrabold text-white mt-1">{diff?.package_count || packages.length}</p>
        </div>
        <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700">
          <span className="text-xs text-slate-300 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" /> With Differences
          </span>
          <p className="text-xl font-extrabold text-amber-400 mt-1">{packagesWithDiffs.length}</p>
        </div>
        <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700">
          <span className="text-xs text-slate-300 flex items-center gap-1.5">
            <Copy className="w-3.5 h-3.5 text-emerald-400" /> Only in Local
          </span>
          <p className="text-xl font-extrabold text-emerald-400 mt-1">
            {packages.reduce((acc, p) => acc + (p.only_local_count || 0), 0)} files
          </p>
        </div>
        <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700">
          <span className="text-xs text-slate-300 flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-blue-400" /> Only in Remote
          </span>
          <p className="text-xl font-extrabold text-blue-400 mt-1">
            {packages.reduce((acc, p) => acc + (p.only_remote_count || 0), 0)} files
          </p>
        </div>
      </div>

      {/* Packages Diff List */}
      <div className="space-y-3">
        {filteredPackages.map((pkg) => {
          const hasDiff = pkg.only_local_count > 0 || pkg.only_remote_count > 0;
          const isCurrentSyncing = syncing === pkg.package;

          return (
            <div
              key={pkg.package}
              className={`p-4 rounded-xl border transition duration-150 ${
                hasDiff
                  ? 'bg-slate-800/60 border-slate-700 shadow-md'
                  : 'bg-slate-800/30 border-slate-700/60'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl border ${
                    hasDiff 
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  }`}>
                    <HardDrive className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white">{pkg.package}</h4>
                      {hasDiff ? (
                        <span className="text-[10px] px-2 py-0.2 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 font-semibold">
                          Differs
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-semibold">
                          In Sync
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-300">
                      Local: {pkg.local_count} items | Remote: {pkg.remote_count} items
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                    pkg.only_local_count > 0 
                      ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' 
                      : 'bg-slate-700 text-slate-400'
                  }`}>
                    +{pkg.only_local_count} Local Only
                  </span>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                    pkg.only_remote_count > 0 
                      ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20' 
                      : 'bg-slate-700 text-slate-400'
                  }`}>
                    +{pkg.only_remote_count} Remote Only
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedPackage(pkg);
                      setSelectedFiles({});
                      setMoveFeedback(null);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 transition cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Inspect</span>
                  </button>

                  <button
                    onClick={() => handleSync(pkg.package, false)}
                    disabled={!isDriveAvailable || syncing !== null}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500 hover:bg-indigo-400 text-white shadow-md shadow-indigo-500/20 transition cursor-pointer disabled:opacity-40"
                  >
                    <FolderSync className={`w-3.5 h-3.5 ${isCurrentSyncing ? 'animate-spin' : ''}`} />
                    <span>{isCurrentSyncing ? 'Syncing...' : dryRun ? 'Test Sync' : 'Sync Package'}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Package Inspector Modal - Path-based diff with move-to-remote */}
      {selectedPackage && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between bg-slate-900">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-emerald-400" />
                  Package Diff: {selectedPackage.package}
                </h3>
                <p className="text-xs text-slate-300">
                  Path-based comparison — select files to copy to the remote drive
                </p>
              </div>
              <button onClick={() => setSelectedPackage(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* Move feedback */}
              {moveFeedback && (
                <div className={`p-3 rounded-lg border text-xs font-medium ${
                  moveFeedback.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}>
                  {moveFeedback.message}
                </div>
              )}

              {/* Only Local Files - with checkboxes */}
              {selectedPackage.only_local.length > 0 ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-emerald-400">
                      Only in Local ({selectedPackage.only_local.length} files)
                    </h4>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={selectedPackage.only_local.every((f) => selectedFiles[f])}
                          onChange={handleSelectAllFiles}
                          className="w-3.5 h-3.5 rounded text-indigo-500 bg-slate-700 border-slate-600 cursor-pointer"
                        />
                        <span>Select All</span>
                      </label>
                      {selectedFileCount > 0 && (
                        <span className="text-[11px] text-indigo-300 font-semibold bg-indigo-500/15 px-2 py-0.5 rounded-full border border-indigo-500/30">
                          {selectedFileCount} selected
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="max-h-56 overflow-y-auto p-3 rounded-lg bg-slate-900 border border-slate-700 space-y-1">
                    {selectedPackage.only_local.map((f, idx) => (
                      <label
                        key={f}
                        className={`flex items-start gap-2 px-2 py-1.5 rounded text-[11px] cursor-pointer transition ${
                          selectedFiles[f] ? 'bg-blue-500/15 text-blue-200' : 'text-white hover:bg-slate-800'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={!!selectedFiles[f]}
                          onClick={(e) => handleFileWithRange(f, idx, e)}
                          onChange={() => {}}
                          className="w-3.5 h-3.5 mt-0.5 rounded text-blue-500 bg-slate-700 border-slate-600 cursor-pointer shrink-0"
                        />
                        <span className="font-mono whitespace-pre-wrap break-all leading-relaxed">
                          + {selectedPackage.package}/{f}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center rounded-lg bg-slate-900 border border-slate-700">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-xs text-slate-300">No files unique to local — package is in sync.</p>
                </div>
              )}

              {/* Only Remote Files */}
              {selectedPackage.only_remote.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <h4 className="text-xs font-bold text-blue-400">
                      Only in Remote (Hard Drive) — {selectedPackage.only_remote.length} files
                    </h4>
                    <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedPackage.only_remote.every((f) => selectedFiles[f])}
                        onChange={(event) => {
                          setSelectedFiles((prev) => {
                            const updated = { ...prev };
                            selectedPackage.only_remote.forEach((file) => { updated[file] = event.target.checked; });
                            return updated;
                          });
                        }}
                        className="w-3.5 h-3.5 rounded text-indigo-500 bg-slate-700 border-slate-600"
                      />
                      Select All
                    </label>
                  </div>
                  <div className="max-h-40 overflow-y-auto p-3 rounded-lg bg-slate-900 border border-slate-700 space-y-1">
                    {selectedPackage.only_remote.map((f) => (
                      <label
                        key={f}
                        className={`flex items-start gap-2 px-2 py-1.5 rounded text-[11px] cursor-pointer transition ${
                          selectedFiles[f] ? 'bg-blue-500/15 text-blue-200' : 'text-blue-200 hover:bg-slate-800'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={!!selectedFiles[f]}
                          onChange={(event) => setSelectedFiles((prev) => ({ ...prev, [f]: event.target.checked }))}
                          className="w-3.5 h-3.5 mt-0.5 rounded text-blue-500 bg-slate-700 border-slate-600 cursor-pointer shrink-0"
                        />
                        <span className="font-mono whitespace-pre-wrap break-all leading-relaxed">
                          - {selectedPackage.package}/{f}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {selectedFileCount > 0 && (
                <div className="flex justify-end">
                  <button
                    onClick={handleMoveSelected}
                    disabled={movingFiles || !isDriveAvailable}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-white shadow-md shadow-emerald-500/20 disabled:opacity-40 transition cursor-pointer"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>{movingFiles ? 'Applying...' : `Move Selected (${selectedFileCount})`}</span>
                  </button>
                </div>
              )}
            </div>

            <div className="px-6 py-3.5 bg-slate-900 border-t border-slate-700 flex items-center justify-between">
              <p className="text-[11px] text-orange-200">Press Esc to close · Paths shown in full</p>
              <button
                onClick={() => setSelectedPackage(null)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-white cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
