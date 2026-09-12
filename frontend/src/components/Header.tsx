import React from 'react';
import { 
  FolderSync, 
  HardDrive, 
  RefreshCw, 
  Database, 
  CheckCircle2, 
  XCircle 
} from 'lucide-react';
import type { SystemStatus } from '../types';

interface HeaderProps {
  status: SystemStatus | null;
  loading: boolean;
  onRefreshAll: () => void;
  onOpenDataFiles: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  loading,
  onRefreshAll,
  onOpenDataFiles,
}) => {
  const isDriveConnected = status?.connected.remote_drive.available ?? false;
  const isLocalConnected = status?.connected.local_root.available ?? false;

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-30 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
      {/* Brand & Title */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <FolderSync className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              File Manager
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
              v1.0 Pro
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Intelligent Media Organizer & Synchronization Hub
          </p>
        </div>
      </div>

      {/* Connectivity & Data Files Badges */}
      <div className="flex items-center flex-wrap gap-2.5">
        {/* Drive Connectivity Badge */}
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border ${
          isDriveConnected 
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
            : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
        }`}>
          <HardDrive className="w-3.5 h-3.5" />
          <span>Drive (D:)</span>
          {isDriveConnected ? (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-300">
              <CheckCircle2 className="w-3 h-3" /> Online
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] text-rose-300">
              <XCircle className="w-3 h-3" /> Disconnected
            </span>
          )}
        </div>

        {/* Local Folder Badge */}
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border ${
          isLocalConnected 
            ? 'bg-slate-800 text-slate-300 border-slate-700' 
            : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
        }`}>
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>Old But Gold</span>
        </div>

        {/* 4 Data Files Status Button */}
        <button
          onClick={onOpenDataFiles}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
          title="View 4 loaded data files status"
        >
          <Database className="w-3.5 h-3.5 text-indigo-400" />
          <span>4 Data Files Loaded</span>
          <span className="ml-1 px-1.5 py-0.2 rounded text-[10px] bg-indigo-500/20 text-indigo-300">
            {status ? `${status.data_files.file_index.records_count ?? 0} files` : 'Ready'}
          </span>
        </button>

        {/* Re-scan All Button */}
        <button
          onClick={onRefreshAll}
          disabled={loading}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 disabled:opacity-50 transition cursor-pointer active:scale-95"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Rescanning...' : 'Rescan Index'}</span>
        </button>
      </div>
    </header>
  );
};
