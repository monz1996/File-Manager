import React, { useState } from 'react';
import { 
  Search, 
  Folder, 
  HardDrive, 
  Check, 
  Copy, 
  Layers, 
  Download
} from 'lucide-react';

export const SearchTab: React.FC = () => {
  const [searchMode, setSearchMode] = useState<'local' | 'remote' | 'unified'>('local');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Local Search filters
  const [localFolder, setLocalFolder] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('match');
  const [descending, setDescending] = useState<boolean>(false);
  const [limit, setLimit] = useState<number>(50);

  // Remote Search filters
  const [remoteSection, setRemoteSection] = useState<string>('all');
  const [remoteSource, setRemoteSource] = useState<string>('all');

  // Results
  const [localResults, setLocalResults] = useState<any[]>([]);
  const [remoteResults, setRemoteResults] = useState<any[]>([]);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setHasSearched(true);

    try {
      if (searchMode === 'local') {
        const folderParam = localFolder !== 'all' ? `&folder=${encodeURIComponent(localFolder)}` : '';
        const res = await fetch(
          `/api/search/local?query=${encodeURIComponent(query)}&sort_by=${sortBy}&descending=${descending}&limit=${limit}${folderParam}`
        );
        const data = await res.json();
        setLocalResults(data.results || []);
        setRemoteResults([]);
      } else if (searchMode === 'remote') {
        const res = await fetch(
          `/api/search/remote?query=${encodeURIComponent(query)}&section=${remoteSection}&source=${remoteSource}&limit=${limit}`
        );
        const data = await res.json();
        setRemoteResults(data.results || []);
        setLocalResults([]);
      } else {
        const res = await fetch(`/api/search/unified?query=${encodeURIComponent(query)}&limit=${limit}`);
        const data = await res.json();
        setLocalResults(data.local?.results || []);
        setRemoteResults(data.remote?.results || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPath(text);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const foldersList = ['all', 'anime', 'books', 'content', 'lol', 'music', 'new_folder', 'old_music', 'pictures', 'recordings', 'songs', 'videos'];
  const sectionsList = ['all', 'anime', 'games', 'movies', 'series'];

  return (
    <div className="space-y-6">
      {/* Search Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Universal Search Hub</h2>
              <p className="text-xs text-slate-400">
                Fuzzy search local index, remote hard drive catalog, and pending download queues.
              </p>
            </div>
          </div>

          {/* Mode Selector Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700 text-xs">
            <button
              onClick={() => setSearchMode('local')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
                searchMode === 'local' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Folder className="w-3.5 h-3.5" /> Local Index
            </button>
            <button
              onClick={() => setSearchMode('remote')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
                searchMode === 'remote' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" /> Remote Catalog
            </button>
            <button
              onClick={() => setSearchMode('unified')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
                searchMode === 'unified' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> Unified (Both)
            </button>
          </div>
        </div>

        {/* Search Input Bar */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                searchMode === 'local'
                  ? "Search files by name, folder, extension (e.g. 'tutorial', 'mp4', 'piano')..."
                  : searchMode === 'remote'
                  ? "Search hard drive movies, anime, series, games catalog..."
                  : "Search simultaneously across local files & remote catalog..."
              }
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-inner"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20 disabled:opacity-50 transition cursor-pointer flex items-center gap-2"
          >
            <Search className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Searching...' : 'Search'}</span>
          </button>
        </form>

        {/* Filter Controls */}
        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-3 text-xs">
          {searchMode !== 'remote' && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Folder:</span>
                <select
                  value={localFolder}
                  onChange={(e) => setLocalFolder(e.target.value)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  {foldersList.map((f) => (
                    <option key={f} value={f}>{f === 'all' ? 'All Folders' : f}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="match">Match Score</option>
                  <option value="name">Name</option>
                  <option value="created">Created Date</option>
                  <option value="folder">Folder</option>
                </select>
              </div>

              <label className="flex items-center gap-1 text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={descending}
                  onChange={(e) => setDescending(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-indigo-600 bg-slate-800 border-slate-700 cursor-pointer"
                />
                <span>Descending</span>
              </label>
            </>
          )}

          {searchMode !== 'local' && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Section:</span>
                <select
                  value={remoteSection}
                  onChange={(e) => setRemoteSection(e.target.value)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  {sectionsList.map((s) => (
                    <option key={s} value={s}>{s === 'all' ? 'All Sections' : s}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Source:</span>
                <select
                  value={remoteSource}
                  onChange={(e) => setRemoteSource(e.target.value)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="all">All Sources</option>
                  <option value="names">Cataloged Names</option>
                  <option value="to_be_downloaded">To Be Downloaded Only</option>
                </select>
              </div>
            </>
          )}

          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-slate-400">Limit:</span>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Display */}
      {hasSearched && (
        <div className="space-y-6">
          {/* Local Search Results */}
          {(searchMode === 'local' || searchMode === 'unified') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Folder className="w-4 h-4 text-indigo-400" />
                  Local File Results ({localResults.length})
                </h3>
              </div>

              {localResults.length === 0 ? (
                <p className="text-xs text-slate-500 p-6 rounded-xl bg-slate-900/40 border border-slate-800 text-center">
                  No local files matched your query.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {localResults.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between space-y-2 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-100 truncate" title={item.name}>
                              {item.name}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 font-mono truncate mt-0.5" title={item.path}>
                            {item.path}
                          </p>
                        </div>

                        {item.score !== undefined && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                            {item.score}% match ({item.matched_by})
                          </span>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.2 rounded bg-slate-800 text-indigo-300 font-medium">
                            {item.folder}
                          </span>
                          {item.size_bytes !== undefined && (
                            <span>{formatBytes(item.size_bytes)}</span>
                          )}
                        </div>

                        <button
                          onClick={() => copyToClipboard(item.path)}
                          className="flex items-center gap-1 text-slate-400 hover:text-white cursor-pointer"
                          title="Copy relative path"
                        >
                          {copiedPath === item.path ? (
                            <span className="text-emerald-400 flex items-center gap-0.5">
                              <Check className="w-3 h-3" /> Copied
                            </span>
                          ) : (
                            <span className="flex items-center gap-0.5">
                              <Copy className="w-3 h-3" /> Copy Path
                            </span>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Remote Catalog Results */}
          {(searchMode === 'remote' || searchMode === 'unified') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-emerald-400" />
                  Remote Catalog Results ({remoteResults.length})
                </h3>
              </div>

              {remoteResults.length === 0 ? (
                <p className="text-xs text-slate-500 p-6 rounded-xl bg-slate-900/40 border border-slate-800 text-center">
                  No remote catalog entries matched your query.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {remoteResults.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between space-y-2 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-100 truncate" title={item.name}>
                              {item.name}
                            </span>
                            {item.is_to_be_downloaded && (
                              <span className="text-[10px] font-semibold px-2 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1">
                                <Download className="w-2.5 h-2.5" /> To Be Downloaded
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-emerald-400/80 font-medium block mt-0.5">
                            Category: {item.remote_section || item.folder}
                          </span>
                        </div>

                        {item.score !== undefined && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                            {item.score}%
                          </span>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                        <span className="text-slate-500">Source: {item.remote_source || 'Catalog'}</span>
                        <button
                          onClick={() => copyToClipboard(item.name)}
                          className="flex items-center gap-1 text-slate-400 hover:text-white cursor-pointer"
                        >
                          {copiedPath === item.name ? (
                            <span className="text-emerald-400 flex items-center gap-0.5">
                              <Check className="w-3 h-3" /> Copied
                            </span>
                          ) : (
                            <span className="flex items-center gap-0.5">
                              <Copy className="w-3 h-3" /> Copy Name
                            </span>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
