import React, { useState, useEffect } from 'react';
import { 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  EyeOff, 
  FolderPlus, 
  RefreshCw, 
  FileCheck, 
  Folder, 
  File, 
  ShieldAlert, 
  Sparkles, 
  X 
} from 'lucide-react';
import type { DownloadsPlanResponse, DownloadPlanEntry } from '../../types';

export const DownloadsSyncTab: React.FC<{ onOperationDone?: () => void }> = ({ onOperationDone }) => {
  const [plan, setPlan] = useState<DownloadsPlanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedEntries, setSelectedEntries] = useState<Record<string, boolean>>({});
  const [editedPlans, setEditedPlans] = useState<Record<string, { package: string; name: string }>>({});
  const [moving, setMoving] = useState(false);
  const [showIgnoredModal, setShowIgnoredModal] = useState(false);
  const [ignoredList, setIgnoredList] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchPlan = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/downloads/plan');
      if (res.ok) {
        const data: DownloadsPlanResponse = await res.json();
        setPlan(data);
        // Initialize edited plans
        const initialEdits: Record<string, { package: string; name: string }> = {};
        data.entries.forEach((e) => {
          initialEdits[e.source_path] = {
            package: e.recommended_package,
            name: e.recommended_name,
          };
        });
        setEditedPlans(initialEdits);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchIgnored = async () => {
    try {
      const res = await fetch('/api/downloads/ignore');
      if (res.ok) {
        const data = await res.json();
        setIgnoredList(data.ignored || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchPlan();
    fetchIgnored();
  }, []);

  const handleToggleSelectAll = () => {
    if (!plan) return;
    const allSelected = plan.entries.length > 0 && plan.entries.every((e) => selectedEntries[e.source_path]);
    const updated: Record<string, boolean> = {};
    if (!allSelected) {
      plan.entries.forEach((e) => {
        updated[e.source_path] = true;
      });
    }
    setSelectedEntries(updated);
  };

  const handleToggleSelect = (sourcePath: string) => {
    setSelectedEntries((prev) => ({
      ...prev,
      [sourcePath]: !prev[sourcePath],
    }));
  };

  const handleEditChange = (sourcePath: string, field: 'package' | 'name', value: string) => {
    setEditedPlans((prev) => ({
      ...prev,
      [sourcePath]: {
        ...prev[sourcePath],
        [field]: value,
      },
    }));
  };

  const handleMoveFiles = async (itemsToMove: DownloadPlanEntry[]) => {
    if (itemsToMove.length === 0) return;
    setMoving(true);
    setFeedback(null);

    const payload = {
      items: itemsToMove.map((item) => {
        const edit = editedPlans[item.source_path] || { package: item.recommended_package, name: item.recommended_name };
        return {
          source_path: item.source_path,
          target_package: edit.package,
          target_name: edit.name,
        };
      }),
    };

    try {
      const res = await fetch('/api/downloads/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        const successCount = data.results.filter((r: any) => r.success).length;
        setFeedback({
          type: 'success',
          message: `Successfully moved ${successCount} of ${itemsToMove.length} item(s) to Old But Gold. Transaction logged to Activity Tab.`,
        });
        fetchPlan();
        if (onOperationDone) onOperationDone();
      } else {
        setFeedback({ type: 'error', message: data.detail || 'Failed to move files.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Network error while moving files.' });
    } finally {
      setMoving(false);
    }
  };

  const handleIgnore = async (name: string) => {
    try {
      const res = await fetch('/api/downloads/ignore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const data = await res.json();
        setIgnoredList(data.ignored || []);
        fetchPlan();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUnignore = async (name: string) => {
    try {
      const res = await fetch(`/api/downloads/ignore/${encodeURIComponent(name)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const data = await res.json();
        setIgnoredList(data.ignored || []);
        fetchPlan();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const selectedCount = Object.values(selectedEntries).filter(Boolean).length;
  const packagesList = plan?.available_packages || ['videos', 'books', 'Music', 'pictures', 'Anime', 'Lol', 'Content', 'Recordings', 'Songs', 'New folder'];

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Downloads &rarr; Local "Old But Gold" Sync</h2>
              <p className="text-xs text-slate-400">
                AI & rule-based organizer with cleaned names, package assignment, preview, and revertible moves.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowIgnoredModal(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
          >
            <EyeOff className="w-3.5 h-3.5 text-amber-400" />
            <span>Ignored Rules ({ignoredList.length})</span>
          </button>

          <button
            onClick={fetchPlan}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Scan</span>
          </button>
        </div>
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

      {/* Actions Bar */}
      {plan && plan.entries.length > 0 && (
        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={plan.entries.length > 0 && plan.entries.every((e) => selectedEntries[e.source_path])}
                onChange={handleToggleSelectAll}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-700 cursor-pointer"
              />
              <span>Select All ({plan.entries.length} items)</span>
            </label>

            {selectedCount > 0 && (
              <span className="text-xs text-indigo-400 font-semibold bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
                {selectedCount} selected
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const itemsToMove = plan.entries.filter((e) => selectedEntries[e.source_path]);
                handleMoveFiles(itemsToMove);
              }}
              disabled={selectedCount === 0 || moving}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 disabled:opacity-40 transition cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>{moving ? 'Moving...' : `Move Selected (${selectedCount})`}</span>
            </button>

            <button
              onClick={() => handleMoveFiles(plan.entries)}
              disabled={moving || plan.entries.length === 0}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-40 transition cursor-pointer"
            >
              <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Move All ({plan.entries.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Entries List */}
      {!plan || plan.entries.length === 0 ? (
        <div className="p-16 text-center rounded-2xl bg-slate-900/50 border border-slate-800">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-300">Downloads Folder is Clean</h3>
          <p className="text-xs text-slate-500 mt-1">
            No new files found in <code className="text-indigo-300 font-mono">{plan?.downloads_root || 'Downloads'}</code> to organize.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {plan.entries.map((entry) => {
            const isSelected = !!selectedEntries[entry.source_path];
            const currentEdit = editedPlans[entry.source_path] || {
              package: entry.recommended_package,
              name: entry.recommended_name,
            };

            return (
              <div
                key={entry.source_path}
                className={`p-4 rounded-xl border transition duration-150 ${
                  isSelected
                    ? 'bg-indigo-950/20 border-indigo-500/50 shadow-lg shadow-indigo-500/5'
                    : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 shadow-md'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  {/* Selection Checkbox & Source info */}
                  <div className="flex items-start gap-3 flex-1 min-w-[280px]">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelect(entry.source_path)}
                      className="mt-1 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-700 cursor-pointer"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {entry.is_directory ? (
                          <Folder className="w-4 h-4 text-amber-400 shrink-0" />
                        ) : (
                          <File className="w-4 h-4 text-blue-400 shrink-0" />
                        )}
                        <span className="text-sm font-bold text-slate-200 truncate" title={entry.source_name}>
                          {entry.source_name}
                        </span>
                        <span className="text-[11px] text-slate-400 font-medium px-2 py-0.2 rounded bg-slate-800">
                          {formatBytes(entry.size_bytes)}
                        </span>
                      </div>

                      {/* Clean Name Indicator */}
                      {entry.name_changed && (
                        <div className="flex items-center gap-1.5 mt-1 text-[11px] text-indigo-400">
                          <Sparkles className="w-3 h-3" />
                          <span>Release junk stripped automatically</span>
                        </div>
                      )}

                      {/* Reason */}
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">{entry.reason}</p>
                    </div>
                  </div>

                  {/* Target Package & Target Name In-line Editor */}
                  <div className="flex flex-col md:flex-row items-center gap-3 w-full lg:w-auto">
                    {/* Destination Package selector */}
                    <div className="w-full md:w-44">
                      <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Target Package</label>
                      <select
                        value={currentEdit.package}
                        onChange={(e) => handleEditChange(entry.source_path, 'package', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-indigo-300 font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
                      >
                        {packagesList.map((pkg) => (
                          <option key={pkg} value={pkg}>
                            {pkg}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Destination Clean Name input */}
                    <div className="w-full md:w-64">
                      <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Target Name</label>
                      <input
                        type="text"
                        value={currentEdit.name}
                        onChange={(e) => handleEditChange(entry.source_path, 'name', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                      />
                    </div>

                    {/* Actions: Move Single / Ignore */}
                    <div className="flex items-center gap-2 pt-4 md:pt-4">
                      <button
                        onClick={() => handleMoveFiles([entry])}
                        disabled={moving}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition cursor-pointer"
                      >
                        <FolderPlus className="w-3.5 h-3.5" />
                        <span>Move</span>
                      </button>

                      <button
                        onClick={() => handleIgnore(entry.source_name)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-amber-400 border border-slate-700 transition cursor-pointer"
                        title="Ignore this file"
                      >
                        <EyeOff className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Collision warning if destination already exists */}
                {entry.destination_exists && (
                  <div className="mt-3 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-xs text-amber-300">
                    <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Warning: A file with this target name already exists in '{currentEdit.package}'. Moving will overwrite it.</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Ignored Rules Modal */}
      {showIgnoredModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2.5">
                <EyeOff className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Ignored Downloads Rules</h3>
              </div>
              <button onClick={() => setShowIgnoredModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3 max-h-96 overflow-y-auto">
              {ignoredList.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">No files currently ignored.</p>
              ) : (
                <div className="space-y-2">
                  {ignoredList.map((name) => (
                    <div
                      key={name}
                      className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700 flex items-center justify-between text-xs"
                    >
                      <span className="font-medium text-slate-300">{name}</span>
                      <button
                        onClick={() => handleUnignore(name)}
                        className="text-xs text-rose-400 hover:text-rose-300 hover:underline cursor-pointer"
                      >
                        Remove Rule
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-3.5 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowIgnoredModal(false)}
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
