import React, { useState, useEffect } from 'react';
import { 
  History, 
  Film, 
  Download, 
  HardDrive, 
  Search, 
  BookmarkCheck, 
  SpellCheck,
} from 'lucide-react';
import { Header } from './components/Header';
import { DataFilesModal } from './components/DataFilesModal';
import { ChangesTab } from './components/Tabs/ChangesTab';
import { VideoAnalyticsTab } from './components/Tabs/VideoAnalyticsTab';
import { DownloadsSyncTab } from './components/Tabs/DownloadsSyncTab';
import { DriveSyncTab } from './components/Tabs/DriveSyncTab';
import { SearchTab } from './components/Tabs/SearchTab';
import { RemoteCatalogTab } from './components/Tabs/RemoteCatalogTab';
import { NameAuditTab } from './components/Tabs/NameAuditTab';
import type { SystemStatus } from './types';

interface TabItem {
  id: 'changes' | 'videos' | 'downloads' | 'drive' | 'search' | 'remote_catalog' | 'name_audit';
  label: string;
  icon: React.ReactNode;
  badge?: string;
  badgeColor?: 'emerald' | 'rose' | 'indigo';
}

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    'changes' | 'videos' | 'downloads' | 'drive' | 'search' | 'remote_catalog' | 'name_audit'
  >('changes');
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [showDataFilesModal, setShowDataFilesModal] = useState(false);

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
      id: 'downloads',
      label: 'Downloads → Local',
      icon: <Download className="w-4 h-4" />,
    },
    {
      id: 'drive',
      label: 'Local ↔ Drive (D:)',
      icon: <HardDrive className="w-4 h-4" />,
      badge: status?.connected.remote_drive.available ? 'Online' : 'Offline',
      badgeColor: status?.connected.remote_drive.available ? 'emerald' : 'rose',
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
    },
    {
      id: 'name_audit',
      label: 'Spell & Name Audit',
      icon: <SpellCheck className="w-4 h-4" />,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Header */}
      <Header
        status={status}
        loading={loadingStatus}
        onRefreshAll={handleRescanAll}
        onOpenDataFiles={() => setShowDataFilesModal(true)}
      />

      {/* Main Content Area */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 flex flex-col space-y-6">
        {/* Navigation Tabs Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-800 scrollbar-none">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 border border-indigo-500/50'
                    : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800/80'
                }`}
              >
                <span className={isActive ? 'text-white' : 'text-slate-400'}>{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : tab.badgeColor === 'emerald'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : tab.badgeColor === 'rose'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content Component */}
        <main className="flex-1">
          {activeTab === 'changes' && <ChangesTab />}
          {activeTab === 'videos' && <VideoAnalyticsTab />}
          {activeTab === 'downloads' && <DownloadsSyncTab onOperationDone={fetchStatus} />}
          {activeTab === 'drive' && <DriveSyncTab status={status} onOperationDone={fetchStatus} />}
          {activeTab === 'search' && <SearchTab />}
          {activeTab === 'remote_catalog' && <RemoteCatalogTab />}
          {activeTab === 'name_audit' && <NameAuditTab onOperationDone={fetchStatus} />}
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/80 py-4 px-6 text-center text-xs text-slate-500">
        <p>File Manager &bull; Loaded 4 Data Registries: <code className="text-slate-400 font-mono">file_index.json</code>, <code className="text-slate-400 font-mono">video_metadata.json</code>, <code className="text-slate-400 font-mono">remote_catalog.json</code>, <code className="text-slate-400 font-mono">old_but_gold_diff.json</code></p>
      </footer>

      {/* Data Files Modal */}
      <DataFilesModal
        isOpen={showDataFilesModal}
        onClose={() => setShowDataFilesModal(false)}
        status={status}
      />
    </div>
  );
};

export default App;
