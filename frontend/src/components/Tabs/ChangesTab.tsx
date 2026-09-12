import React, { useState, useEffect } from 'react';
import { 
  History, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  FolderSync, 
  FileEdit, 
  HardDrive,
  Download,
  Check,
  X
} from 'lucide-react';
import type { OperationLog } from '../../types';

export const ChangesTab: React.FC = () => {
  const [operations, setOperations] = useState<OperationLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [revertingId, setRevertingId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/history');
      if (res.ok) {
        const data = await res.json();
        setOperations(data.operations || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleRevert = async (opId: string) => {
    if (!window.confirm('Are you sure you want to revert this operation? The file will be restored to its original location/name.')) {
      return;
    }
    setRevertingId(opId);
    setFeedback(null);
    try {
      const res = await fetch(`/api/history/revert/${opId}`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setFeedback({ type: 'success', message: data.message || 'Operation reverted successfully!' });
        setOperations(data.operations || []);
      } else {
        setFeedback({ type: 'error', message: data.detail || 'Failed to revert operation.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Network error while attempting to revert.' });
    } finally {
      setRevertingId(null);
    }
  };

  const filteredOps = operations.filter((op) => {
    if (selectedType === 'all') return true;
    return op.action_type === selectedType;
  });

  const getActionBadge = (type: string) => {
    switch (type) {
      case 'download_move':
        return (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Download className="w-3.5 h-3.5" /> Downloads &rarr; Local
          </span>
        );
      case 'drive_sync':
        return (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <HardDrive className="w-3.5 h-3.5" /> Local &rarr; Drive (D:)
          </span>
        );
      case 'audit_rename':
      case 'local_rename':
        return (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <FileEdit className="w-3.5 h-3.5" /> Spell / Rename Fix
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-700 text-slate-300">
            <FolderSync className="w-3.5 h-3.5" /> {type}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Summary */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-800 via-indigo-900/40 to-slate-800 border border-slate-700 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Activity Log & Transaction Revert</h2>
              <p className="text-xs text-slate-400">
                Track all file movements, hard drive synchronizations, and name corrections with 1-click undo.
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-700 text-xs">
            <button
              onClick={() => setSelectedType('all')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                selectedType === 'all' ? 'bg-indigo-500 text-white shadow' : 'text-slate-300 hover:text-white'
              }`}
            >
              All ({operations.length})
            </button>
            <button
              onClick={() => setSelectedType('download_move')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                selectedType === 'download_move' ? 'bg-indigo-500 text-white shadow' : 'text-slate-300 hover:text-white'
              }`}
            >
              Downloads ({operations.filter((o) => o.action_type === 'download_move').length})
            </button>
            <button
              onClick={() => setSelectedType('drive_sync')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                selectedType === 'drive_sync' ? 'bg-indigo-500 text-white shadow' : 'text-slate-300 hover:text-white'
              }`}
            >
              Drive Sync ({operations.filter((o) => o.action_type === 'drive_sync').length})
            </button>
            <button
              onClick={() => setSelectedType('audit_rename')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                selectedType === 'audit_rename' ? 'bg-indigo-500 text-white shadow' : 'text-slate-300 hover:text-white'
              }`}
            >
              Renames ({operations.filter((o) => o.action_type === 'audit_rename' || o.action_type === 'local_rename').length})
            </button>
          </div>

          <button
            onClick={fetchHistory}
            disabled={loading}
            className="px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
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

      {/* Operations List */}
      {filteredOps.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-800/40 border border-slate-700">
          <History className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-200">No Operations Recorded Yet</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            When you move files from Downloads, synchronize packages with your Hard Drive, or apply spelling fixes, they will appear here with full undo support.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOps.map((op) => {
            const isReverted = op.status === 'reverted';
            const isReverting = revertingId === op.id;

            return (
              <div
                key={op.id}
                className={`p-4 rounded-xl border transition duration-150 ${
                  isReverted
                    ? 'bg-slate-800/30 border-slate-700/50 opacity-70'
                    : 'bg-slate-800/60 border-slate-700 hover:border-slate-600 shadow-md'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {getActionBadge(op.action_type)}
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{new Date(op.timestamp).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Status & Revert Action */}
                  <div className="flex items-center gap-2.5">
                    {isReverted ? (
                      <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-slate-700 text-slate-300 border border-slate-600 font-medium">
                        <Check className="w-3.5 h-3.5 text-slate-500" /> Reverted {op.reverted_at ? `(${new Date(op.reverted_at).toLocaleTimeString()})` : ''}
                      </span>
                    ) : (
                      <button
                        onClick={() => handleRevert(op.id)}
                        disabled={isReverting}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition cursor-pointer disabled:opacity-50"
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${isReverting ? 'animate-spin' : ''}`} />
                        <span>{isReverting ? 'Reverting...' : 'Revert Change'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Description & Paths */}
                <div className="mt-3">
                  <p className="text-sm font-medium text-slate-200">{op.description}</p>
                  
                  <div className="mt-2.5 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-700/80">
                      <span className="text-[11px] font-semibold text-slate-300 block mb-0.5">Source Path:</span>
                      <code className="text-slate-200 break-all select-all font-mono">{op.source}</code>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-700/80">
                      <span className="text-[11px] font-semibold text-slate-300 block mb-0.5">Destination Path:</span>
                      <code className="text-indigo-300 break-all select-all font-mono">{op.destination}</code>
                    </div>
                  </div>

                  {/* Extra Details if any */}
                  {op.details && Object.keys(op.details).length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                      {op.details.copied_count !== undefined && (
                        <span>Files Copied: <strong className="text-slate-200">{op.details.copied_count}</strong></span>
                      )}
                      {op.details.updated_count !== undefined && (
                        <span>Files Updated: <strong className="text-slate-200">{op.details.updated_count}</strong></span>
                      )}
                      {op.details.deleted_count !== undefined && (
                        <span>Files Deleted: <strong className="text-slate-200">{op.details.deleted_count}</strong></span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
