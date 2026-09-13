import React from 'react';
import { 
  FolderSync, 
  HardDrive, 
  RefreshCw, 
  Database, 
  CheckCircle2, 
  XCircle,
} from 'lucide-react';
import type { SystemStatus } from '../types';

interface HeaderProps {
  status: SystemStatus | null;
  loading: boolean;
  onRefreshAll: () => void;
  onOpenDataFiles: () => void;
  onShutdownApp: () => Promise<void>;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  loading,
  onRefreshAll,
  onOpenDataFiles,
  onShutdownApp,
}) => {
  const [shuttingDown, setShuttingDown] = React.useState(false);

  const isDriveConnected = status?.connected.remote_drive.available ?? false;
  const isLocalConnected = status?.connected.local_root.available ?? false;

  const handleShutdownApp = async () => {
    if (shuttingDown) return;
    if (!window.confirm('Shut down File Manager? Make sure all file operations are complete first.')) return;
    setShuttingDown(true);
    try {
      await onShutdownApp();
    } finally {
      setShuttingDown(false);
    }
  };

  return (
    <header className="border-b border-yellow-400/30 bg-[#1e4d7b]/90 backdrop-blur sticky top-0 z-30 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
      {/* Brand & Title */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-500 via-yellow-400 to-orange-500 flex items-center justify-center shadow-lg shadow-blue-500/40">
          <FolderSync className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-white">
              File Manager
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-200 border border-yellow-400/40 font-medium">
              v1.0 Pro
            </span>
          </div>
          <p className="text-xs text-blue-200">
            Intelligent Media Organizer & Synchronization Hub
          </p>
        </div>
        <div className="flex items-center gap-2 ml-3">
          <button
            onClick={handleShutdownApp}
            disabled={shuttingDown}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-rose-900/60 hover:bg-rose-800 text-rose-100 border border-rose-400/40 transition cursor-pointer disabled:opacity-50"
            title="Stop the File Manager server"
          >
            <span>{shuttingDown ? 'Shutting down...' : 'Shutdown App'}</span>
          </button>
        </div>
      </div>

      {/* Connectivity & Data Files Badges */}
      <div className="flex items-center flex-wrap gap-2.5">
        {/* Drive Connectivity Badge */}
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border ${
          isDriveConnected 
            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' 
            : 'bg-rose-500/15 text-rose-300 border-rose-500/40'
        }`}>
          <HardDrive className="w-3.5 h-3.5" />
          <span>Drive (D:)</span>
          {isDriveConnected ? (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-300">
              <CheckCircle2 className="w-3 h-3" /> Online
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] text-rose-300">
              <XCircle className="w-3 h-3" /> Offline
            </span>
          )}
        </div>

        {/* Local Folder Badge */}
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border ${
          isLocalConnected 
            ? 'bg-slate-900 text-white border-orange-400/40' 
            : 'bg-orange-500/15 text-orange-200 border-orange-400/40'
        }`}>
          <span className="w-2 h-2 rounded-full bg-yellow-300"></span>
          <span>Old But Gold</span>
        </div>

        {/* 4 Data Files Status Button */}
        <button
          onClick={onOpenDataFiles}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white border border-blue-500/40 transition cursor-pointer"
          title="View 4 loaded data files status"
        >
          <Database className="w-3.5 h-3.5 text-blue-300" />
          <span>4 Data Files Loaded</span>
          <span className="ml-1 px-1.5 py-0.2 rounded text-[10px] bg-blue-500/30 text-blue-100">
            {status ? `${status.data_files.file_index.records_count ?? 0} files` : 'Ready'}
          </span>
        </button>

        {/* Re-scan All Button */}
        <button
          onClick={onRefreshAll}
          disabled={loading}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-500 hover:bg-blue-400 text-white shadow-md shadow-blue-500/40 disabled:opacity-50 transition cursor-pointer active:scale-95"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Rescanning...' : 'Rescan Index'}</span>
        </button>
      </div>
    </header>
  );
};
