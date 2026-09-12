import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { 
  Film, 
  BarChart3, 
  PieChart, 
  Layers, 
  Clock, 
  HardDrive, 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  RefreshCw, 
  Eye, 
  X,
  Search,
  Video
} from 'lucide-react';
import type { VideoMetadataResponse, VideoPackage } from '../../types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
);

export const VideoAnalyticsTab: React.FC = () => {
  const [data, setData] = useState<VideoMetadataResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [rescanning, setRescanning] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<VideoPackage | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<'size' | 'count' | 'duration' | 'name'>('size');

  const fetchMetadata = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/video-metadata');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  const handleRescan = async () => {
    setRescanning(true);
    try {
      const res = await fetch('/api/video-metadata/rescan', { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRescanning(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="p-16 text-center">
        <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-400">Loading video metadata & charts...</p>
      </div>
    );
  }

  const packages = data?.packages || [];
  const qualityCounts = data?.quality_counts || {};

  // Filter & sort packages
  const filteredPackages = packages
    .filter((pkg) => pkg.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortOption === 'size') return b.size_bytes - a.size_bytes;
      if (sortOption === 'count') return b.video_count - a.video_count;
      if (sortOption === 'duration') return b.total_duration_seconds - a.total_duration_seconds;
      return a.name.localeCompare(b.name);
    });

  // Chart Data 1: Video Quality Distribution (Doughnut)
  const qualityLabels = Object.keys(qualityCounts);
  const qualityValues = Object.values(qualityCounts);
  const qualityColors = [
    '#6366f1', // indigo (e.g. 1080p)
    '#8b5cf6', // purple (e.g. 4K)
    '#ec4899', // pink
    '#06b6d4', // cyan (e.g. 720p)
    '#f59e0b', // amber (e.g. 480p)
    '#10b981', // emerald
    '#64748b', // slate (unknown)
  ];

  const qualityChartData = {
    labels: qualityLabels.length ? qualityLabels : ['None'],
    datasets: [
      {
        data: qualityValues.length ? qualityValues : [1],
        backgroundColor: qualityColors.slice(0, qualityLabels.length),
        borderColor: '#0f172a',
        borderWidth: 2,
      },
    ],
  };

  // Chart Data 2: Top Packages by Size (GB)
  const topPackagesBySize = [...packages].sort((a, b) => b.size_bytes - a.size_bytes).slice(0, 10);
  const packageSizeChartData = {
    labels: topPackagesBySize.map((p) => p.name.length > 15 ? `${p.name.slice(0, 15)}...` : p.name),
    datasets: [
      {
        label: 'Video Size (GB)',
        data: topPackagesBySize.map((p) => Number((p.video_size_bytes / (1024 * 1024 * 1024)).toFixed(2))),
        backgroundColor: 'rgba(99, 102, 241, 0.85)',
        borderRadius: 6,
      },
      {
        label: 'Other Files (GB)',
        data: topPackagesBySize.map((p) => Number(((p.size_bytes - p.video_size_bytes) / (1024 * 1024 * 1024)).toFixed(2))),
        backgroundColor: 'rgba(148, 163, 184, 0.4)',
        borderRadius: 6,
      },
    ],
  };

  return (
    <div className="space-y-6">
      {/* Header & Rescan */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Video Quality & Metadata Analytics</h2>
              <p className="text-xs text-slate-400">
                Detailed package metrics, resolution spectrum, file size extremes, and video durations.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleRescan}
          disabled={rescanning}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${rescanning ? 'animate-spin' : ''}`} />
          <span>{rescanning ? 'Scanning Videos...' : 'Rescan Videos Folder'}</span>
        </button>
      </div>

      {/* Global KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-indigo-400" /> Total Video Size
          </span>
          <p className="text-xl font-extrabold text-white mt-1">{data?.total_size_readable || '0 B'}</p>
          <span className="text-[11px] text-slate-500">{data?.package_count || 0} packages cataloged</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <Video className="w-3.5 h-3.5 text-purple-400" /> Total Video Files
          </span>
          <p className="text-xl font-extrabold text-white mt-1">{data?.video_file_count?.toLocaleString() || 0}</p>
          <span className="text-[11px] text-slate-500">{data?.videos_with_known_quality || 0} with quality metadata</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-cyan-400" /> Total Duration
          </span>
          <p className="text-xl font-extrabold text-white mt-1">{data?.total_duration_readable || '00:00:00'}</p>
          <span className="text-[11px] text-slate-500">{Math.round((data?.total_duration_seconds || 0) / 3600)} hours of footage</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Primary Quality
          </span>
          <p className="text-xl font-extrabold text-white mt-1">
            {Object.entries(qualityCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '1080p'}
          </p>
          <span className="text-[11px] text-slate-500">Most frequent resolution</span>
        </div>
      </div>

      {/* Visual Analytics Graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quality Distribution Doughnut */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <PieChart className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-bold text-white">Quality Spectrum</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">Breakdown of all indexed video resolutions</p>
          </div>
          <div className="h-56 flex items-center justify-center">
            <Doughnut
              data={qualityChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'bottom',
                    labels: { color: '#94a3b8', boxWidth: 12, font: { size: 11 } },
                  },
                },
              }}
            />
          </div>
        </div>

        {/* Package Sizes Bar Chart */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-white">Top Video Packages by Size (GB)</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">Storage footprint of largest video packages</p>
          </div>
          <div className="h-56">
            <Bar
              data={packageSizeChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  x: { stacked: true, ticks: { color: '#94a3b8', font: { size: 10 } } },
                  y: { stacked: true, ticks: { color: '#94a3b8', font: { size: 10 } } },
                },
                plugins: {
                  legend: {
                    position: 'top',
                    labels: { color: '#94a3b8', boxWidth: 12, font: { size: 11 } },
                  },
                },
              }}
            />
          </div>
        </div>
      </div>

      {/* Packages Table & Drill-Down Section */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              Package Metadata & Quality Extremes ({filteredPackages.length})
            </h3>
            <p className="text-xs text-slate-400">
              Highest/lowest quality, file size extremes, video counts, and duration for every package
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search packages..."
                className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Sort Options */}
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as any)}
              className="px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="size">Sort: Size (High &rarr; Low)</option>
              <option value="count">Sort: Video Count</option>
              <option value="duration">Sort: Duration</option>
              <option value="name">Sort: Name (A &rarr; Z)</option>
            </select>
          </div>
        </div>

        {/* Package Grid Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPackages.map((pkg) => (
            <div
              key={pkg.name}
              className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition duration-150 flex flex-col justify-between space-y-4 shadow-md"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <Film className="w-4 h-4 text-indigo-400" />
                      {pkg.name}
                    </h4>
                    <span className="text-[11px] text-slate-400 font-mono">{pkg.path}</span>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-bold text-indigo-300 block">{pkg.size_readable}</span>
                    <span className="text-[11px] text-slate-500">{pkg.video_count} videos ({pkg.file_count} files)</span>
                  </div>
                </div>

                {/* Quality & Size Extremes Badge Box */}
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  {/* Highest Quality */}
                  <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
                    <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1 mb-1">
                      <TrendingUp className="w-3 h-3" /> Highest Quality
                    </span>
                    {pkg.highest_quality_video ? (
                      <div>
                        <span className="font-bold text-slate-200 text-xs px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                          {pkg.highest_quality_video.quality_label || pkg.highest_quality_video.resolution}
                        </span>
                        <p className="text-[11px] text-slate-400 truncate mt-1" title={pkg.highest_quality_video.name}>
                          {pkg.highest_quality_video.name}
                        </p>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-500">N/A</span>
                    )}
                  </div>

                  {/* Lowest Quality */}
                  <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
                    <span className="text-[10px] font-semibold text-amber-400 flex items-center gap-1 mb-1">
                      <TrendingDown className="w-3 h-3" /> Lowest Quality
                    </span>
                    {pkg.lowest_quality_video ? (
                      <div>
                        <span className="font-bold text-slate-200 text-xs px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                          {pkg.lowest_quality_video.quality_label || pkg.lowest_quality_video.resolution}
                        </span>
                        <p className="text-[11px] text-slate-400 truncate mt-1" title={pkg.lowest_quality_video.name}>
                          {pkg.lowest_quality_video.name}
                        </p>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-500">N/A</span>
                    )}
                  </div>

                  {/* Highest File Size */}
                  <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
                    <span className="text-[10px] font-semibold text-blue-400 flex items-center gap-1 mb-1">
                      <HardDrive className="w-3 h-3" /> Largest File
                    </span>
                    {pkg.highest_file_size_video ? (
                      <div>
                        <span className="font-bold text-slate-200 text-xs">{pkg.highest_file_size_video.size_readable}</span>
                        <p className="text-[11px] text-slate-400 truncate mt-1" title={pkg.highest_file_size_video.name}>
                          {pkg.highest_file_size_video.name}
                        </p>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-500">N/A</span>
                    )}
                  </div>

                  {/* Lowest File Size */}
                  <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
                    <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1 mb-1">
                      <HardDrive className="w-3 h-3" /> Smallest File
                    </span>
                    {pkg.lowest_file_size_video ? (
                      <div>
                        <span className="font-bold text-slate-200 text-xs">{pkg.lowest_file_size_video.size_readable}</span>
                        <p className="text-[11px] text-slate-400 truncate mt-1" title={pkg.lowest_file_size_video.name}>
                          {pkg.lowest_file_size_video.name}
                        </p>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-500">N/A</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" /> Duration: <strong className="text-slate-200">{pkg.total_duration_readable}</strong>
                </span>
                <button
                  onClick={() => setSelectedPackage(pkg)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-semibold transition cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Inspect Videos ({pkg.video_count})</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Package Drill-Down Modal */}
      {selectedPackage && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Film className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{selectedPackage.name}</h3>
                  <p className="text-xs text-slate-400">
                    {selectedPackage.video_count} videos | {selectedPackage.size_readable} | {selectedPackage.total_duration_readable} total duration
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPackage(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video List Table */}
            <div className="p-6 overflow-y-auto flex-1 space-y-3">
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Video Name</th>
                      <th className="py-3 px-3 font-semibold">Quality</th>
                      <th className="py-3 px-3 font-semibold">Resolution</th>
                      <th className="py-3 px-3 font-semibold">Size</th>
                      <th className="py-3 px-3 font-semibold">Duration</th>
                      <th className="py-3 px-3 font-semibold">Bitrate</th>
                      <th className="py-3 px-3 font-semibold">Aspect Ratio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
                    {selectedPackage.videos.map((vid, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40 transition">
                        <td className="py-2.5 px-4 font-medium text-slate-200 max-w-xs truncate" title={vid.name}>
                          {vid.name}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                            {vid.quality.quality_label || 'Unknown'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-300 font-mono">{vid.quality.resolution || '-'}</td>
                        <td className="py-2.5 px-3 text-slate-300 font-medium">{vid.size_readable}</td>
                        <td className="py-2.5 px-3 text-slate-300 font-mono">{vid.duration_readable || '-'}</td>
                        <td className="py-2.5 px-3 text-slate-400">{vid.quality.estimated_total_bitrate_kbps ? `${vid.quality.estimated_total_bitrate_kbps} kbps` : '-'}</td>
                        <td className="py-2.5 px-3 text-slate-400">{vid.quality.aspect_ratio || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedPackage(null)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
