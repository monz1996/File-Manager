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
  ShieldCheck
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

  const fetchAudit = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/audit/names?scope=${scope}`);
      if (res.ok) {
        const data: NameAuditResponse = await res.json();
        setAuditData(data);

        // Precompute default suggestions
        const initialEdits: Record<string, string> = {};
        data.issues.forEach((item) => {
          const key = `${item.folder}/${item.path}/${item.name}`;
          const spellingIssue = item.issues.find((i) => i.kind === 'english_spelling' && i.suggestion);
          if (spellingIssue && spellingIssue.token && spellingIssue.suggestion) {
            // Replace token with suggestion in name
            const fixed = item.name.replace(new RegExp(spellingIssue.token, 'gi'), spellingIssue.suggestion);
            initialEdits[key] = fixed;
          } else {
            // Clean repeated spaces or punctuation
            let cleaned = item.name
              .replace(/ {2,}/g, ' ')
              .replace(/([!?$#@%&*._-])\1{2,}/g, '$1')
              .trim();
            initialEdits[key] = cleaned;
          }
        });
        setEditedSuggestions(initialEdits);
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

  const handleApplySingle = async (item: NameAuditEntry) => {
    const key = `${item.folder}/${item.path}/${item.name}`;
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
          message: `Renamed '${item.name}' &rarr; '${newName}'. Transaction logged to Activity Tab for undo.`,
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

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <SpellCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Spelling & Name Quality Audit</h2>
              <p className="text-xs text-slate-400">
                Detect spelling errors, mojibake encoding glitches, repeated letters, and bad formatting across all local files.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Scope selector */}
          <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700 text-xs">
            {(['all', 'files', 'packages'] as const).map((sc) => (
              <button
                key={sc}
                onClick={() => setScope(sc)}
                className={`px-3 py-1.5 rounded-lg font-medium capitalize transition cursor-pointer ${
                  scope === sc ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {sc}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowIgnoredModal(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
          >
            <EyeOff className="w-3.5 h-3.5 text-amber-400" />
            <span>Ignored ({ignoredList.length})</span>
          </button>

          <button
            onClick={fetchAudit}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
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

      {/* Summary Note */}
      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs text-slate-400">
        <span>
          Found <strong className="text-white">{issues.length}</strong> suspicious items ({ignoredList.length} ignored).
        </span>
        <span className="text-[11px] text-slate-500">{auditData?.arabic_note}</span>
      </div>

      {/* Issues List */}
      {issues.length === 0 ? (
        <div className="p-16 text-center rounded-2xl bg-slate-900/40 border border-slate-800">
          <ShieldCheck className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-300">All File & Package Names Look Great!</h3>
          <p className="text-xs text-slate-500 mt-1">
            No spelling mistakes or encoding anomalies found in scope: <strong className="text-indigo-300">{scope}</strong>.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {issues.map((item) => {
            const key = `${item.folder}/${item.path}/${item.name}`;
            const currentSuggested = editedSuggestions[key] || item.name;

            return (
              <div
                key={key}
                className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 shadow-md transition space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  {/* Item info */}
                  <div className="flex items-start gap-2.5 flex-1 min-w-[280px]">
                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 shrink-0">
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
                        <span className="text-[10px] uppercase font-bold px-2 py-0.2 rounded bg-slate-800 text-indigo-300">
                          {item.type} &bull; {item.folder}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-mono truncate mt-0.5" title={item.path}>
                        {item.path}
                      </p>

                      {/* Issue badges */}
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

                  {/* Suggestion / Rename input & Action buttons */}
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
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-emerald-300 font-semibold focus:outline-none focus:border-indigo-500 font-mono"
                      />
                    </div>

                    <div className="flex items-center gap-1.5 pt-4">
                      <button
                        onClick={() => handleApplySingle(item)}
                        disabled={applying}
                        className="flex items-center gap-1 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition cursor-pointer"
                        title="Rename file on disk"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Apply Fix</span>
                      </button>

                      <button
                        onClick={() => handleIgnore(item.name)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-amber-400 border border-slate-700 transition cursor-pointer"
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
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
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
                <p className="text-xs text-slate-500 text-center py-6">No names currently ignored.</p>
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
                        Unignore
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
