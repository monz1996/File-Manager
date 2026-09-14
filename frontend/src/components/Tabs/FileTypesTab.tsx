import React, { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  BarChart3,
  Eye,
  FileType2,
  Folder,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { openLocalFile } from '../../utils/openFile';
import { sortPackagesBySearch } from '../../utils/packageSearch';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

interface PackageStats {
  id: string;
  folder: string;
  name: string;
  relative_path?: string;
  file_count: number;
  size_bytes: number;
  size_readable: string;
  extensions: Record<string, number>;
  extension_count: number;
  top_extension: string;
  local_path?: string;
  files: Array<{
    name: string;
    path: string;
    folder: string;
    extension: string;
    size_bytes: number;
    size_readable: string;
  }>;
}

interface FileTypeStatsResponse {
  package_count: number;
  file_count: number;
  total_size_readable: string;
  folders: Array<{
    folder: string;
    relative_path?: string;
    package_count: number;
    file_count: number;
    size_bytes: number;
    size_readable: string;
    extensions: Record<string, number>;
    files?: PackageStats['files'];
  }>;
  packages: PackageStats[];
}

const EXT_COLORS = [
  '#3b82f6', '#facc15', '#f97316', '#ffffff', '#60a5fa',
  '#fbbf24', '#fb923c', '#93c5fd', '#fde047', '#fdba74',
];

export const FileTypesTab: React.FC = () => {
  const [data, setData] = useState<FileTypeStatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [folderFilter, setFolderFilter] = useState('all');
  const [selectedPackage, setSelectedPackage] = useState<PackageStats | null>(null);
  const [inspectSort, setInspectSort] = useState<'name' | 'extension' | 'size'>('name');
  const [inspectSortDir, setInspectSortDir] = useState<'asc' | 'desc'>('asc');
  const [inspectSearch, setInspectSearch] = useState('');

  const allPackages = [
    ...(data?.folders || []).map((folder) => ({
      ...folder,
      id: `folder:${folder.folder}`,
      name: folder.folder,
      relative_path: folder.relative_path || folder.folder,
      extension_count: Object.keys(folder.extensions).length,
      top_extension: Object.entries(folder.extensions)
        .sort((left, right) => right[1] - left[1])[0]?.[0] || '',
      files: folder.files || [],
    })),
    ...(data?.packages || []).filter((pkg) => pkg.name !== pkg.folder),
  ];

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/file-type-stats');
      if (res.ok) setData(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedPackage(null);
        setInspectSearch('');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggleInspectSort = (col: 'name' | 'extension' | 'size') => {
    if (inspectSort === col) {
      setInspectSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setInspectSort(col);
      setInspectSortDir(col === 'size' ? 'desc' : 'asc');
    }
  };

  const getInspectFiles = () => {
    if (!selectedPackage) return [];
    const q = inspectSearch.trim().toLowerCase();
    let files = selectedPackage.files;
    if (q) {
      files = files.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.path.toLowerCase().includes(q) ||
          f.extension.toLowerCase().includes(q)
      );
    }
    const dir = inspectSortDir === 'asc' ? 1 : -1;
    return [...files].sort((a, b) => {
      if (inspectSort === 'size') return (a.size_bytes - b.size_bytes) * dir;
      if (inspectSort === 'extension') return a.extension.localeCompare(b.extension) * dir;
      return a.name.localeCompare(b.name) * dir;
    });
  };

  const packages = sortPackagesBySearch(
    allPackages.filter((pkg) => folderFilter === 'all' || pkg.folder === folderFilter),
    searchQuery,
  );

  const packageDisplayName = (pkg: PackageStats) => pkg.name.split(/[\\/]/).pop() || pkg.name;
  const packageRelativePath = (pkg: PackageStats) => pkg.relative_path || pkg.name;

  const overallExtCounts: Record<string, number> = {};
  for (const pkg of packages) {
    for (const [ext, count] of Object.entries(pkg.extensions)) {
      overallExtCounts[ext] = (overallExtCounts[ext] || 0) + count;
    }
  }
  const topExts = Object.entries(overallExtCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const doughnutData = {
    labels: topExts.map(([ext]) => ext),
    datasets: [{
      data: topExts.map(([, count]) => count),
      backgroundColor: EXT_COLORS,
      borderWidth: 0,
    }],
  };

  const barData = {
    labels: packages.slice(0, 12).map((pkg) => pkg.name.length > 18 ? `${pkg.name.slice(0, 18)}…` : pkg.name),
    datasets: [{
      label: 'Files',
      data: packages.slice(0, 12).map((pkg) => pkg.file_count),
      backgroundColor: '#3b82f6',
      borderRadius: 6,
    }],
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950/40 to-slate-900 border border-blue-500/30 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-400/40">
              <FileType2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Package File Type Statistics</h2>
              <p className="text-xs text-blue-100">
                Extension breakdown for every package — similar to Video Analytics.
              </p>
            </div>
          </div>
          <button
            onClick={fetchStats}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-500 hover:bg-blue-400 text-white shadow-md shadow-blue-500/30 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-slate-950/70 border border-yellow-500/30">
            <p className="text-[10px] uppercase font-bold text-yellow-300">Packages</p>
            <p className="text-xl font-extrabold text-white">{data?.package_count ?? 0}</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/70 border border-blue-500/30">
            <p className="text-[10px] uppercase font-bold text-blue-300">Files</p>
            <p className="text-xl font-extrabold text-white">{data?.file_count ?? 0}</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/70 border border-orange-500/30">
            <p className="text-[10px] uppercase font-bold text-orange-300">Total Size</p>
            <p className="text-xl font-extrabold text-white">{data?.total_size_readable ?? '0 B'}</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/70 border border-white/20">
            <p className="text-[10px] uppercase font-bold text-white/80">Extensions</p>
            <p className="text-xl font-extrabold text-white">{Object.keys(overallExtCounts).length}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-slate-900 border border-blue-500/20">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-yellow-300" /> Top Packages by File Count
          </h3>
          <div className="h-56">
            <Bar data={barData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#fff' } }, y: { ticks: { color: '#93c5fd' } } } }} />
          </div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900 border border-orange-500/20">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <FileType2 className="w-4 h-4 text-orange-300" /> Extension Mix
          </h3>
          <div className="h-56 flex items-center justify-center">
            <Doughnut data={doughnutData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#fff' } } } }} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-blue-300" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter packages..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-900 border border-blue-500/30 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-yellow-400"
          />
        </div>
        <select
          value={folderFilter}
          onChange={(e) => setFolderFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-slate-900 border border-orange-500/30 text-sm text-white cursor-pointer"
        >
          <option value="all">All Folders</option>
          {(data?.folders || []).map((f) => (
            <option key={f.folder} value={f.folder}>{f.folder}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {packages.map((pkg) => (
          <div key={pkg.id} className="p-4 rounded-xl bg-slate-900 border border-slate-600 hover:border-blue-400/50 transition space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate" title={packageDisplayName(pkg)}>{packageDisplayName(pkg)}</p>
                <p className="text-[11px] text-blue-300 flex items-center gap-1 mt-0.5">
                  <Folder className="w-3 h-3" /> {packageRelativePath(pkg)}
                </p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-200 border border-yellow-500/40 shrink-0">
                {pkg.file_count} files
              </span>
            </div>
            <p className="text-xs text-orange-200">{pkg.size_readable} · {pkg.extension_count} types · top {pkg.top_extension || 'n/a'}</p>
            <div className="flex flex-wrap gap-1">
              {Object.entries(pkg.extensions).slice(0, 6).map(([ext, count]) => (
                <span key={ext} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-100 border border-blue-400/30">
                  {ext} ×{count}
                </span>
              ))}
            </div>
            <button
              onClick={() => {
                setInspectSearch('');
                setInspectSort('name');
                setInspectSortDir('asc');
                setSelectedPackage(pkg);
              }}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/20 hover:bg-blue-500/30 text-white border border-blue-400/40 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-yellow-300" /> Inspect Files
            </button>
          </div>
        ))}
      </div>

      {selectedPackage && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelectedPackage(null)}>
          <div
            className="bg-slate-900 border border-blue-500/40 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between bg-slate-950 gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-white truncate">{packageDisplayName(selectedPackage)}</h3>
                <p className="text-xs text-blue-200">
                  {packageRelativePath(selectedPackage)} · {selectedPackage.file_count} files · {selectedPackage.size_readable}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedPackage(null);
                  setInspectSearch('');
                }}
                className="text-orange-300 hover:text-white cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-4 pt-3 flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-blue-300" />
                <input
                  value={inspectSearch}
                  onChange={(e) => setInspectSearch(e.target.value)}
                  placeholder="Filter files..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-blue-500/30 text-xs text-white focus:outline-none focus:border-yellow-400"
                  autoFocus
                />
              </div>
              <div className="flex items-center gap-1 text-[11px]">
                <span className="text-yellow-200 mr-1">Sort:</span>
                {([
                  ['name', 'Name'],
                  ['extension', 'Type'],
                  ['size', 'Size'],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => toggleInspectSort(key)}
                    className={`px-2.5 py-1 rounded-lg border cursor-pointer ${
                      inspectSort === key
                        ? 'bg-blue-500 text-white border-blue-300'
                        : 'bg-slate-900 text-blue-100 border-slate-600 hover:border-blue-400'
                    }`}
                  >
                    {label}{inspectSort === key ? (inspectSortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-1">
              {getInspectFiles().map((file, idx) => (
                <button
                  key={`${file.path}-${idx}`}
                  onClick={() => openLocalFile({ path: file.path, folder: file.folder })}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-blue-500/15 border border-transparent hover:border-blue-400/30 transition cursor-pointer"
                  title="Open file"
                >
                  <p className="text-xs font-semibold text-white truncate">{file.name}</p>
                  <p className="text-[11px] text-blue-200 font-mono break-all whitespace-pre-wrap">{file.path}</p>
                  <p className="text-[10px] text-yellow-300 mt-0.5">{file.extension} · {file.size_readable}</p>
                </button>
              ))}
              {getInspectFiles().length === 0 && (
                <p className="text-xs text-blue-100 text-center py-8">No files match this filter.</p>
              )}
            </div>
            <div className="px-6 py-3 bg-slate-950 border-t border-slate-700 text-[11px] text-orange-200 text-center">
              Showing {getInspectFiles().length} of {selectedPackage.file_count} · Click a file to open · Esc to close
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
