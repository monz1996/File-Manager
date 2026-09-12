import React from 'react';
import { Database, FileText, Film, HardDrive, CheckCircle2, XCircle, X } from 'lucide-react';
import type { SystemStatus } from '../types';

interface DataFilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: SystemStatus | null;
}

export const DataFilesModal: React.FC<DataFilesModalProps> = ({ isOpen, onClose, status }) => {
  if (!isOpen || !status) return null;

  const dataFiles = [
    {
      key: 'file_index',
      name: 'file_index.json',
      title: 'Local File Index',
      desc: status.data_files.file_index.description,
      info: status.data_files.file_index,
      icon: <FileText className="w-5 h-5 text-blue-400" />,
      detail: `${status.data_files.file_index.records_count?.toLocaleString() ?? 0} indexed files`,
    },
    {
      key: 'video_metadata',
      name: 'video_metadata.json',
      title: 'Video Metadata & Analytics',
      desc: status.data_files.video_metadata.description,
      info: status.data_files.video_metadata,
      icon: <Film className="w-5 h-5 text-purple-400" />,
      detail: `${status.data_files.video_metadata.records_count?.toLocaleString() ?? 0} videos (${status.data_files.video_metadata.packages_count ?? 0} packages)`,
    },
    {
      key: 'remote_catalog',
      name: 'remote_catalog.json',
      title: 'Remote Drive Catalog',
      desc: status.data_files.remote_catalog.description,
      info: status.data_files.remote_catalog,
      icon: <HardDrive className="w-5 h-5 text-emerald-400" />,
      detail: `${status.data_files.remote_catalog.records_count?.toLocaleString() ?? 0} cataloged entries | ${status.data_files.remote_catalog.to_be_downloaded_count ?? 0} to be downloaded`,
    },
    {
      key: 'old_but_gold_diff',
      name: 'old_but_gold_diff.json',
      title: 'Local vs Hard Drive Diff',
      desc: status.data_files.old_but_gold_diff.description,
      info: status.data_files.old_but_gold_diff,
      icon: <Database className="w-5 h-5 text-amber-400" />,
      detail: 'Path comparison registry for D: sync',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">4 Core Data Stores Loaded</h3>
              <p className="text-xs text-slate-400">All 4 data stores are loaded into memory and ready for querying</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dataFiles.map((file) => (
              <div
                key={file.key}
                className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 flex flex-col justify-between space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-700">
                      {file.icon}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-100">{file.title}</h4>
                      <code className="text-[11px] text-indigo-300 font-mono">{file.name}</code>
                    </div>
                  </div>
                  {file.info.exists ? (
                    <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3" /> Ready
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <XCircle className="w-3 h-3" /> Missing
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">{file.desc}</p>

                <div className="pt-2 border-t border-slate-700/50 flex items-center justify-between text-xs text-slate-300">
                  <span className="font-medium text-indigo-300">{file.detail}</span>
                  <span className="text-[11px] text-slate-400">{file.info.size_readable}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/20 flex items-center justify-between text-xs text-slate-200">
            <div>
              <span className="font-semibold text-white">Drive & Local Directory Paths:</span>
              <p className="text-slate-300 mt-0.5">
                Local: <code className="text-indigo-300">{status.connected.local_root.path}</code> | Downloads: <code className="text-indigo-300">{status.connected.downloads.path}</code>
              </p>
              <p className="text-slate-300 mt-0.5">
                Drive: {status.connected.remote_drive.available ? (
                  <code className="text-emerald-300">{status.connected.remote_old_but_gold.path}</code>
                ) : (
                  <span className="text-rose-300 font-semibold">Not Connected (D: drive is unplugged)</span>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-3.5 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
