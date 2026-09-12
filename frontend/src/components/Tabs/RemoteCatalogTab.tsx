import React, { useState, useEffect } from 'react';
import { 
  HardDrive, 
  Download, 
  Plus, 
  Trash2, 
  Search, 
  RefreshCw, 
  Film, 
  Tv, 
  Gamepad2, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  X,
  ListPlus
} from 'lucide-react';

export const RemoteCatalogTab: React.FC = () => {
  const [catalog, setCatalog] = useState<any | null>(null);
  const [activeSection, setActiveSection] = useState<'anime' | 'games' | 'movies' | 'series'>('anime');
  const [activeView, setActiveView] = useState<'to_be_downloaded' | 'catalog'>('to_be_downloaded');
  const [newTitle, setNewTitle] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [rebuilding, setRebuilding] = useState(false);

  const fetchCatalog = async () => {
    try {
      const res = await fetch('/api/remote-catalog');
      if (res.ok) {
        const data = await res.json();
        setCatalog(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, []);

  const handleAddSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setFeedback(null);
    try {
      const res = await fetch('/api/remote-catalog/add-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: activeSection, names: [newTitle.trim()] }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({ type: 'success', message: `Added '${newTitle}' to ${activeSection} to-be-downloaded list!` });
        setNewTitle('');
        fetchCatalog();
      } else {
        setFeedback({ type: 'error', message: data.detail || 'Failed to add title.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Network error while adding title.' });
    }
  };

  const handleAddBulk = async () => {
    const lines = bulkText.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;

    setFeedback(null);
    try {
      const res = await fetch('/api/remote-catalog/add-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: activeSection, names: lines }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({ type: 'success', message: `Added ${data.added_count} new titles to ${activeSection} queue!` });
        setBulkText('');
        setShowBulkAdd(false);
        fetchCatalog();
      } else {
        setFeedback({ type: 'error', message: data.detail || 'Failed to add titles.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Network error while bulk adding titles.' });
    }
  };

  const handleRemove = async (section: string, name: string) => {
    try {
      const res = await fetch('/api/remote-catalog/remove-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section, name }),
      });
      if (res.ok) {
        fetchCatalog();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRebuild = async () => {
    setRebuilding(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/remote-catalog/rebuild', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setFeedback({ type: 'success', message: 'Remote catalog successfully rebuilt from drive!' });
        setCatalog(data);
      } else {
        setFeedback({ type: 'error', message: data.detail || 'Failed to rebuild remote catalog.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Network error while rebuilding catalog.' });
    } finally {
      setRebuilding(false);
    }
  };

  const tobeDownloadedList: string[] = catalog?.to_be_downloaded?.[activeSection] || [];
  const catalogList: string[] = catalog?.names?.[activeSection] || [];

  const filteredTbd = tobeDownloadedList.filter((item) =>
    item.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredCatalog = catalogList.filter((item) =>
    item.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getSectionIcon = (sec: string) => {
    switch (sec) {
      case 'anime': return <Sparkles className="w-4 h-4 text-purple-400" />;
      case 'movies': return <Film className="w-4 h-4 text-indigo-400" />;
      case 'series': return <Tv className="w-4 h-4 text-cyan-400" />;
      case 'games': return <Gamepad2 className="w-4 h-4 text-emerald-400" />;
      default: return <HardDrive className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-800 via-indigo-900/30 to-slate-800 border border-slate-700 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Remote Catalog & "To Be Downloaded" Hub</h2>
              <p className="text-xs text-slate-400">
                Manage upcoming download wishlist items and view cataloged drive collections.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRebuild}
            disabled={rebuilding}
            className="px-3.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${rebuilding ? 'animate-spin' : ''}`} />
            <span>Rebuild Catalog from D:</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-medium animate-in fade-in duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Section Tabs (Anime, Games, Movies, Series) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(['anime', 'games', 'movies', 'series'] as const).map((sec) => {
          const count = catalog?.to_be_downloaded?.[sec]?.length || 0;
          const catCount = catalog?.names?.[sec]?.length || 0;
          const isActive = activeSection === sec;

          return (
            <button
              key={sec}
              onClick={() => setActiveSection(sec)}
              className={`p-4 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                isActive
                  ? 'bg-indigo-950/40 border-indigo-500/50 shadow-lg shadow-indigo-500/10'
                  : 'bg-slate-800/60 border-slate-700 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getSectionIcon(sec)}
                  <span className="text-sm font-bold capitalize text-white">{sec}</span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 font-semibold">
                  {count} to download
                </span>
              </div>
              <span className="text-[11px] text-slate-400 mt-2">{catCount} cataloged on drive</span>
            </button>
          );
        })}
      </div>

      {/* View Switcher & Add Bar */}
      <div className="p-4 rounded-xl bg-slate-800 border border-slate-700 flex flex-wrap items-center justify-between gap-4">
        {/* Toggle between To-Be-Downloaded vs Cataloged */}
        <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-700 text-xs">
          <button
            onClick={() => setActiveView('to_be_downloaded')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
              activeView === 'to_be_downloaded' ? 'bg-indigo-500 text-white shadow' : 'text-slate-300 hover:text-white'
            }`}
          >
            <Download className="w-3.5 h-3.5" /> To Be Downloaded ({tobeDownloadedList.length})
          </button>
          <button
            onClick={() => setActiveView('catalog')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
              activeView === 'catalog' ? 'bg-indigo-500 text-white shadow' : 'text-slate-300 hover:text-white'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" /> Cataloged On Drive ({catalogList.length})
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Filter ${activeSection}...`}
            className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-600 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-400"
          />
        </div>
      </div>

      {/* Add New Title to "To Be Downloaded" Bar */}
      {activeView === 'to_be_downloaded' && (
        <div className="p-4 rounded-xl bg-slate-800/90 border border-slate-700 space-y-3">
          <form onSubmit={handleAddSingle} className="flex flex-wrap md:flex-nowrap gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={`Add new ${activeSection} title (e.g. 'Attack on Titan Season 4', 'Elden Ring DLC')...`}
                className="w-full px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-600 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-400"
              />
            </div>
            <button
              type="submit"
              disabled={!newTitle.trim()}
              className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-semibold disabled:opacity-50 transition cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add to {activeSection}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowBulkAdd(!showBulkAdd)}
              className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 text-xs font-medium transition cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              <ListPlus className="w-4 h-4 text-indigo-400" />
              <span>Bulk Add</span>
            </button>
          </form>

          {/* Bulk Add Input Area */}
          {showBulkAdd && (
            <div className="pt-3 border-t border-slate-700 space-y-2 animate-in fade-in duration-150">
              <label className="text-xs text-slate-300 block">Enter multiple titles (one per line):</label>
              <textarea
                rows={4}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder="Title 1&#10;Title 2&#10;Title 3"
                className="w-full p-3 rounded-lg bg-slate-900 border border-slate-600 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-400"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowBulkAdd(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddBulk}
                  className="px-4 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-semibold cursor-pointer"
                >
                  Add All Titles
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Items List */}
      <div className="space-y-2">
        {activeView === 'to_be_downloaded' ? (
          filteredTbd.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-slate-800/40 border border-slate-700">
              <Download className="w-10 h-10 text-slate-500 mx-auto mb-2" />
              <p className="text-xs text-slate-400">No items in {activeSection} to-be-downloaded queue.</p>
            </div>
          ) : (
            filteredTbd.map((name) => (
              <div
                key={name}
                className="p-3 rounded-xl bg-slate-800/60 border border-slate-700 hover:border-slate-600 transition flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span className="text-xs font-semibold text-slate-200">{name}</span>
                </div>
                <button
                  onClick={() => handleRemove(activeSection, name)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-700 transition cursor-pointer"
                  title="Remove from download queue"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )
        ) : filteredCatalog.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-slate-800/40 border border-slate-700">
            <HardDrive className="w-10 h-10 text-slate-500 mx-auto mb-2" />
            <p className="text-xs text-slate-400">No cataloged items found in {activeSection}.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {filteredCatalog.map((name, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-slate-800/60 border border-slate-700 text-xs flex items-center justify-between"
              >
                <span className="font-medium text-slate-200 truncate" title={name}>{name}</span>
                <span className="text-[10px] text-slate-400 uppercase font-mono">Cataloged</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
