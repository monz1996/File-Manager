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
  Layers
} from 'lucide-react';
import type { OldGoldDiffResponse, OldGoldDiffPackage, SystemStatus } from '../../types';

interface DriveSyncTabProps {
  status: SystemStatus | null;
  onOperationDone?: () => void;
}

export const DriveSyncTab: React.FC<DriveSyncTabProps> = ({ status, onOperationDone }) => {
  const [diff, setDiff] = useState<OldGoldDiffResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null); // 'all' or package name
  const [dryRun, setDryRun] = useState(false);
  const [deleteRemoteExtra, setDeleteRemoteExtra] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<OldGoldDiffPackage | null>(null);
  const [packageComparison, setPackageComparison] = useState<any | null>(null);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string; result?: any } | null>(null);

  const isDriveAvailable = status?.connected.remote_drive.available ?? false;

  const fetchDiff = async (refresh: boolean = false) => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/old-gold/diff?refresh=${refresh}`);
      if (res.ok) {
        const data = await res.json();
        setDiff(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiff(false);
  }, []);

  const handleInspectPackage = async (pkg: OldGoldDiffPackage) => {
    setSelectedPackage(pkg);
    setPackageComparison(null);
    setLoadingCompare(true);
    try {
      const res = await fetch(`/api/old-gold/compare/${encodeURIComponent(pkg.package)}`);
      if (res.ok) {
        const data = await res.json();
        setPackageComparison(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCompare(false);
    }
  };

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

  const packages = diff?.packages || [];
  const packagesWithDiffs = packages.filter((p) => p.only_local_count > 0 || p.only_remote_count > 0);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
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
              <p className="text-xs text-slate-400 mt-0.5">
                Compare and synchronize packages between <code className="text-indigo-300">C:/Users/.../old but gold</code> and <code className="text-emerald-300">D:/old but gold</code>.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchDiff(true)}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Re-Compare Paths</span>
          </button>
        </div>
      </div>

      {/* Disconnected Drive Warning Banner if not connected */}
      {!isDriveAvailable && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-xs text-amber-300">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-amber-200 block">External Hard Drive (D:) is currently not connected.</span>
            <p className="text-slate-400 mt-0.5">
              The diff data displayed below is cached from the latest scan stored in <code className="text-indigo-300 font-mono">old_but_gold_diff.json</code>. You can inspect differences or reconnect the hard drive and click "Re-Compare Paths" to sync.
            </p>
          </div>
        </div>
      )}

      {/* Controls & Sync Options Bar */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Dry Run Toggle */}
          <label className="flex items-center gap-2 text-xs font-medium text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-700 cursor-pointer"
            />
            <span className={dryRun ? 'text-indigo-300 font-bold' : ''}>Dry Run (Preview Only)</span>
          </label>

          {/* Delete Remote Extras Toggle */}
          <label className="flex items-center gap-2 text-xs font-medium text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={deleteRemoteExtra}
              onChange={(e) => setDeleteRemoteExtra(e.target.checked)}
              className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 bg-slate-800 border-slate-700 cursor-pointer"
            />
            <span className={deleteRemoteExtra ? 'text-rose-400 font-semibold' : 'text-slate-400'}>
              Delete Remote Extras (Mirror Local)
            </span>
          </label>
        </div>

        {/* Sync All Button */}
        <button
          onClick={() => handleSync(null, true)}
          disabled={!isDriveAvailable || syncing !== null || packages.length === 0}
          className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition cursor-pointer disabled:opacity-40"
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
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-400" /> Total Packages
          </span>
          <p className="text-xl font-extrabold text-white mt-1">{diff?.package_count || packages.length}</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" /> With Differences
          </span>
          <p className="text-xl font-extrabold text-amber-400 mt-1">{packagesWithDiffs.length}</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <Copy className="w-3.5 h-3.5 text-emerald-400" /> Only in Local
          </span>
          <p className="text-xl font-extrabold text-emerald-400 mt-1">
            {packages.reduce((acc, p) => acc + (p.only_local_count || 0), 0)} files
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-blue-400" /> Only in Remote
          </span>
          <p className="text-xl font-extrabold text-blue-400 mt-1">
            {packages.reduce((acc, p) => acc + (p.only_remote_count || 0), 0)} files
          </p>
        </div>
      </div>

      {/* Packages Diff List */}
      <div className="space-y-3">
        {packages.map((pkg) => {
          const hasDiff = pkg.only_local_count > 0 || pkg.only_remote_count > 0;
          const isCurrentSyncing = syncing === pkg.package;

          return (
            <div
              key={pkg.package}
              className={`p-4 rounded-xl border transition duration-150 ${
                hasDiff
                  ? 'bg-slate-900/90 border-slate-700/80 shadow-md'
                  : 'bg-slate-900/40 border-slate-800/60'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                {/* Package Info */}
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
                    <span className="text-xs text-slate-400">
                      Local: {pkg.local_count} items | Remote: {pkg.remote_count} items
                    </span>
                  </div>
                </div>

                {/* Metric Badges */}
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                    pkg.only_local_count > 0 
                      ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' 
                      : 'bg-slate-800 text-slate-500'
                  }`}>
                    +{pkg.only_local_count} Local Only
                  </span>

                  <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                    pkg.only_remote_count > 0 
                      ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20' 
                      : 'bg-slate-800 text-slate-500'
                  }`}>
                    +{pkg.only_remote_count} Remote Only
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleInspectPackage(pkg)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Inspect</span>
                  </button>

                  <button
                    onClick={() => handleSync(pkg.package, false)}
                    disabled={!isDriveAvailable || syncing !== null}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition cursor-pointer disabled:opacity-40"
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

      {/* Package Inspector Modal */}
      {selectedPackage && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-emerald-400" />
                  Package Diff: {selectedPackage.package}
                </h3>
                <p className="text-xs text-slate-400">
                  Byte-for-byte and path comparison between Local and Remote D: drive
                </p>
              </div>
              <button onClick={() => setSelectedPackage(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {loadingCompare ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                  Comparing byte content...
                </div>
              ) : packageComparison ? (
                <div className="space-y-4">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                      <span className="text-slate-500 block">Identical</span>
                      <strong className="text-emerald-400 text-sm">{packageComparison.same_count}</strong>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                      <span className="text-slate-500 block">Different</span>
                      <strong className="text-amber-400 text-sm">{packageComparison.different_count}</strong>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                      <span className="text-slate-500 block">Only Local</span>
                      <strong className="text-indigo-400 text-sm">{packageComparison.only_local_count}</strong>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                      <span className="text-slate-500 block">Only Remote</span>
                      <strong className="text-blue-400 text-sm">{packageComparison.only_remote_count}</strong>
                    </div>
                  </div>

                  {/* Only Local Files */}
                  {packageComparison.only_local.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-emerald-400 mb-1.5">
                        Only in Local (Will be copied to D:):
                      </h4>
                      <div className="max-h-40 overflow-y-auto p-3 rounded-lg bg-slate-950 border border-slate-800/80 font-mono text-[11px] space-y-1">
                        {packageComparison.only_local.map((f: string) => (
                          <div key={f} className="text-emerald-300 truncate">+ {f}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Different Files */}
                  {packageComparison.different.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-amber-400 mb-1.5">
                        Content Differs (Will be updated):
                      </h4>
                      <div className="max-h-40 overflow-y-auto p-3 rounded-lg bg-slate-950 border border-slate-800/80 font-mono text-[11px] space-y-1">
                        {packageComparison.different.map((f: string) => (
                          <div key={f} className="text-amber-300 truncate">~ {f}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Only Remote Files */}
                  {packageComparison.only_remote.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-blue-400 mb-1.5">
                        Only in Remote (Hard Drive):
                      </h4>
                      <div className="max-h-40 overflow-y-auto p-3 rounded-lg bg-slate-950 border border-slate-800/80 font-mono text-[11px] space-y-1">
                        {packageComparison.only_remote.map((f: string) => (
                          <div key={f} className="text-blue-300 truncate">- {f}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedPackage.only_local.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-emerald-400 mb-1">Local Only Paths:</h4>
                      <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-emerald-300 max-h-48 overflow-y-auto">
                        {selectedPackage.only_local.map((p) => <div key={p}>+ {p}</div>)}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-3.5 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedPackage(null)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
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
