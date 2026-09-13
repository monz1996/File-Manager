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
  X,
  Eye,
  Trash2,
  File,
  Plus,
  Minus,
  ArrowRight,
  GitCompare,
} from 'lucide-react';
import type { OperationLog } from '../../types';

export const ChangesTab: React.FC = () => {
  const [operations, setOperations] = useState<OperationLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [revertingId, setRevertingId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [inspectedOperation, setInspectedOperation] = useState<OperationLog | null>(null);
  const [selectedItemIndices, setSelectedItemIndices] = useState<Record<number, boolean>>({});
  const [selectedOperationIds, setSelectedOperationIds] = useState<Record<string, boolean>>({});
  const [operationItems, setOperationItems] = useState<Array<{ source: string; destination: string; action: string }>>([]);

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

  const getOperationItems = (op: OperationLog): Array<{
    source: string;
    destination: string;
    action: string;
  }> => {
    const items = op.details?.items;
    if (Array.isArray(items) && items.length > 0) {
      return items.map((item) => ({
        source: item.source,
        destination: item.destination,
        action: 'Moved',
      }));
    }

    const result: Array<{ source: string; destination: string; action: string }> = [];
    const addPaths = (paths: unknown, action: string, sourceRoot = op.source, destinationRoot = op.destination) => {
      if (!Array.isArray(paths)) return;
      paths.forEach((relativePath) => {
        if (typeof relativePath !== 'string') return;
        result.push({
          source: `${sourceRoot}\\${relativePath}`,
          destination: `${destinationRoot}\\${relativePath}`,
          action,
        });
      });
    };

    const packages = op.details?.packages;
    if (Array.isArray(packages)) {
      packages.forEach((pkg) => {
        if (!pkg || typeof pkg.package !== 'string') return;
        addPaths(pkg.copied, 'Copied', `${op.source}\\${pkg.package}`, `${op.destination}\\${pkg.package}`);
        addPaths(pkg.updated, 'Updated', `${op.source}\\${pkg.package}`, `${op.destination}\\${pkg.package}`);
        addPaths(pkg.deleted, 'Deleted from remote', `${op.source}\\${pkg.package}`, `${op.destination}\\${pkg.package}`);
      });
    } else {
      addPaths(op.details?.copied, 'Copied');
      addPaths(op.details?.updated, 'Updated');
      addPaths(op.details?.deleted, 'Deleted from remote');
    }

    return result.length > 0
      ? result
      : [{ source: op.source, destination: op.destination, action: op.action_type === 'download_move' ? 'Moved' : 'Changed' }];
  };

  const getFileName = (path: string): string => {
    const parts = path.split(/[/\\]/);
    return parts[parts.length - 1] || path;
  };

  const getDirectoryPath = (path: string): string => {
    const parts = path.split(/[/\\]/);
    return parts.slice(0, -1).join('\\') || '';
  };

  const getChangeIcon = (action: string) => {
    if (action.startsWith('Deleted')) return <Minus className="w-4 h-4 text-rose-400" />;
    if (action === 'Updated') return <GitCompare className="w-4 h-4 text-amber-400" />;
    if (action === 'Copied') return <Plus className="w-4 h-4 text-emerald-400" />;
    return <ArrowRight className="w-4 h-4 text-blue-400" />;
  };

  const getChangeColor = (action: string): string => {
    if (action.startsWith('Deleted')) return 'text-rose-300';
    if (action === 'Updated') return 'text-amber-300';
    if (action === 'Copied') return 'text-emerald-300';
    return 'text-blue-300';
  };

  const isRevertableAction = (action: string): boolean => action === 'Copied' || action === 'Moved';

  const handlePartialRevert = async () => {
    if (!inspectedOperation) return;
    
    const selectedIndices = Object.keys(selectedItemIndices)
      .filter((index) => selectedItemIndices[Number(index)])
      .map(Number);
    
    // Only files copied to the drive can be reverted safely. Deleted and updated
    // remote files do not have enough history in the activity log to restore.
    const revertableIndices = selectedIndices.filter(index => isRevertableAction(operationItems[index].action));
    
    if (revertableIndices.length === 0) {
      setFeedback({ type: 'error', message: 'Please select at least one copy/update operation to revert. Deletions cannot be reverted.' });
      return;
    }
    
    if (!window.confirm(`Revert ${revertableIndices.length} selected file(s) from this activity event?`)) return;

    try {
      const res = await fetch(`/api/history/revert/${inspectedOperation.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ indices: revertableIndices }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'error', message: data.detail || 'Failed to partially revert operation.' });
        return;
      }
      setFeedback({ type: 'success', message: data.message || 'Selected files reverted.' });
      setOperations(data.operations || []);
      setInspectedOperation(null);
      setSelectedItemIndices({});
      setOperationItems([]);
    } catch (err) {
      setFeedback({ type: 'error', message: 'Network error while partially reverting.' });
    }
  };

  const handleDeleteOperations = async (ids: string[], description: string) => {
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${description}? This removes the activity from the log and it cannot be reverted from the app.`)) return;

    try {
      const res = await fetch('/api/history/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'error', message: data.detail || 'Failed to delete activities.' });
        return;
      }
      setOperations(data.operations || []);
      setSelectedOperationIds({});
      setFeedback({ type: 'success', message: `Deleted ${data.deleted_count} activity event(s).` });
    } catch (err) {
      setFeedback({ type: 'error', message: 'Network error while deleting activities.' });
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setInspectedOperation(null);
        setOperationItems([]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleRevert = async (opId: string) => {
    const operation = operations.find(op => op.id === opId);
    if (!operation) return;
    
    // Check if all items are deletions
    const items = getOperationItems(operation);
    const allDeletions = items.every(item => item.action.startsWith('Deleted'));
    
    if (allDeletions) {
      setFeedback({ type: 'error', message: 'Cannot revert operation - all files were deletions which are not revertable.' });
      return;
    }
    
    if (!window.confirm('Are you sure you want to revert this operation? Only copy/update operations will be reverted (deletions cannot be reverted).')) {
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
          <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={filteredOps.length > 0 && filteredOps.every((op) => selectedOperationIds[op.id])}
                onChange={(event) => {
                  const updated = { ...selectedOperationIds };
                  filteredOps.forEach((op) => { updated[op.id] = event.target.checked; });
                  setSelectedOperationIds(updated);
                }}
                className="w-4 h-4 rounded text-indigo-500 bg-slate-700 border-slate-600"
              />
              Select visible activities
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDeleteOperations(
                  Object.keys(selectedOperationIds).filter((id) => selectedOperationIds[id]),
                  'the selected activity events',
                )}
                disabled={!Object.values(selectedOperationIds).some(Boolean)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 disabled:opacity-40 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Selected
              </button>
              <button
                onClick={() => handleDeleteOperations(operations.map((op) => op.id), 'all activity events')}
                disabled={operations.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 disabled:opacity-40 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete All
              </button>
            </div>
          </div>
          {filteredOps.map((op) => {
            const isReverted = op.status === 'reverted';
            const isReverting = revertingId === op.id;
            const items = getOperationItems(op);
            const allDeletions = items.every(item => item.action.startsWith('Deleted'));
            const hasRevertableItems = items.some(item => isRevertableAction(item.action));

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
                    <input
                      type="checkbox"
                      checked={!!selectedOperationIds[op.id]}
                      onChange={(event) => setSelectedOperationIds((prev) => ({ ...prev, [op.id]: event.target.checked }))}
                      className="w-4 h-4 rounded text-indigo-500 bg-slate-700 border-slate-600"
                    />
                    {getActionBadge(op.action_type)}
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{new Date(op.timestamp).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Status & Revert Action */}
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => {
                        setInspectedOperation(op);
                        setSelectedItemIndices({});
                        setOperationItems(getOperationItems(op));
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 transition cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Inspect</span>
                    </button>
                    <button
                      onClick={() => handleDeleteOperations([op.id], 'this activity event')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                    {isReverted ? (
                      <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-slate-700 text-slate-300 border border-slate-600 font-medium">
                        <Check className="w-3.5 h-3.5 text-slate-500" /> Reverted {op.reverted_at ? `(${new Date(op.reverted_at).toLocaleTimeString()})` : ''}
                      </span>
                    ) : (
                      <button
                        onClick={() => handleRevert(op.id)}
                        disabled={isReverting || !hasRevertableItems}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        title={allDeletions ? 'Cannot revert - all files were deletions' : 'Revert copy/update operations'}
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${isReverting ? 'animate-spin' : ''}`} />
                        <span>{isReverting ? 'Reverting...' : allDeletions ? 'Not Revertable' : 'Revert Change'}</span>
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

      {inspectedOperation && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Activity Event Details</h3>
                <p className="text-xs text-slate-400">
                  {inspectedOperation.description} · Status: {inspectedOperation.status}
                </p>
              </div>
              <button onClick={() => {
                setInspectedOperation(null);
                setOperationItems([]);
              }} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="px-6 py-4 border-b border-slate-700/50 bg-slate-800/30">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Source</span>
                    <code className="block mt-1 text-slate-200 break-all font-mono">{inspectedOperation.source}</code>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Destination</span>
                    <code className="block mt-1 text-indigo-300 break-all font-mono">{inspectedOperation.destination}</code>
                  </div>
                </div>
              </div>

              <div className="p-4">
                {(() => {
                  const items = operationItems;
                  const deletions = items.filter(item => item.action.startsWith('Deleted'));
                  const copyOperations = items.filter(item => isRevertableAction(item.action));
                  const otherChanges = items.filter(item => item.action === 'Updated');
                  
                  return (
                    <>
                      {copyOperations.length > 0 && (
                        <div className="mb-6">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-white">Copy Operations (Selectable for Revert)</h4>
                            <span className="text-xs text-slate-400">{copyOperations.length} files</span>
                          </div>
                          
                          <div className="space-y-2">
                            {copyOperations.map((item) => {
                              const originalIndex = items.indexOf(item);
                              return (
                              <label 
                                key={`change-${originalIndex}`} 
                                className="flex items-start gap-3 p-3 rounded-lg bg-slate-800 border border-slate-700 hover:border-slate-600 cursor-pointer transition"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedItemIndices[originalIndex] || false}
                                  onChange={(event) => setSelectedItemIndices((prev) => ({ ...prev, [originalIndex]: event.target.checked }))}
                                  className="mt-1 w-4 h-4 rounded text-indigo-500 bg-slate-700 border-slate-600"
                                />
                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                  <div className="flex-shrink-0 mt-0.5">
                                    {getChangeIcon(item.action)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <File className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getChangeColor(item.action)} bg-slate-700/50`}>
                                        {item.action}
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                      <div className="bg-slate-900/50 rounded p-2">
                                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">From</span>
                                        <span className="text-sm font-medium text-white break-all">{getFileName(item.source)}</span>
                                        <code className="block mt-0.5 text-slate-300 break-all font-mono text-[11px]">
                                          {getDirectoryPath(item.source) || item.source}
                                        </code>
                                      </div>
                                      <div className="bg-slate-900/50 rounded p-2">
                                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">To</span>
                                        <span className="text-sm font-medium text-white break-all">{getFileName(item.destination)}</span>
                                        <code className="block mt-0.5 text-indigo-300 break-all font-mono text-[11px]">
                                          {getDirectoryPath(item.destination) || item.destination}
                                        </code>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </label>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {otherChanges.length > 0 && (
                        <div className="mb-6">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-white">Updated Operations (View Only)</h4>
                            <span className="text-xs text-slate-400">{otherChanges.length} files</span>
                          </div>
                          <div className="space-y-2">
                            {otherChanges.map((item) => (
                              <div key={`updated-${item.destination}`} className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 opacity-75">
                                <GitCompare className="w-4 h-4 text-amber-400 mt-0.5" />
                                <div className="min-w-0">
                                  <div className="text-sm font-medium text-slate-300">{getFileName(item.destination)}</div>
                                  <code className="text-[11px] text-indigo-300 break-all font-mono">{item.destination}</code>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {deletions.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-white">Delete Operations (View Only - Not Revertable)</h4>
                            <span className="text-xs text-slate-400">{deletions.length} files</span>
                          </div>
                          
                          <div className="space-y-2">
                            {deletions.map((item) => {
                              const originalIndex = items.indexOf(item);
                              return (
                              <div 
                                key={`deleted-${item.destination}-${originalIndex}`} 
                                className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 opacity-75"
                              >
                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                  <div className="flex-shrink-0 mt-0.5">
                                    {getChangeIcon(item.action)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <File className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                      <span className="text-sm font-medium text-slate-300 truncate">{getFileName(item.destination)}</span>
                                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-rose-300 bg-rose-500/10 border border-rose-500/20">
                                        {item.action}
                                      </span>
                                      <span className="text-[10px] text-slate-500 italic">View only</span>
                                    </div>
                                    <div className="bg-slate-900/50 rounded p-2 text-xs">
                                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">Deleted from Drive</span>
                                      <code className="text-indigo-300 break-all font-mono text-[11px]">{item.destination}</code>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      
                      {items.length === 0 && (
                        <div className="text-center py-8 text-slate-400 text-sm">
                          No file changes found for this operation
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-950 border-t border-slate-700 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">Press Esc to close</span>
              <div className="flex items-center gap-2">
                {(() => {
                  const selectedIndices = Object.keys(selectedItemIndices)
                    .filter((index) => selectedItemIndices[Number(index)])
                    .map(Number);
                  const revertableCount = selectedIndices.filter(index => isRevertableAction(operationItems[index].action)).length;
                  const deletionCount = selectedIndices.filter(index => operationItems[index].action.startsWith('Deleted')).length;
                  const totalSelected = selectedIndices.length;
                  
                  return (
                    <button
                      onClick={handlePartialRevert}
                      disabled={revertableCount === 0}
                      className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      title={deletionCount > 0 ? `${deletionCount} selected deletions cannot be reverted` : ''}
                    >
                      {totalSelected === 0 
                        ? 'Select Copy Operations to Revert'
                        : deletionCount > 0 
                          ? `Revert ${revertableCount} Selected Copy Operations`
                          : `Revert ${revertableCount} Selected Copy Operations`
                      }
                    </button>
                  );
                })()}
                <button
                  onClick={() => {
                    setInspectedOperation(null);
                    setOperationItems([]);
                  }}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-white cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
