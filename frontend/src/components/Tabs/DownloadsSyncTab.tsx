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
  X,
  ChevronRight,
  ArrowLeft,
  Ban,
  Wand2,
  Search,
} from 'lucide-react';
import type { DownloadsPlanResponse, DownloadPlanEntry } from '../../types';
import { openLocalFile } from '../../utils/openFile';

export const DownloadsSyncTab: React.FC<{ onOperationDone?: () => void }> = ({ onOperationDone }) => {
  const [plan, setPlan] = useState<DownloadsPlanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedEntries, setSelectedEntries] = useState<Record<string, boolean>>({});
  const [editedPlans, setEditedPlans] = useState<Record<string, { package: string; name: string }>>({});
  const [moving, setMoving] = useState(false);
  const [showIgnoredModal, setShowIgnoredModal] = useState(false);
  const [ignoredList, setIgnoredList] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastSelectedIdx, setLastSelectedIdx] = useState<number | null>(null);
  // Folder browser state per entry
  const [browsingEntry, setBrowsingEntry] = useState<string | null>(null);
  const [browsePath, setBrowsePath] = useState<string>('');
  const [browseSubdirs, setBrowseSubdirs] = useState<string[]>([]);

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
            name: e.source_name,
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (browsingEntry) {
          setBrowsingEntry(null);
        } else if (showIgnoredModal) {
          setShowIgnoredModal(false);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [browsingEntry, showIgnoredModal]);

  const openPackagePicker = (sourcePath: string, _currentPackage: string) => {
    setBrowsingEntry(sourcePath);
    setBrowsePath('');
    setBrowseSubdirs(
      plan?.available_packages ||
      ['videos', 'books', 'Music', 'pictures', 'Anime', 'Lol', 'Content', 'Recordings', 'Songs', 'New folder']
    );
  };

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

  // Range selection with Shift+click
  const handleSelectWithRange = (sourcePath: string, entryIdx: number, event: React.MouseEvent) => {
    const entries = filteredEntries;
    if (event.shiftKey && lastSelectedIdx !== null) {
      const start = Math.min(lastSelectedIdx, entryIdx);
      const end = Math.max(lastSelectedIdx, entryIdx);
      const updated = { ...selectedEntries };
      for (let i = start; i <= end; i++) {
        if (entries[i]) {
          updated[entries[i].source_path] = true;
        }
      }
      setSelectedEntries(updated);
    } else {
      setSelectedEntries((prev) => ({
        ...prev,
        [sourcePath]: !prev[sourcePath],
      }));
      setLastSelectedIdx(entryIdx);
    }
  };

  const handleIgnoreSelected = async () => {
    if (!plan) return;
    const selectedNames = plan.entries
      .filter((e) => selectedEntries[e.source_path])
      .map((e) => e.source_name);
    if (selectedNames.length === 0) return;
    if (!window.confirm(`Ignore ${selectedNames.length} selected item(s) from Downloads?`)) return;
    try {
      const res = await fetch('/api/downloads/ignore-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names: selectedNames }),
      });
      if (res.ok) {
        const data = await res.json();
        setIgnoredList(data.ignored || []);
        setSelectedEntries({});
        fetchPlan();
        setFeedback({ type: 'success', message: `Ignored ${selectedNames.length} items.` });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleIgnoreAll = async () => {
    if (!plan || plan.entries.length === 0) return;
    const allNames = plan.entries.map((e) => e.source_name);
    if (!window.confirm(`Ignore all ${allNames.length} item(s) currently shown in Downloads?`)) return;
    try {
      const res = await fetch('/api/downloads/ignore-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names: allNames }),
      });
      if (res.ok) {
        const data = await res.json();
        setIgnoredList(data.ignored || []);
        setSelectedEntries({});
        fetchPlan();
        setFeedback({ type: 'success', message: `Ignored all ${allNames.length} items.` });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleIgnoreSuggestion = async (entry: DownloadPlanEntry) => {
    const suggestion = editedPlans[entry.source_path]?.name || entry.source_name;
    if (suggestion && suggestion !== entry.source_name) {
      try {
        await fetch('/api/downloads/ignore-suggestion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: suggestion }),
        });
      } catch (err) {
        console.error(err);
      }
    }
    // Revert to original name
    setEditedPlans((prev) => ({
      ...prev,
      [entry.source_path]: {
        package: prev[entry.source_path]?.package || entry.recommended_package,
        name: entry.source_name,
      },
    }));
    setFeedback({ type: 'success', message: `Suggestion ignored for "${entry.source_name}". Reverted to original name.` });
  };

  const handleSuggestDifferent = async (entry: DownloadPlanEntry) => {
    const currentSuggestion = editedPlans[entry.source_path]?.name || entry.source_name;
    try {
      const res = await fetch('/api/downloads/suggest-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_name: entry.source_name,
          current_suggestion: currentSuggestion,
          seed: Math.floor(Math.random() * 1000),
        }),
      });
      const data = await res.json();
      if (res.ok && data.suggestion) {
        setEditedPlans((prev) => ({
          ...prev,
          [entry.source_path]: {
            package: prev[entry.source_path]?.package || entry.recommended_package,
            name: data.suggestion,
          },
        }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const browseIntoPackage = async (sourcePath: string, currentPath: string) => {
    setBrowsingEntry(sourcePath);
    setBrowsePath(currentPath);
    try {
      if (!currentPath) {
        setBrowseSubdirs(plan?.available_packages || []);
        return;
      }
      const res = await fetch(`/api/downloads/browse-packages?path=${encodeURIComponent(currentPath)}`);
      if (res.ok) {
        const data = await res.json();
        setBrowseSubdirs(data.subdirs || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const navigateBrowseInto = (sourcePath: string, dir: string) => {
    const newPath = browsePath ? `${browsePath}/${dir}` : dir;
    setBrowsePath(newPath);
    browseIntoPackage(sourcePath, newPath);
  };

  const navigateBrowseUp = (sourcePath: string) => {
    const parts = browsePath.split('/').filter(Boolean);
    if (parts.length > 0) {
      parts.pop();
      const newPath = parts.join('/');
      setBrowsePath(newPath);
      browseIntoPackage(sourcePath, newPath);
    } else {
      setBrowsePath('');
      setBrowseSubdirs(plan?.available_packages || []);
    }
  };

  const selectBrowseFolder = (sourcePath: string) => {
    const chosen = browsePath || '';
    if (!chosen) return;
    setEditedPlans((prev) => ({
      ...prev,
      [sourcePath]: {
        package: chosen,
        name: prev[sourcePath]?.name || '',
      },
    }));
    setBrowsingEntry(null);
  };

  const selectPackageDirect = (sourcePath: string, pkg: string) => {
    setEditedPlans((prev) => ({
      ...prev,
      [sourcePath]: {
        package: pkg,
        name: prev[sourcePath]?.name || '',
      },
    }));
    setBrowsingEntry(null);
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

  const handleMoveFiles = async (itemsToMove: DownloadPlanEntry[], requireConfirmation = false) => {
    if (itemsToMove.length === 0) return;
    if (requireConfirmation) {
      const action = itemsToMove.length === 1 ? 'Move the selected item' : `Move ${itemsToMove.length} selected item(s)`;
      if (!window.confirm(`${action} from Downloads to Local Old But Gold?`)) return;
    }
    setMoving(true);
    setFeedback(null);

    const payload = {
      items: itemsToMove.map((item) => {
        const edit = editedPlans[item.source_path] || { package: item.recommended_package, name: item.source_name };
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

  // Apply search filter
  const filteredEntries = (plan?.entries || []).filter((entry) =>
    !searchQuery ||
    entry.source_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.recommended_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.recommended_package.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-800 via-indigo-900/40 to-slate-800 border border-slate-700 flex flex-wrap items-center justify-between gap-4">
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
        <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={plan.entries.length > 0 && plan.entries.every((e) => selectedEntries[e.source_path])}
                onChange={handleToggleSelectAll}
                className="w-4 h-4 rounded text-indigo-500 focus:ring-indigo-400 bg-slate-700 border-slate-600 cursor-pointer"
              />
              <span>Select All ({plan.entries.length} items)</span>
            </label>

            {selectedCount > 0 && (
              <span className="text-xs text-indigo-300 font-semibold bg-indigo-500/15 px-2.5 py-0.5 rounded-full border border-indigo-500/30">
                {selectedCount} selected
              </span>
            )}
          </div>

          {/* Instant Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter entries..."
              className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-600 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-400"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleIgnoreSelected}
              disabled={selectedCount === 0 || moving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 disabled:opacity-40 transition cursor-pointer"
            >
              <Ban className="w-3.5 h-3.5" />
              <span>Ignore Selected ({selectedCount})</span>
            </button>

            <button
              onClick={handleIgnoreAll}
              disabled={moving || plan.entries.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 disabled:opacity-40 transition cursor-pointer"
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span>Ignore All ({plan.entries.length})</span>
            </button>

            <button
              onClick={() => {
                const itemsToMove = plan.entries.filter((e) => selectedEntries[e.source_path]);
                handleMoveFiles(itemsToMove, true);
              }}
              disabled={selectedCount === 0 || moving}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500 hover:bg-indigo-400 text-white shadow-md shadow-indigo-500/20 disabled:opacity-40 transition cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>{moving ? 'Moving...' : `Move Selected (${selectedCount})`}</span>
            </button>

            <button
              onClick={() => handleMoveFiles(plan.entries, true)}
              disabled={moving || plan.entries.length === 0}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 disabled:opacity-40 transition cursor-pointer"
            >
              <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Move All ({plan.entries.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Entries List */}
      {!plan || plan.entries.length === 0 ? (
        <div className="p-16 text-center rounded-2xl bg-slate-800/60 border border-slate-700">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-200">Downloads Folder is Clean</h3>
          <p className="text-xs text-slate-400 mt-1">
            No new files found in <code className="text-indigo-300 font-mono">{plan?.downloads_root || 'Downloads'}</code> to organize.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEntries.map((entry, entryIdx) => {
            const isSelected = !!selectedEntries[entry.source_path];
            const currentEdit = editedPlans[entry.source_path] || {
              package: entry.recommended_package,
              name: entry.source_name,
            };

            return (
              <div
                key={entry.source_path}
                className={`p-4 rounded-xl border transition duration-150 ${
                  isSelected
                    ? 'bg-indigo-950/30 border-indigo-500/50 shadow-lg shadow-indigo-500/10'
                    : 'bg-slate-800/60 border-slate-700 hover:border-slate-600 shadow-md'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  {/* Selection Checkbox & Source info */}
                  <div className="flex items-start gap-3 flex-1 min-w-[280px]">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onClick={(e) => handleSelectWithRange(entry.source_path, entryIdx, e)}
                      onChange={() => {}}
                      className="mt-1 w-4 h-4 rounded text-indigo-500 focus:ring-indigo-400 bg-slate-700 border-slate-600 cursor-pointer"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {entry.is_directory ? (
                          <Folder className="w-4 h-4 text-amber-400 shrink-0" />
                        ) : (
                          <File className="w-4 h-4 text-blue-400 shrink-0" />
                        )}
                        <button
                          type="button"
                          onClick={() => openLocalFile({ path: entry.source_path, absolute: true })}
                          className="text-sm font-bold text-white truncate hover:text-yellow-300 underline decoration-blue-400/50 cursor-pointer text-left max-w-full"
                          title={`Open ${entry.source_name}`}
                        >
                          {entry.source_name}
                        </button>
                        <span className="text-[11px] text-slate-300 font-medium px-2 py-0.2 rounded bg-slate-700">
                          {formatBytes(entry.size_bytes)}
                        </span>
                      </div>

                      {/* Clean Name Indicator */}
                      {entry.name_changed && (
                        <div className="flex items-center gap-1.5 mt-1 text-[11px] text-indigo-300">
                          <Sparkles className="w-3 h-3" />
                          <span>Release junk stripped automatically</span>
                        </div>
                      )}

                      {/* Reason */}
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed">{entry.reason}</p>
                    </div>
                  </div>

                  {/* Target Package & Target Name In-line Editor */}
                  <div className="flex flex-col md:flex-row items-center gap-3 w-full lg:w-auto min-w-0">
                    {/* Destination Package — compact horizontal button, popup picker */}
                    <div className="w-full md:w-56 min-w-0">
                      <label className="text-[10px] uppercase font-bold text-yellow-300 block mb-1">Target Package</label>
                      <button
                        type="button"
                        onClick={() => openPackagePicker(entry.source_path, currentEdit.package)}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-blue-500/40 text-xs text-blue-200 font-semibold hover:border-yellow-400 cursor-pointer min-w-0"
                        title={currentEdit.package}
                      >
                        <Folder className="w-3.5 h-3.5 text-orange-300 shrink-0" />
                        <span className="truncate text-left flex-1 min-w-0">{currentEdit.package}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-yellow-300 shrink-0" />
                      </button>
                    </div>

                    {/* Destination Clean Name input */}
                    <div className="w-full md:w-64 min-w-0">
                      <label className="text-[10px] uppercase font-bold text-orange-300 block mb-1">Target Name</label>
                      <div className="flex gap-1 min-w-0">
                        <input
                          type="text"
                          value={currentEdit.name}
                          onChange={(e) => handleEditChange(entry.source_path, 'name', e.target.value)}
                          className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-orange-500/30 text-xs text-white focus:outline-none focus:border-yellow-400 font-mono"
                        />
                        <button
                          onClick={() => handleSuggestDifferent(entry)}
                          className="px-2 py-1.5 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-200 border border-blue-400/30 cursor-pointer shrink-0"
                          title="Suggest a different name"
                        >
                          <Wand2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleIgnoreSuggestion(entry)}
                          className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-orange-300 border border-slate-600 cursor-pointer shrink-0"
                          title="Ignore this suggested name"
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Actions: Move Single / Ignore */}
                    <div className="flex items-center gap-2 pt-4 md:pt-4 shrink-0">
                      <button
                        onClick={() => handleMoveFiles([entry])}
                        disabled={moving}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500 hover:bg-blue-400 text-white transition cursor-pointer"
                      >
                        <FolderPlus className="w-3.5 h-3.5" />
                        <span>Move</span>
                      </button>

                      <button
                        onClick={() => handleIgnore(entry.source_name)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-orange-300 border border-slate-600 transition cursor-pointer"
                        title="Ignore this file"
                      >
                        <EyeOff className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Collision warning if destination already exists */}
                {entry.destination_exists && (
                  <div className="mt-3 p-2.5 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center gap-2 text-xs text-amber-300">
                    <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Warning: A file with this target name already exists in '{currentEdit.package}'. Moving will overwrite it.</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Package Picker Popup */}
      {browsingEntry && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setBrowsingEntry(null)}
        >
          <div
            className="bg-slate-900 border border-blue-500/40 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between bg-slate-950">
              <div>
                <h3 className="text-base font-bold text-white">Select Target Package</h3>
                <p className="text-[11px] text-blue-200 font-mono truncate max-w-xs" title={browsePath || '/'}>
                  {browsePath || 'Root packages'}
                </p>
              </div>
              <button onClick={() => setBrowsingEntry(null)} className="text-orange-300 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigateBrowseUp(browsingEntry)}
                  className="px-2.5 py-1.5 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
                {browsePath && (
                  <button
                    onClick={() => selectBrowseFolder(browsingEntry)}
                    className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500 hover:bg-blue-400 text-white cursor-pointer truncate"
                    title={`Select ${browsePath}`}
                  >
                    Use “{browsePath}”
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto space-y-1">
                {(browsePath ? browseSubdirs : packagesList).map((dir) => (
                  <div key={dir} className="flex items-center gap-1">
                    <button
                      onClick={() => selectPackageDirect(browsingEntry, browsePath ? `${browsePath}/${dir}` : dir)}
                      className="flex-1 text-left px-3 py-2 rounded-lg text-xs bg-slate-800 hover:bg-blue-500/20 text-white border border-slate-700 hover:border-blue-400/40 cursor-pointer truncate"
                      title={dir}
                    >
                      <span className="inline-flex items-center gap-2 min-w-0">
                        <Folder className="w-3.5 h-3.5 text-yellow-300 shrink-0" />
                        <span className="truncate">{dir}</span>
                      </span>
                    </button>
                    <button
                      onClick={() => navigateBrowseInto(browsingEntry, dir)}
                      className="px-2 py-2 rounded-lg bg-slate-800 hover:bg-orange-500/20 text-orange-300 border border-slate-700 cursor-pointer"
                      title="Browse into folder"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {(browsePath ? browseSubdirs : packagesList).length === 0 && (
                  <p className="text-xs text-blue-200 text-center py-6">No subfolders here.</p>
                )}
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-950 border-t border-slate-700 text-[11px] text-yellow-200 text-center">
              Click a name to select · arrow to browse deeper · Esc to close
            </div>
          </div>
        </div>
      )}

      {/* Ignored Rules Modal */}
      {showIgnoredModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between bg-slate-900">
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
                <p className="text-xs text-slate-400 text-center py-6">No files currently ignored.</p>
              ) : (
                <div className="space-y-2">
                  {ignoredList.map((name) => (
                    <div
                      key={name}
                      className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-700 flex items-center justify-between text-xs"
                    >
                      <span className="font-medium text-slate-200">{name}</span>
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

            <div className="px-6 py-3.5 bg-slate-900 border-t border-slate-700 flex justify-end">
              <button
                onClick={() => setShowIgnoredModal(false)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200 cursor-pointer"
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
