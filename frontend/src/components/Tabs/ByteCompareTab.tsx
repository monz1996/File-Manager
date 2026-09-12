import React, { useState, useEffect } from 'react';
import {
  GitCompare,
  CheckCircle2,
  AlertCircle,
  Folder,
  ChevronRight,
  ArrowRight,
  HardDrive,
} from 'lucide-react';

export const ByteCompareTab: React.FC = () => {
  const [localPath, setLocalPath] = useState('C:/Users/minas/Desktop/old but gold');
  const [remotePath, setRemotePath] = useState('D:/old but gold');
  const [localSubdirs, setLocalSubdirs] = useState<string[]>([]);
  const [remoteSubdirs, setRemoteSubdirs] = useState<string[]>([]);
  const [localCrumbs, setLocalCrumbs] = useState<string[]>([]);
  const [remoteCrumbs, setRemoteCrumbs] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const browseDirs = async (base: 'local' | 'remote', path: string) => {
    try {
      const res = await fetch(`/api/browse-dirs?path=${encodeURIComponent(path)}`);
      if (res.ok) {
        const data = await res.json();
        if (base === 'local') {
          setLocalSubdirs(data.dirs || []);
        } else {
          setRemoteSubdirs(data.dirs || []);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    browseDirs('local', localPath);
    browseDirs('remote', remotePath);
  }, [localPath, remotePath]);

  const navigateInto = (base: 'local' | 'remote', dir: string) => {
    if (base === 'local') {
      const newPath = `${localPath}/${dir}`.replace(/\/+/g, '/');
      setLocalCrumbs([...localCrumbs, dir]);
      setLocalPath(newPath);
    } else {
      const newPath = `${remotePath}/${dir}`.replace(/\/+/g, '/');
      setRemoteCrumbs([...remoteCrumbs, dir]);
      setRemotePath(newPath);
    }
  };

  const navigateUp = (base: 'local' | 'remote') => {
    if (base === 'local') {
      const parts = localPath.split('/').filter(Boolean);
      if (parts.length > 1) {
        parts.pop();
        setLocalCrumbs(parts.slice(1));
        setLocalPath(parts.join('/'));
      }
    } else {
      const parts = remotePath.split('/').filter(Boolean);
      if (parts.length > 1) {
        parts.pop();
        setRemoteCrumbs(parts.slice(1));
        setRemotePath(parts.join('/'));
      }
    }
  };

  const handleCompare = async () => {
    setComparing(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/compare/byte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ local_path: localPath, remote_path: remotePath }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
        if (data.different_count === 0 && data.only_local_count === 0 && data.only_remote_count === 0) {
          setFeedback({ type: 'success', message: 'Directories are identical - all files match byte-for-byte!' });
        } else {
          setFeedback({ type: 'success', message: `Comparison complete: ${data.same_count} identical, ${data.different_count} different, ${data.only_local_count} only local, ${data.only_remote_count} only remote.` });
        }
      } else {
        setFeedback({ type: 'error', message: data.detail || 'Comparison failed.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Network error during comparison.' });
    } finally {
      setComparing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-800 via-indigo-900/30 to-slate-800 border border-slate-700">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
            <GitCompare className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Byte-by-Byte Directory Comparison</h2>
            <p className="text-xs text-slate-300">
              Compare any two directories on a byte-by-byte basis. Supports deep directory navigation.
            </p>
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div className={`p-4 rounded-xl border flex items-center justify-between text-xs font-medium ${
          feedback.type === 'success'
            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
            : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
        }`}>
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
            <span>{feedback.message}</span>
          </div>
        </div>
      )}

      {/* Directory Pickers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Local Path Picker */}
        <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700">
          <div className="flex items-center gap-2 mb-3">
            <Folder className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">Local Directory</h3>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <input
              type="text"
              value={localPath}
              onChange={(e) => setLocalPath(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-400"
            />
            <button
              onClick={() => navigateUp('local')}
              className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium border border-slate-600 cursor-pointer"
            >
              Up
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {localSubdirs.length === 0 ? (
              <p className="text-xs text-slate-500 py-2 text-center">No subdirectories found</p>
            ) : (
              localSubdirs.map((dir) => (
                <button
                  key={dir}
                  onClick={() => navigateInto('local', dir)}
                  className="w-full text-left px-3 py-1.5 rounded-lg bg-slate-900/60 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 hover:text-indigo-300 cursor-pointer flex items-center gap-2 transition"
                >
                  <Folder className="w-3.5 h-3.5 text-amber-400" />
                  <span>{dir}</span>
                  <ChevronRight className="w-3 h-3 ml-auto text-slate-500" />
                </button>
              ))
            )}
          </div>
        </div>

        {/* Remote Path Picker */}
        <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700">
          <div className="flex items-center gap-2 mb-3">
            <HardDrive className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Remote Directory</h3>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <input
              type="text"
              value={remotePath}
              onChange={(e) => setRemotePath(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-400"
            />
            <button
              onClick={() => navigateUp('remote')}
              className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium border border-slate-600 cursor-pointer"
            >
              Up
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {remoteSubdirs.length === 0 ? (
              <p className="text-xs text-slate-500 py-2 text-center">No subdirectories found (drive may be disconnected)</p>
            ) : (
              remoteSubdirs.map((dir) => (
                <button
                  key={dir}
                  onClick={() => navigateInto('remote', dir)}
                  className="w-full text-left px-3 py-1.5 rounded-lg bg-slate-900/60 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 hover:text-emerald-300 cursor-pointer flex items-center gap-2 transition"
                >
                  <Folder className="w-3.5 h-3.5 text-amber-400" />
                  <span>{dir}</span>
                  <ChevronRight className="w-3 h-3 ml-auto text-slate-500" />
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Compare Button */}
      <div className="flex justify-center">
        <button
          onClick={handleCompare}
          disabled={comparing}
          className="flex items-center gap-2 px-8 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-bold shadow-lg shadow-indigo-500/30 disabled:opacity-50 transition cursor-pointer"
        >
          <GitCompare className={`w-5 h-5 ${comparing ? 'animate-spin' : ''}`} />
          <span>{comparing ? 'Comparing...' : 'Compare Byte-by-Byte'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Identical
              </span>
              <p className="text-xl font-extrabold text-emerald-400 mt-1">{result.same_count}</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" /> Different
              </span>
              <p className="text-xl font-extrabold text-amber-400 mt-1">{result.different_count}</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-indigo-400" /> Only Local
              </span>
              <p className="text-xl font-extrabold text-indigo-400 mt-1">{result.only_local_count}</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-blue-400" /> Only Remote
              </span>
              <p className="text-xl font-extrabold text-blue-400 mt-1">{result.only_remote_count}</p>
            </div>
          </div>

          {/* File Lists */}
          {result.different.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-amber-400 mb-1.5">Content Differs:</h4>
              <div className="max-h-48 overflow-y-auto p-3 rounded-lg bg-slate-900 border border-slate-700 font-mono text-[11px] space-y-1">
                {result.different.map((f: string) => (
                  <div key={f} className="text-amber-300 truncate">~ {f}</div>
                ))}
              </div>
            </div>
          )}
          {result.only_local.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-indigo-400 mb-1.5">Only in Local:</h4>
              <div className="max-h-48 overflow-y-auto p-3 rounded-lg bg-slate-900 border border-slate-700 font-mono text-[11px] space-y-1">
                {result.only_local.map((f: string) => (
                  <div key={f} className="text-indigo-300 truncate">+ {f}</div>
                ))}
              </div>
            </div>
          )}
          {result.only_remote.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-blue-400 mb-1.5">Only in Remote:</h4>
              <div className="max-h-48 overflow-y-auto p-3 rounded-lg bg-slate-900 border border-slate-700 font-mono text-[11px] space-y-1">
                {result.only_remote.map((f: string) => (
                  <div key={f} className="text-blue-300 truncate">- {f}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
