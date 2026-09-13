import React, { useEffect, useRef, useState } from 'react';
import { File, Film, Image, Music2, Play, Search, Shuffle } from 'lucide-react';
import { openLocalFile } from '../../utils/openFile';

type EntertainmentItem = {
  name: string;
  path: string;
  relative_path: string;
  extension: string;
  kind: 'image' | 'video' | 'audio' | 'file';
  mime_type: string;
  size_bytes: number;
  created_at: string;
  modified_at: string;
  length_seconds: number;
};

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
};

const formatLength = (seconds: number) => {
  if (!seconds) return '0:00';
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
};

const LazyThumbnail: React.FC<{
  item: EntertainmentItem;
  src?: string;
  icon: React.ReactNode;
}> = ({ item, src, icon }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [failed, setFailed] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || shouldLoad) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px 0px' },
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, [shouldLoad]);

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center">
      {shouldLoad && !failed && item.kind === 'image' && src ? (
        <img 
          src={src} 
          alt="" 
          loading="lazy" 
          decoding="async" 
          onError={() => setFailed(true)}
          className="w-full h-full object-cover" 
        />
      ) : shouldLoad && !failed && item.kind === 'video' && src ? (
        <video
          ref={(video) => {
            if (video && video.readyState >= 1 && video.currentTime === 0) {
              video.currentTime = Math.min(1, video.duration || 1);
            }
          }}
          src={src}
          muted
          playsInline
          preload="metadata"
          onLoadedMetadata={(event) => {
            event.currentTarget.currentTime = Math.min(1, event.currentTarget.duration || 1);
          }}
          onSeeked={(event) => {
            event.currentTarget.pause();
            setVideoReady(true);
          }}
          onError={() => setFailed(true)}
          className={`w-full h-full object-cover ${videoReady ? '' : 'invisible'}`}
        />
      ) : (
        <div className={`w-full h-full flex flex-col items-center justify-center gap-3 ${
          item.kind === 'audio'
            ? 'bg-gradient-to-br from-amber-950 via-orange-900 to-slate-950 text-amber-200'
            : item.kind === 'video'
            ? 'bg-gradient-to-br from-indigo-950 via-purple-900 to-slate-950 text-indigo-200'
            : 'bg-gradient-to-br from-slate-800 to-slate-950 text-fuchsia-300'
        }`}>
          <div className="p-4 rounded-full bg-black/25">{icon}</div>
          <span className="text-xs uppercase font-semibold">{item.kind === 'audio' ? 'Audio track' : item.kind}</span>
        </div>
      )}
    </div>
  );
};

export const EntertainmentTab: React.FC = () => {
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('recommended');
  const [descending, setDescending] = useState(false);
  const [items, setItems] = useState<EntertainmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const requestIdRef = useRef(0);

  const loadItems = async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        query,
        sort_by: sortBy,
        descending: String(descending),
        limit: '200',
      });
      const response = await fetch(`/api/entertainment?${params}`);
      if (!response.ok) throw new Error(`Entertainment request failed: ${response.status}`);
      const data = await response.json();
      if (requestId === requestIdRef.current) {
        setItems(data.results || []);
      }
    } catch (error) {
      if (requestId === requestIdRef.current) {
        console.error(error);
        setItems([]);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(loadItems, query ? 250 : 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [query, sortBy, descending, refreshKey]);

  const previewUrl = (path: string) => `/api/entertainment/preview?path=${encodeURIComponent(path)}`;
  const openItem = (item: EntertainmentItem) => {
    void openLocalFile({ path: item.path, absolute: true });
  };

  const iconFor = (kind: EntertainmentItem['kind']) => {
    if (kind === 'video') return <Film className="w-5 h-5" />;
    if (kind === 'audio') return <Music2 className="w-5 h-5" />;
    if (kind === 'image') return <Image className="w-5 h-5" />;
    return <File className="w-5 h-5" />;
  };

  return (
    <div className="space-y-5">
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-800 via-fuchsia-900/30 to-slate-800 border border-fuchsia-500/30 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-white">Entertainment</h2>
          <p className="text-xs text-slate-300">Recommended media from old but gold. The root New folder is excluded; New folder directories elsewhere remain searchable.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Elastic search by name, folder, or extension..." className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-900 border border-slate-600 text-sm text-white focus:outline-none focus:border-fuchsia-400" />
          </div>
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="px-3 rounded-xl bg-slate-900 border border-slate-600 text-sm text-white">
            <option value="recommended">Recommended</option>
            <option value="name">Name</option>
            <option value="date_added">Date added</option>
            <option value="modified">Modified</option>
            <option value="size">Size</option>
            <option value="length">Length</option>
            <option value="type">Type</option>
          </select>
          <button onClick={() => setDescending((value) => !value)} className="px-3 rounded-xl bg-slate-900 border border-slate-600 text-sm text-white">
            {descending ? 'Descending' : 'Ascending'}
          </button>
          <button onClick={() => setRefreshKey((value) => value + 1)} className="px-3 rounded-xl bg-fuchsia-500 hover:bg-fuchsia-400 text-white text-sm flex items-center gap-2">
            <Shuffle className="w-4 h-4" /> Shuffle
          </button>
        </div>
      </div>

      {loading ? <p className="p-8 text-center text-sm text-blue-100">Loading recommendations...</p> : items.length === 0 ? (
        <p className="p-8 rounded-xl bg-slate-900 border border-slate-700 text-center text-sm text-blue-100">No entertainment files matched.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((item) => (
            <button key={item.path} onClick={() => openItem(item)} className="text-left rounded-2xl overflow-hidden bg-slate-900 border border-slate-700 hover:border-fuchsia-400 hover:-translate-y-0.5 transition shadow-lg">
              <div className="relative h-44 bg-slate-950 flex items-center justify-center overflow-hidden">
                <LazyThumbnail
                  item={item}
                  src={item.kind === 'image' || item.kind === 'video' ? previewUrl(item.path) : undefined}
                  icon={iconFor(item.kind)}
                />
                <span className="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-black/70 text-[10px] text-white">{item.extension || 'file'}</span>
                <span className="absolute bottom-2 right-2 p-1.5 rounded-full bg-fuchsia-500 text-white"><Play className="w-3 h-3 fill-current" /></span>
              </div>
              <div className="p-3 space-y-1">
                <p className="font-semibold text-sm text-white truncate" title={item.name}>{item.name}</p>
                <p className="text-[11px] text-slate-400 truncate" title={item.relative_path}>{item.relative_path}</p>
                <div className="flex justify-between text-[11px] text-blue-200">
                  <span>{formatBytes(item.size_bytes)}</span>
                  <span>{formatLength(item.length_seconds)}</span>
                  <span>{new Date(item.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
