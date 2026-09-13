import React, { useEffect, useState } from 'react';
import { 
  Search, 
  Folder, 
  HardDrive, 
  Check, 
  Copy, 
  Layers, 
  Download,
  Database,
} from 'lucide-react';
import { openLocalFile } from '../../utils/openFile';

export const SearchTab: React.FC = () => {
  const [searchMode, setSearchMode] = useState<'local' | 'remote' | 'unified'>('local');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [localFolder, setLocalFolder] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('match');
  const [descending, setDescending] = useState<boolean>(false);
  const [limit, setLimit] = useState<number>(50);

  const [remoteSection, setRemoteSection] = useState<string>('all');
  const [remoteSource, setRemoteSource] = useState<string>('all');

  const [localResults, setLocalResults] = useState<any[]>([]);
  const [remoteResults, setRemoteResults] = useState<any[]>([]);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const copiedTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (copiedTimeoutRef.current) {
      clearTimeout(copiedTimeoutRef.current);
    }
  }, []);

  const catalogResults = remoteResults.filter(
    (r) => r.location === 'remote_catalog' || r.remote_source === 'to_be_downloaded'
  );
  const driveNameResults = remoteResults.filter(
    (r) => r.location === 'remote_drive' || r.remote_source === 'names'
  );

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
        const results = (data.results || []).map((r: any) => ({
          ...r,
          location: r.remote_source === 'names' ? 'remote_drive' : 'remote_catalog',
        }));
        setRemoteResults(results);
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
    if (copiedTimeoutRef.current) {
      clearTimeout(copiedTimeoutRef.current);
    }
    copiedTimeoutRef.current = setTimeout(() => {
      setCopiedPath(null);
      copiedTimeoutRef.current = null;
    }, 2000);
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const openItem = (item: any) => {
    // Remote catalog entries are strings only — never open
    if (item.location === 'remote_catalog' || item.remote_source === 'to_be_downloaded') {
      return;
    }
    if (item.location === 'remote_drive' || item.remote_source === 'names') {
      return;
    }
    if (item.path && item.folder) {
      openLocalFile({ path: item.path, folder: item.folder });
    } else if (item.path) {
      openLocalFile({ path: item.path, absolute: String(item.path).includes(':') });
    }
  };

  const foldersList = ['all', 'anime', 'books', 'content', 'lol', 'music', 'new_folder', 'old_music', 'pictures', 'recordings', 'songs', 'videos'];
  const sectionsList = ['all', 'anime', 'games', 'movies', 'series'];

  const ResultCard = ({ item, clickable }: { item: any; clickable: boolean }) => (
    <div
      className={`p-3.5 rounded-xl bg-slate-900 border border-slate-600 hover:border-blue-400/50 transition flex flex-col justify-between space-y-2 shadow-sm ${
        clickable ? 'cursor-pointer' : ''
      }`}
      onClick={clickable ? () => openItem(item) : undefined}
      title={clickable ? 'Open file' : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-bold truncate ${clickable ? 'text-white underline decoration-blue-400/50' : 'text-white'}`} title={item.name}>
              {item.name}
            </span>
            {item.location === 'local' || (!item.location && item.folder) ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-200 border border-blue-400/40 flex items-center gap-1">
                <Folder className="w-2.5 h-2.5" /> Local
              </span>
            ) : null}
            {(item.location === 'remote_drive' || item.remote_source === 'names') && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-200 border border-yellow-400/40 flex items-center gap-1">
                <HardDrive className="w-2.5 h-2.5" /> On Drive
              </span>
            )}
            {(item.location === 'remote_catalog' || item.remote_source === 'to_be_downloaded') && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-500/20 text-orange-200 border border-orange-400/40 flex items-center gap-1">
                <Database className="w-2.5 h-2.5" /> Catalog
              </span>
            )}
            {item.is_to_be_downloaded && (
              <span className="text-[10px] font-semibold px-2 py-0.2 rounded bg-orange-500/15 text-orange-200 border border-orange-400/30 flex items-center gap-1">
                <Download className="w-2.5 h-2.5" /> To Download
              </span>
            )}
          </div>
          {item.path && (
            <p className="text-[11px] text-blue-200 font-mono truncate mt-0.5" title={item.path}>
              {item.path}
            </p>
          )}
          {item.remote_section && (
            <span className="text-[11px] text-yellow-200 font-medium block mt-0.5">
              Category: {item.remote_section}
            </span>
          )}
        </div>
        {item.score !== undefined && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-100 border border-blue-400/40 shrink-0">
            {item.score}%
          </span>
        )}
      </div>
      <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-blue-100">
        <div className="flex items-center gap-2">
          {item.folder && (
            <span className="px-2 py-0.2 rounded bg-slate-800 text-yellow-200 font-medium">{item.folder}</span>
          )}
          {item.size_bytes !== undefined && <span>{formatBytes(item.size_bytes)}</span>}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            copyToClipboard(item.path || item.name);
          }}
          className="flex items-center gap-1 text-orange-200 hover:text-white cursor-pointer"
        >
          {copiedPath === (item.path || item.name) ? (
            <span className="text-yellow-300 flex items-center gap-0.5"><Check className="w-3 h-3" /> Copied</span>
          ) : (
            <span className="flex items-center gap-0.5"><Copy className="w-3 h-3" /> Copy</span>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Search Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-800 via-indigo-900/30 to-slate-800 border border-slate-700 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Universal Search Hub</h2>
              <p className="text-xs text-slate-300">
                Fuzzy search local index, remote hard drive catalog, and pending download queues.
              </p>
            </div>
          </div>

          {/* Mode Selector */}
          <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-700 text-xs">
            <button
              onClick={() => setSearchMode('local')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
                searchMode === 'local' ? 'bg-blue-500 text-white shadow' : 'text-blue-100 hover:text-white'
              }`}
            >
              <Folder className="w-3.5 h-3.5" /> Local Index
            </button>
            <button
              onClick={() => setSearchMode('remote')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
                searchMode === 'remote' ? 'bg-orange-500 text-white shadow' : 'text-orange-200 hover:text-white'
              }`}
            >
              <Database className="w-3.5 h-3.5" /> Remote Catalog
            </button>
            <button
              onClick={() => setSearchMode('unified')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
                searchMode === 'unified' ? 'bg-yellow-500 text-slate-950 shadow' : 'text-yellow-200 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> Unified (Both)
            </button>
          </div>
        </div>

        {/* Search Input */}
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
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-900 border border-slate-600 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 shadow-inner"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-6 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold shadow-md shadow-indigo-500/20 disabled:opacity-50 transition cursor-pointer flex items-center gap-2"
          >
            <Search className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Searching...' : 'Search'}</span>
          </button>
        </form>

        {/* Filter Controls */}
        <div className="pt-2 border-t border-slate-700/60 flex flex-wrap items-center gap-3 text-xs">
          {searchMode !== 'remote' && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-300">Folder:</span>
                <select
                  value={localFolder}
                  onChange={(e) => setLocalFolder(e.target.value)}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-600 text-slate-200 focus:outline-none focus:border-indigo-400 cursor-pointer"
                >
                  {foldersList.map((f) => (
                    <option key={f} value={f}>{f === 'all' ? 'All Folders' : f}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-300">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-600 text-slate-200 focus:outline-none focus:border-indigo-400 cursor-pointer"
                >
                  <option value="match">Match Score</option>
                  <option value="name">Name</option>
                  <option value="created">Created Date</option>
                  <option value="folder">Folder</option>
                </select>
              </div>
              <label className="flex items-center gap-1 text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={descending}
                  onChange={(e) => setDescending(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-indigo-500 bg-slate-900 border-slate-600 cursor-pointer"
                />
                <span>Descending</span>
              </label>
            </>
          )}

          {searchMode !== 'local' && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-300">Section:</span>
                <select
                  value={remoteSection}
                  onChange={(e) => setRemoteSection(e.target.value)}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-600 text-slate-200 focus:outline-none focus:border-indigo-400 cursor-pointer"
                >
                  {sectionsList.map((s) => (
                    <option key={s} value={s}>{s === 'all' ? 'All Sections' : s}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-300">Source:</span>
                <select
                  value={remoteSource}
                  onChange={(e) => setRemoteSource(e.target.value)}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-600 text-slate-200 focus:outline-none focus:border-indigo-400 cursor-pointer"
                >
                  <option value="all">All Sources</option>
                  <option value="names">Cataloged Names</option>
                  <option value="to_be_downloaded">To Be Downloaded Only</option>
                </select>
              </div>
            </>
          )}

          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-slate-300">Limit:</span>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-600 text-slate-200 focus:outline-none focus:border-indigo-400 cursor-pointer"
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
          {(searchMode === 'local' || searchMode === 'unified') && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Folder className="w-4 h-4 text-blue-300" />
                Local Files ({localResults.length})
              </h3>
              {localResults.length === 0 ? (
                <p className="text-xs text-blue-100 p-6 rounded-xl bg-slate-900 border border-slate-700 text-center">
                  No local files matched your query.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {localResults.map((item, idx) => (
                    <ResultCard key={`local-${idx}`} item={{ ...item, location: 'local' }} clickable />
                  ))}
                </div>
              )}
            </div>
          )}

          {(searchMode === 'remote' || searchMode === 'unified') && (
            <>
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-orange-300" />
                  Remote Catalog Search ({catalogResults.length})
                </h3>
                <p className="text-[11px] text-orange-200">
                  Catalog entries are names only — clicking does not open files.
                </p>
                {catalogResults.length === 0 ? (
                  <p className="text-xs text-blue-100 p-6 rounded-xl bg-slate-900 border border-slate-700 text-center">
                    No remote catalog entries matched.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {catalogResults.map((item, idx) => (
                      <ResultCard key={`catalog-${idx}`} item={item} clickable={false} />
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-yellow-300" />
                  Cataloged On Drive ({driveNameResults.length})
                </h3>
                {driveNameResults.length === 0 ? (
                  <p className="text-xs text-blue-100 p-6 rounded-xl bg-slate-900 border border-slate-700 text-center">
                    No drive catalog names matched.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {driveNameResults.map((item, idx) => (
                      <ResultCard key={`drive-${idx}`} item={item} clickable={false} />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
