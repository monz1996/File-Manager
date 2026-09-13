import React, { useState, useEffect } from 'react';
import { 
  History, 
  Film, 
  Download, 
  HardDrive, 
  Search, 
  BookmarkCheck, 
  SpellCheck,
  GitCompare,
  FileType2,
  Play,
} from 'lucide-react';
import { Header } from './components/Header';
import { DataFilesModal } from './components/DataFilesModal';
import { ChangesTab } from './components/Tabs/ChangesTab';
import { VideoAnalyticsTab } from './components/Tabs/VideoAnalyticsTab';
import { FileTypesTab } from './components/Tabs/FileTypesTab';
import { DownloadsSyncTab } from './components/Tabs/DownloadsSyncTab';
import { DriveSyncTab } from './components/Tabs/DriveSyncTab';
import { ByteCompareTab } from './components/Tabs/ByteCompareTab';
import { SearchTab } from './components/Tabs/SearchTab';
import { RemoteCatalogTab } from './components/Tabs/RemoteCatalogTab';
import { NameAuditTab } from './components/Tabs/NameAuditTab';
import { EntertainmentTab } from './components/Tabs/EntertainmentTab';
import type { CurrentOperation, SystemStatus } from './types';

interface TabItem {
  id: 'changes' | 'videos' | 'entertainment' | 'file_types' | 'downloads' | 'drive' | 'byte_compare' | 'search' | 'remote_catalog' | 'name_audit';
  label: string;
  icon: React.ReactNode;
  badge?: string;
  badgeColor?: 'emerald' | 'rose' | 'indigo' | 'yellow' | 'orange';
}

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabItem['id']>('changes');
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [showDataFilesModal, setShowDataFilesModal] = useState(false);
  const [driveToast, setDriveToast] = useState<{ type: 'connected' | 'disconnected'; message: string } | null>(null);
  const [currentOperation, setCurrentOperation] = useState<CurrentOperation | null>(null);
  const prevDriveConnected = React.useRef<boolean | null>(null);
  const statusRequestRef = React.useRef<AbortController | null>(null);
  const driveRequestRef = React.useRef<AbortController | null>(null);
  const drivePollInFlightRef = React.useRef(false);
  const toastTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const shutdownTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const showDriveToast = (toast: { type: 'connected' | 'disconnected'; message: string }) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setDriveToast(toast);
    toastTimeoutRef.current = setTimeout(() => {
      setDriveToast(null);
      toastTimeoutRef.current = null;
    }, 5000);
  };

  const fetchStatus = async () => {
    statusRequestRef.current?.abort();
    const controller = new AbortController();
    statusRequestRef.current = controller;
    setLoadingStatus(true);
    try {
      const res = await fetch('/api/status', { signal: controller.signal });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        console.error(err);
      }
    } finally {
      if (statusRequestRef.current === controller) {
        statusRequestRef.current = null;
        setLoadingStatus(false);
      }
    }
  };

  useEffect(() => {
    fetchStatus();
    return () => {
      statusRequestRef.current?.abort();
      statusRequestRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const pollOperation = async () => {
      try {
        const res = await fetch('/api/operations/current');
        if (res.ok && !cancelled) {
          const data = await res.json();
          setCurrentOperation(data.operation || null);
        }
      } catch (err) {
        if (!cancelled) console.error(err);
      }
    };

    pollOperation();
    const interval = setInterval(pollOperation, 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const checkDrive = async () => {
      if (drivePollInFlightRef.current) return;
      drivePollInFlightRef.current = true;
      driveRequestRef.current?.abort();
      const controller = new AbortController();
      driveRequestRef.current = controller;
      try {
        const res = await fetch('/api/status/drive', { signal: controller.signal });
        if (res.ok) {
          const data = await res.json();
          const isMounted = data.drive_mounted;
          if (prevDriveConnected.current !== null && prevDriveConnected.current !== isMounted) {
            showDriveToast({
              type: isMounted ? 'connected' : 'disconnected',
              message: isMounted
                ? `Hard Drive (${data.drive_letter}) connected and ready!`
                : `Hard Drive (${data.drive_letter}) was disconnected!`,
            });
            fetchStatus();
          }
          prevDriveConnected.current = isMounted;
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          console.error(err);
        }
      } finally {
        if (driveRequestRef.current === controller) {
          driveRequestRef.current = null;
        }
        drivePollInFlightRef.current = false;
      }
    };

    checkDrive();
    const interval = setInterval(checkDrive, 8000);
    return () => {
      clearInterval(interval);
      driveRequestRef.current?.abort();
      driveRequestRef.current = null;
      drivePollInFlightRef.current = false;
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => () => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    if (shutdownTimeoutRef.current) {
      clearTimeout(shutdownTimeoutRef.current);
    }
  }, []);

  const handleRescanAll = async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch('/api/rescan-all', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleShutdownApp = async () => {
    try {
      const res = await fetch('/api/shutdown', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        showDriveToast({ type: 'disconnected', message: data.detail || 'Unable to shut down the app.' });
        return;
      }
      setDriveToast({ type: 'disconnected', message: `${data.message} You can now close the window.` });
      shutdownTimeoutRef.current = setTimeout(() => {
        window.close();
        shutdownTimeoutRef.current = null;
      }, 500);
    } catch {
      // The server may close the connection immediately after accepting shutdown.
      showDriveToast({ type: 'disconnected', message: 'File Manager has shut down. You can now close the window.' });
    }
  };

  const handleStopOperation = async () => {
    try {
      await fetch('/api/operations/stop', { method: 'POST' });
    } catch (err) {
      console.error(err);
    }
  };

  const tabs: TabItem[] = [
    {
      id: 'changes',
      label: 'Activity & Revert',
      icon: <History className="w-4 h-4" />,
      badge: status?.operations_count ? `${status.operations_count}` : undefined,
    },
    {
      id: 'videos',
      label: 'Video Analytics',
      icon: <Film className="w-4 h-4" />,
      badge: status?.data_files.video_metadata.records_count ? `${status.data_files.video_metadata.records_count} vids` : undefined,
    },
    {
      id: 'entertainment',
      label: 'Entertainment',
      icon: <Play className="w-4 h-4" />,
      badgeColor: 'orange',
    },
    {
      id: 'file_types',
      label: 'File Type Stats',
      icon: <FileType2 className="w-4 h-4" />,
      badgeColor: 'yellow',
    },
    {
      id: 'downloads',
      label: 'Downloads → Local',
      icon: <Download className="w-4 h-4" />,
    },
    {
      id: 'drive',
      label: 'Local \u2194 Drive (D:)',
      icon: <HardDrive className="w-4 h-4" />,
      badge: status?.connected.remote_drive.available ? 'Online' : 'Offline',
      badgeColor: status?.connected.remote_drive.available ? 'emerald' : 'rose',
    },
    {
      id: 'byte_compare',
      label: 'Byte Compare',
      icon: <GitCompare className="w-4 h-4" />,
    },
    {
      id: 'search',
      label: 'Search Hub',
      icon: <Search className="w-4 h-4" />,
    },
    {
      id: 'remote_catalog',
      label: 'Remote Catalog & Queue',
      icon: <BookmarkCheck className="w-4 h-4" />,
      badge: status?.data_files.remote_catalog.to_be_downloaded_count ? `${status.data_files.remote_catalog.to_be_downloaded_count} queued` : undefined,
      badgeColor: 'orange',
    },
    {
      id: 'name_audit',
      label: 'Spell & Name Audit',
      icon: <SpellCheck className="w-4 h-4" />,
    },
  ];

  return (
    <div className="min-h-screen text-white flex flex-col selection:bg-blue-500 selection:text-white">
      <Header
        status={status}
        loading={loadingStatus}
        onRefreshAll={handleRescanAll}
        onOpenDataFiles={() => setShowDataFilesModal(true)}
        onShutdownApp={handleShutdownApp}
      />

      {currentOperation && (
        <div className="mx-3 sm:mx-4 lg:mx-5 mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-400/30 flex items-center justify-between gap-3 text-xs">
          <div className="min-w-0">
            <span className="font-bold text-amber-200">{currentOperation.label}</span>
            <span className="text-amber-100/80 ml-2">
              {currentOperation.phase === 'byte_compare' ? 'Byte-by-byte comparison in progress' : currentOperation.phase}
              {currentOperation.total > 0 ? ` (${currentOperation.processed}/${currentOperation.total})` : ''}
            </span>
            {currentOperation.current_path && (
              <span className="block truncate text-slate-300 mt-0.5">{currentOperation.current_path}</span>
            )}
          </div>
          <button
            onClick={handleStopOperation}
            disabled={currentOperation.stop_requested}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-bold disabled:opacity-50"
          >
            {currentOperation.stop_requested ? 'Stopping...' : 'Stop Operation'}
          </button>
        </div>
      )}

      <div className="w-full max-w-none mx-auto px-3 sm:px-4 lg:px-5 py-5 flex-1 flex flex-col space-y-5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-blue-500/30 scrollbar-none">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/40 border border-blue-300'
                    : 'bg-slate-900 hover:bg-slate-800 text-white border border-slate-600'
                }`}
              >
                <span className={isActive ? 'text-yellow-300' : 'text-blue-300'}>{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : tab.badgeColor === 'emerald'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                        : tab.badgeColor === 'rose'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-400/40'
                        : tab.badgeColor === 'yellow'
                        ? 'bg-yellow-500/20 text-yellow-200 border border-yellow-400/40'
                        : tab.badgeColor === 'orange'
                        ? 'bg-orange-500/20 text-orange-200 border border-orange-400/40'
                        : 'bg-blue-500/20 text-blue-200 border border-blue-400/40'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <main className="flex-1 w-full">
          <div className={activeTab === 'changes' ? '' : 'hidden'}><ChangesTab /></div>
          <div className={activeTab === 'videos' ? '' : 'hidden'}><VideoAnalyticsTab /></div>
          <div className={activeTab === 'entertainment' ? '' : 'hidden'}><EntertainmentTab /></div>
          <div className={activeTab === 'file_types' ? '' : 'hidden'}><FileTypesTab /></div>
          <div className={activeTab === 'downloads' ? '' : 'hidden'}><DownloadsSyncTab onOperationDone={fetchStatus} /></div>
          <div className={activeTab === 'drive' ? '' : 'hidden'}>
            <DriveSyncTab status={status} onOperationDone={fetchStatus} currentOperation={currentOperation} />
          </div>
          <div className={activeTab === 'byte_compare' ? '' : 'hidden'}>
            <ByteCompareTab currentOperation={currentOperation} status={status} />
          </div>
          <div className={activeTab === 'search' ? '' : 'hidden'}><SearchTab /></div>
          <div className={activeTab === 'remote_catalog' ? '' : 'hidden'}><RemoteCatalogTab /></div>
          <div className={activeTab === 'name_audit' ? '' : 'hidden'}><NameAuditTab onOperationDone={fetchStatus} /></div>
        </main>
      </div>

      <footer className="border-t border-yellow-400/25 bg-[#1a3a5c]/90 py-4 px-6 text-center text-xs text-blue-100">
        <p>File Manager &bull; Loaded 4 Data Registries: <code className="text-yellow-300 font-mono">file_index.json</code>, <code className="text-yellow-300 font-mono">video_metadata.json</code>, <code className="text-orange-300 font-mono">remote_catalog.json</code>, <code className="text-blue-300 font-mono">old_but_gold_diff.json</code></p>
      </footer>

      <DataFilesModal
        isOpen={showDataFilesModal}
        onClose={() => setShowDataFilesModal(false)}
        status={status}
      />

      {driveToast && (
        <div className={`fixed bottom-6 right-6 z-50 p-4 rounded-xl border shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300 ${
          driveToast.type === 'connected'
            ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
            : 'bg-rose-500/20 border-rose-400/50 text-rose-200'
        }`}>
          <HardDrive className="w-5 h-5" />
          <span className="text-sm font-semibold text-white">{driveToast.message}</span>
          <button onClick={() => setDriveToast(null)} className="text-yellow-300 hover:text-white ml-2">
            {'\u2715'}
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
