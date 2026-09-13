import React, { useState, useEffect } from 'react';
import { 
  SpellCheck, 
  CheckCircle2, 
  AlertCircle, 
  EyeOff, 
  RefreshCw, 
  Check, 
  X, 
  Folder,
  File,
  ShieldCheck,
  Search,
  Ban,
} from 'lucide-react';
import type { NameAuditResponse, NameAuditEntry } from '../../types';

interface NameAuditTabProps {
  onOperationDone?: () => void;
}

export const NameAuditTab: React.FC<NameAuditTabProps> = ({ onOperationDone }) => {
  const [auditData, setAuditData] = useState<NameAuditResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [scope, setScope] = useState<'all' | 'files' | 'packages'>('all');
  const [editedSuggestions, setEditedSuggestions] = useState<Record<string, string>>({});
  const [applying, setApplying] = useState(false);
  const [showIgnoredModal, setShowIgnoredModal] = useState(false);
  const [ignoredList, setIgnoredList] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});
  const [lastSelectedIdx, setLastSelectedIdx] = useState<number | null>(null);

  const fetchAudit = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/audit/names?scope=${scope}`);
      if (res.ok) {
        const data: NameAuditResponse = await res.json();
        setAuditData(data);

        const initialEdits: Record<string, string> = {};
        data.issues.forEach((item) => {
          const key = `${item.folder}/${item.path}/${item.name}`;
          if (item.suggested_name) {
            initialEdits[key] = item.suggested_name;
          } else {
            let cleaned = item.name
              .replace(/ {2,}/g, ' ')
              .replace(/([!?$#@%&*._-])\1{2,}/g, '$1')
              .trim();
            initialEdits[key] = cleaned;
          }
        });
        setEditedSuggestions(initialEdits);
        setSelectedItems({});
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchIgnored = async () => {
    try {
      const res = await fetch('/api/audit/ignore');
      if (res.ok) {
        const data = await res.json();
        setIgnoredList(data.ignored || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchAudit();
    fetchIgnored();
  }, [scope]);

  const getItemKey = (item: NameAuditEntry) => `${item.folder}/${item.path}/${item.name}`;

  const handleApplySingle = async (item: NameAuditEntry) => {
    const key = getItemKey(item);
    const newName = editedSuggestions[key] || item.name;

    if (newName === item.name) {
      alert('The suggested name is identical to the current name. Modify it first before applying.');
      return;
    }

    setApplying(true);
    setFeedback(null);

    const payload = {
      type: item.type,
      folder: item.folder,
      path: item.path,
      current_name: item.name,
      new_name: newName,
    };

    try {
      const res = await fetch('/api/audit/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({
          type: 'success',
          message: `Renamed '${item.name}' to '${newName}'. Transaction logged to Activity Tab for undo.`,
        });
        fetchAudit();
        if (onOperationDone) onOperationDone();
      } else {
        setFeedback({ type: 'error', message: data.detail || 'Failed to rename item.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Network error while applying rename fix.' });
    } finally {
      setApplying(false);
    }
  };

  const handleApplySelected = async () => {
    const issues = auditData?.issues || [];
    const selectedKeys = Object.keys(selectedItems).filter((k) => selectedItems[k]);
    const itemsToRename = issues.filter((item) => selectedKeys.includes(getItemKey(item)));

    if (itemsToRename.length === 0) return;

    setApplying(true);
    setFeedback(null);

    const payload = {
      items: itemsToRename.map((item) => {
        const key = getItemKey(item);
        return {
          type: item.type,
          folder: item.folder,
          path: item.path,
          current_name: item.name,
          new_name: editedSuggestions[key] || item.name,
        };
      }),
    };

    try {
      const res = await fetch('/api/audit/rename-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        const successCount = data.results?.filter((r: any) => r.success).length || 0;
        setFeedback({
          type: 'success',
          message: `Batch rename complete: ${successCount} of ${itemsToRename.length} items renamed successfully.`,
        });
        setSelectedItems({});
        fetchAudit();
        if (onOperationDone) onOperationDone();
      } else {
        setFeedback({ type: 'error', message: data.detail || 'Failed to batch rename.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Network error during batch rename.' });
    } finally {
      setApplying(false);
    }
  };

  const handleIgnoreSelected = async () => {
    const issues = auditData?.issues || [];
    const selectedKeys = Object.keys(selectedItems).filter((k) => selectedItems[k]);
    const itemsToIgnore = issues.filter((item) => selectedKeys.includes(getItemKey(item)));
    const namesToIgnore = itemsToIgnore.map((item) => item.name);

    if (namesToIgnore.length === 0) return;

    try {
      // Add each ignored name one by one
      for (const name of namesToIgnore) {
        await fetch('/api/audit/ignore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });
      }
      const res = await fetch('/api/audit/ignore');
      if (res.ok) {
        const data = await res.json();
        setIgnoredList(data.ignored || []);
      }
      setSelectedItems({});
      fetchAudit();
      setFeedback({ type: 'success', message: `Ignored ${namesToIgnore.length} items.` });
    } catch (err) {
      console.error(err);
    }
  };

  const handleIgnore = async (name: string) => {
    try {
      const res = await fetch('/api/audit/ignore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const data = await res.json();
        setIgnoredList(data.ignored || []);
        fetchAudit();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUnignore = async (name: string) => {
    try {
      const res = await fetch(`/api/audit/ignore/${encodeURIComponent(name)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const data = await res.json();
        setIgnoredList(data.ignored || []);
        fetchAudit();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const issues = auditData?.issues || [];

  const normalizeSearchText = (value: string) =>
    value.toLowerCase().replace(/[._-]+/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim();

  const fuzzyMatch = (query: string, value: string): number => {
    const normalizedQuery = normalizeSearchText(query);
    const normalizedValue = normalizeSearchText(value);
    if (!normalizedQuery) return 1;
    if (normalizedValue.includes(normalizedQuery)) return 1;

    const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);
    const valueTokens = normalizedValue.split(/\s+/).filter(Boolean);
    const tokenScores = queryTokens.map((queryToken) =>
      Math.max(...valueTokens.map((valueToken) => {
        if (valueToken.includes(queryToken)) return 0.8;
        let matched = 0;
        for (const character of valueToken) {
          if (character === queryToken[matched]) matched += 1;
          if (matched === queryToken.length) break;
        }
        return matched / queryToken.length * 0.7;
      }), 0)
    );
    return tokenScores.reduce((total, score) => total + score, 0) / queryTokens.length;
  };

  const filteredIssues = issues
    .map((item, index) => ({
      item,
      index,
      score: fuzzyMatch(searchQuery, `${item.name} ${item.folder} ${item.path}`),
    }))
    .filter(({ score }) => !searchQuery || score >= 0.45)
    .sort((a, b) => searchQuery ? b.score - a.score || a.index - b.index : a.index - b.index)
    .map(({ item }) => item);

  const handleSelectWithRange = (key: string, idx: number, e: React.MouseEvent) => {
    if (e.shiftKey && lastSelectedIdx !== null) {
      const start = Math.min(lastSelectedIdx, idx);
      const end = Math.max(lastSelectedIdx, idx);
      const updated = { ...selectedItems };
      for (let i = start; i <= end; i++) {
        if (filteredIssues[i]) {
          updated[getItemKey(filteredIssues[i])] = true;
        }
      }
      setSelectedItems(updated);
    } else {
      setSelectedItems((prev) => ({ ...prev, [key]: !prev[key] }));
      setLastSelectedIdx(idx);
    }
  };

  const handleSelectAll = () => {
    if (!auditData) return;
    const allSelected = issues.every((item) => selectedItems[getItemKey(item)]);
    const updated: Record<string, boolean> = {};
    if (!allSelected) {
      issues.forEach((item) => { updated[getItemKey(item)] = true; });
    }
    setSelectedItems(updated);
  };

  const selectedCount = Object.values(selectedItems).filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-800 via-purple-900/30 to-slate-800 border border-slate-700 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/15 text-purple-300 border border-purple-500/30">
              <SpellCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Spelling & Name Quality Audit</h2>
              <p className="text-xs text-slate-300">
                Detect spelling errors, mojibake encoding glitches, repeated letters, and bad formatting across all local files.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-700 text-xs">
            {(['all', 'files', 'packages'] as const).map((sc) => (
              <button
                key={sc}
                onClick={() => setScope(sc)}
                className={`px-3 py-1.5 rounded-lg font-medium capitalize transition cursor-pointer ${
                  scope === sc ? 'bg-indigo-500 text-white shadow' : 'text-slate-300 hover:text-white'
                }`}
              >
                {sc}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowIgnoredModal(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
          >
            <EyeOff className="w-3.5 h-3.5 text-amber-400" />
            <span>Ignored ({ignoredList.length})</span>
          </button>

          <button
            onClick={fetchAudit}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Re-Audit</span>
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

      {/* Summary + Actions Bar */}
      <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <span className="text-slate-300">
            Found <strong className="text-white">{issues.length}</strong> suspicious items ({ignoredList.length} ignored).
          </span>
          {selectedCount > 0 && (
            <span className="text-indigo-300 font-semibold bg-indigo-500/15 px-2.5 py-0.5 rounded-full border border-indigo-500/30">
              {selectedCount} selected
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Instant Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter issues..."
              className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-600 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-400"
            />
          </div>

          {issues.length > 0 && (
            <>
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={issues.length > 0 && issues.every((item) => selectedItems[getItemKey(item)])}
                  onChange={handleSelectAll}
                  className="w-4 h-4 rounded text-indigo-500 focus:ring-indigo-400 bg-slate-700 border-slate-600 cursor-pointer"
                />
                <span>Select All</span>
              </label>

              <button
                onClick={handleIgnoreSelected}
                disabled={selectedCount === 0 || applying}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 disabled:opacity-40 transition cursor-pointer"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Ignore Selected ({selectedCount})</span>
              </button>

              <button
                onClick={handleApplySelected}
                disabled={selectedCount === 0 || applying}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-white shadow-md shadow-emerald-500/20 disabled:opacity-40 transition cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{applying ? 'Applying...' : `Apply Selected (${selectedCount})`}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Issues List */}
      {filteredIssues.length === 0 ? (
        <div className="p-16 text-center rounded-2xl bg-slate-800/40 border border-slate-700">
          <ShieldCheck className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-200">
            {issues.length === 0 ? 'All File & Package Names Look Great!' : 'No items match your filter'}
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            {issues.length === 0
              ? <>No spelling mistakes or encoding anomalies found in scope: <strong className="text-indigo-300">{scope}</strong>.</>
              : 'Try adjusting your search query.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredIssues.map((item, idx) => {
            const key = getItemKey(item);
            const currentSuggested = editedSuggestions[key] || item.name;
            const isSelected = !!selectedItems[key];

            return (
              <div
                key={key}
                className={`p-4 rounded-xl border transition space-y-3 ${
                  isSelected
                    ? 'bg-indigo-950/30 border-indigo-500/50 shadow-lg shadow-indigo-500/10'
                    : 'bg-slate-800/60 border-slate-700 hover:border-slate-600 shadow-md'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  {/* Checkbox + Item info */}
                  <div className="flex items-start gap-2.5 flex-1 min-w-[280px]">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onClick={(e) => handleSelectWithRange(key, idx, e)}
                      onChange={() => {}}
                      className="mt-2 w-4 h-4 rounded text-indigo-500 focus:ring-indigo-400 bg-slate-700 border-slate-600 cursor-pointer"
                    />

                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-700 shrink-0">
                      {item.type === 'package' ? (
                        <Folder className="w-4 h-4 text-amber-400" />
                      ) : (
                        <File className="w-4 h-4 text-blue-400" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-100 truncate" title={item.name}>
                          {item.name}
                        </span>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.2 rounded bg-slate-700 text-indigo-300">
                          {item.type} &bull; {item.folder}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono truncate mt-0.5" title={item.path}>
                        {item.path}
                      </p>

                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {item.issues.map((iss, iIdx) => (
                          <span
                            key={iIdx}
                            className="text-[11px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/20 font-medium"
                          >
                            {iss.message}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Suggestion input & Actions */}
                  <div className="flex items-center gap-2 w-full lg:w-auto">
                    <div className="flex-1 lg:w-72">
                      <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                        Suggested Name Fix (Editable)
                      </label>
                      <input
                        type="text"
                        value={currentSuggested}
                        onChange={(e) =>
                          setEditedSuggestions((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-600 text-xs text-emerald-300 font-semibold focus:outline-none focus:border-indigo-400 font-mono"
                      />
                    </div>

                    <div className="flex items-center gap-1.5 pt-4">
                      <button
                        onClick={() => handleApplySingle(item)}
                        disabled={applying}
                        className="flex items-center gap-1 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-white shadow-md shadow-emerald-500/20 transition cursor-pointer"
                        title="Rename file on disk"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Apply Fix</span>
                      </button>

                      <button
                        onClick={() => handleIgnore(item.name)}
                        className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-amber-400 border border-slate-600 transition cursor-pointer"
                        title="Ignore this issue"
                      >
                        <EyeOff className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Ignored Modal */}
      {showIgnoredModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between bg-slate-900">
              <div className="flex items-center gap-2.5">
                <EyeOff className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Ignored Spelling & Name Rules</h3>
              </div>
              <button onClick={() => setShowIgnoredModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3 max-h-96 overflow-y-auto">
              {ignoredList.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">No names currently ignored.</p>
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
                        Unignore
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
