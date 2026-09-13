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
import type { SystemStatus } from './types';

interface TabItem {
  id: 'changes' | 'videos' | 'file_types' | 'downloads' | 'drive' | 'byte_compare' | 'search' | 'remote_catalog' | 'name_audit';
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
  const prevDriveConnected = React.useRef<boolean | null>(null);

  const fetchStatus = async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch('/api/status');
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

  useEffect(() => {
    fetchStatus();
  }, []);

  useEffect(() => {
    const checkDrive = async () => {
      try {
        const res = await fetch('/api/status/drive');
        if (res.ok) {
          const data = await res.json();
          const isMounted = data.drive_mounted;
          if (prevDriveConnected.current !== null && prevDriveConnected.current !== isMounted) {
            setDriveToast({
              type: isMounted ? 'connected' : 'disconnected',
              message: isMounted
                ? `Hard Drive (${data.drive_letter}) connected and ready!`
                : `Hard Drive (${data.drive_letter}) was disconnected!`,
            });
            setTimeout(() => setDriveToast(null), 5000);
            fetchStatus();
          }
          prevDriveConnected.current = isMounted;
        }
      } catch {
        // Silent fail - polling
      }
    };

    checkDrive();
    const interval = setInterval(checkDrive, 8000);
    return () => clearInterval(interval);
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

  const handleEjectDrive = async () => {
    try {
      const res = await fetch('/api/status/drive/eject', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setDriveToast({ type: 'disconnected', message: data.detail || 'Unable to eject the drive.' });
        setTimeout(() => setDriveToast(null), 5000);
        return;
      }
      setDriveToast({ type: 'disconnected', message: `${data.message} You can now disconnect it.` });
      setTimeout(() => setDriveToast(null), 5000);
      await fetchStatus();
    } catch {
      setDriveToast({ type: 'disconnected', message: 'Unable to contact the app to eject the drive.' });
      setTimeout(() => setDriveToast(null), 5000);
    }
  };

  const handleShutdownApp = async () => {
    try {
      const res = await fetch('/api/shutdown', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setDriveToast({ type: 'disconnected', message: data.detail || 'Unable to shut down the app.' });
        setTimeout(() => setDriveToast(null), 5000);
        return;
      }
      setDriveToast({ type: 'disconnected', message: `${data.message} You can now eject the drive.` });
      setTimeout(() => window.close(), 500);
    } catch {
      // The server may close the connection immediately after accepting shutdown.
      setDriveToast({ type: 'disconnected', message: 'File Manager has shut down. You can now eject the drive.' });
      setTimeout(() => setDriveToast(null), 5000);
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
        onEjectDrive={handleEjectDrive}
        onShutdownApp={handleShutdownApp}
      />

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
          {activeTab === 'changes' && <ChangesTab />}
          {activeTab === 'videos' && <VideoAnalyticsTab />}
          {activeTab === 'file_types' && <FileTypesTab />}
          {activeTab === 'downloads' && <DownloadsSyncTab onOperationDone={fetchStatus} />}
          {activeTab === 'drive' && <DriveSyncTab status={status} onOperationDone={fetchStatus} />}
          {activeTab === 'byte_compare' && <ByteCompareTab />}
          {activeTab === 'search' && <SearchTab />}
          {activeTab === 'remote_catalog' && <RemoteCatalogTab />}
          {activeTab === 'name_audit' && <NameAuditTab onOperationDone={fetchStatus} />}
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
