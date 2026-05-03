import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Link as LinkIcon, 
  ExternalLink, 
  Search, 
  Copy, 
  Check, 
  Terminal, 
  Shield, 
  Activity,
  ChevronLeft,
  ChevronRight,
  Filter,
  Download
} from 'lucide-react';

// Configuration
const PROXY_BASE = '/proxy';
const TOTAL_LINKS = 100000;
const PAGE_SIZE = 50;

/**
 * Technical Dashboard inspired Link Portal
 */
export default function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCopyingAll, setIsCopyingAll] = useState(false);
  const [showRawView, setShowRawView] = useState(false);
  const [status, setStatus] = useState<'idle' | 'scanning' | 'ready'>('ready');
  const [proxyHealth, setProxyHealth] = useState<string>('Checking...');

  // Check proxy health
  useEffect(() => {
    fetch('/proxy/')
      .then(r => setProxyHealth(r.ok ? 'ONLINE_PORTAL_ACTIVE' : `REDUCED_ACCESS_${r.status}`))
      .catch(() => setProxyHealth('OFFLINE_OR_BLOCKED'));
  }, []);

  // Simulate generation effect on first load
  useEffect(() => {
    setStatus('scanning');
    const timer = setTimeout(() => setStatus('ready'), 1500);
    return () => clearTimeout(timer);
  }, []);

  // Filter logic - since it's 100k, we calculate based on the index or search
  const filteredIndices = useMemo(() => {
    if (!searchTerm) {
      // If no search, we just show all indices (conceptual)
      return Array.from({ length: TOTAL_LINKS }, (_, i) => i);
    }
    const searchLow = searchTerm.toLowerCase();
    const results: number[] = [];
    for (let i = 0; i < TOTAL_LINKS; i++) {
      if (indexToSlug(i).includes(searchLow)) {
        results.push(i);
      }
      if (results.length > 5000) break; // Limit search results for UI
    }
    return results;
  }, [searchTerm]);

  const totalPages = Math.ceil(filteredIndices.length / PAGE_SIZE);
  const paginatedIndices = useMemo(() => {
    const start = currentPage * PAGE_SIZE;
    return filteredIndices.slice(start, start + PAGE_SIZE);
  }, [filteredIndices, currentPage]);

  const handleCopy = (fullUrl: string, index: number) => {
    navigator.clipboard.writeText(fullUrl);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const getAllLinks = () => {
    const host = window.location.host;
    return Array.from({ length: TOTAL_LINKS }, (_, i) => {
      const slug = indexToSlug(i);
      return `https://${slug}.${host}/`;
    }).join('\n');
  };

  const handleCopyAll = async () => {
    setIsCopyingAll(true);
    try {
      const allLinks = getAllLinks();
      await navigator.clipboard.writeText(allLinks);
      setTimeout(() => setIsCopyingAll(false), 2000);
    } catch (err) {
      console.error('Failed to copy all:', err);
      setIsCopyingAll(false);
    }
  };

  const downloadList = () => {
    setIsGenerating(true);
    setTimeout(() => {
      const links = getAllLinks();
      const blob = new Blob([links], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'nikehub_100k_links.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setIsGenerating(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#E4E3E0]">
      {/* Grid Overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03]" 
           style={{ backgroundImage: 'radial-gradient(#141414 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#E4E3E0]/80 backdrop-blur-md border-b border-[#141414] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Terminal size={24} className="text-[#141414]" />
          <div>
            <h1 className="font-mono text-sm font-bold uppercase tracking-tighter leading-none">NikeHub: Proxy_Gateway</h1>
            <p className="font-mono text-[10px] opacity-50 uppercase mt-1">Status: {status === 'ready' ? 'SECURE_ACTIVE' : 'SYSTEM_SCAN'}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex gap-4 font-mono text-[10px] uppercase font-medium">
            <div className="flex items-center gap-1.5"><Shield size={12} /> Encrypted</div>
            <div className="flex items-center gap-1.5 group cursor-help relative">
              <Activity size={12} className="text-orange-600" /> Live-Proxy
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={handleCopyAll}
              disabled={isCopyingAll}
              className="flex items-center gap-2 border border-[#141414] px-4 py-2 hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors disabled:opacity-50"
            >
              {isCopyingAll ? <Check size={16} /> : <Copy size={16} />}
              <span className="font-mono text-xs font-bold uppercase">{isCopyingAll ? 'Copied All' : 'Copy All'}</span>
            </button>

            <button 
              onClick={() => setShowRawView(true)}
              className="flex items-center gap-2 border border-[#141414] px-4 py-2 hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors"
            >
              <Terminal size={16} />
              <span className="font-mono text-xs font-bold uppercase">Raw View</span>
            </button>

            <button 
              onClick={downloadList}
              disabled={isGenerating}
              className="flex items-center gap-2 bg-[#141414] text-[#E4E3E0] px-4 py-2 hover:bg-orange-600 transition-colors disabled:opacity-50"
            >
              <Download size={16} />
              <span className="font-mono text-xs font-bold uppercase">{isGenerating ? 'Compiling...' : 'Export 100K'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-8">
        
        {/* Left Column: List */}
        <section className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30 group-focus-within:opacity-100 transition-opacity" size={18} />
              <input 
                type="text" 
                placeholder="PROBE ENDPOINT PATH / SEARCH DATABASE..."
                className="w-full bg-transparent border border-[#141414] py-3 pl-10 pr-4 font-mono text-xs uppercase placeholder:opacity-30 focus:outline-none focus:ring-1 focus:ring-orange-600 transition-all"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(0);
                }}
              />
            </div>
            <div className="flex items-center gap-2 border border-[#141414] p-1">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                className="p-1.5 hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors disabled:opacity-20"
                disabled={currentPage === 0}
              >
                <ChevronLeft size={18} />
              </button>
              <span className="font-mono text-[10px] px-3 font-bold uppercase min-w-[120px] text-center">
                Block {currentPage + 1} / {totalPages || 1}
              </span>
              <button 
                onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                className="p-1.5 hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors disabled:opacity-20"
                disabled={currentPage >= totalPages - 1}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          {/* Table Headers */}
          <div className="grid grid-cols-[1fr_2fr_120px] px-4 py-2 border-y border-[#141414] font-mono text-[10px] font-bold uppercase opacity-60 italic">
            <div>Link_ID</div>
            <div>Proxy_Path</div>
            <div className="text-right">Actions</div>
          </div>

          {/* Table Content */}
          <div className="flex flex-col">
            <AnimatePresence mode="popLayout">
                {paginatedIndices.map((idx) => {
                  const slug = indexToSlug(idx);
                  const displayUrl = `${slug}.${window.location.host}`;
                  const fullUrl = `https://${displayUrl}/`;
                  return (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="grid grid-cols-[1fr_2fr_120px] items-center px-4 py-3 border-b border-[#141414] group hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors cursor-default"
                    >
                      <div className="font-mono text-xs opacity-50 font-medium tracking-tight">
                        #{String(idx + 1).padStart(6, '0')}
                      </div>
                      <div className="flex items-center gap-2 font-mono text-xs font-bold truncate">
                        <LinkIcon size={14} className="opacity-30 group-hover:opacity-100 group-hover:text-orange-500" />
                        {fullUrl}
                      </div>
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => handleCopy(fullUrl, idx)}
                          title="Copy Link"
                          className="p-2 hover:bg-orange-600 transition-colors"
                        >
                          {copiedIndex === idx ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                        <a 
                          href={fullUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-2 hover:bg-orange-600 transition-colors"
                          title="Open Link"
                        >
                          <ExternalLink size={14} />
                        </a>
                      </div>
                    </motion.div>
                  );
                })}
            </AnimatePresence>
          </div>
        </section>

        {/* Right Column: Info & Config */}
        <aside className="flex flex-col gap-8">
          {/* Stats Card */}
          <div className="border border-[#141414] p-6 bg-white shadow-[8px_8px_0px_#141414]">
            <div className="flex items-center gap-2 mb-4">
              <Filter size={16} />
              <h2 className="font-mono text-xs font-bold uppercase">System_Metrics</h2>
            </div>
            <div className="space-y-4">
              <div>
                <span className="font-mono text-[10px] uppercase opacity-50 block mb-1">Endpoints Generated</span>
                <span className="font-mono text-2xl font-bold tracking-tighter leading-none">100,000</span>
              </div>
              <div>
                <span className="font-mono text-[10px] uppercase opacity-50 block mb-1">Target Host</span>
                <span className="font-mono text-xs font-bold truncate block">nikehub.pages.dev</span>
              </div>
              <div>
                <span className="font-mono text-[10px] uppercase opacity-50 block mb-1">Active Protocols</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="px-1.5 py-0.5 bg-[#141414] text-[#E4E3E0] font-mono text-[8px] uppercase">HTTPS</span>
                  <span className="px-1.5 py-0.5 bg-[#141414] text-[#E4E3E0] font-mono text-[8px] uppercase">CORS_BYPASS</span>
                  <span className="px-1.5 py-0.5 bg-[#141414] text-[#E4E3E0] font-mono text-[8px] uppercase">FRAME_AUTH</span>
                </div>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="border border-[#141414] p-6">
            <h3 className="font-mono text-xs font-bold uppercase mb-3 flex items-center gap-2">
              <Shield size={14} className="text-orange-600" />
              Gateway Usage
            </h3>
            <ul className="space-y-3 font-mono text-[10px] leading-relaxed opacity-70 uppercase list-disc ml-4">
              <li>Each ID maps to a unique virtual path in the NikeHub infrastructure.</li>
              <li>Requests are piped through the local proxy server to inject secure framing headers.</li>
              <li>Referer and Origin spoofing is active to ensure compatibility with target CDN.</li>
              <li>Use the 'Export' command to download the full directory for indexation.</li>
            </ul>
          </div>

          {/* Proxy Source Display */}
          <div className="border border-[#141414] bg-[#141414] p-4 overflow-hidden">
             <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
                <span className="font-mono text-[9px] text-white/50 uppercase">GATEWAY_DAEMON_SOURCE</span>
             </div>
             <pre className="font-mono text-[8px] text-white/80 leading-tight overflow-x-auto whitespace-pre">
{`const target = "https://nikehub.pages.dev";
headers.set("referer", target);
headers.set("origin", target);
newHeaders.set("Access-Control-Allow-Origin", "*");
newHeaders.delete("x-frame-options");
newHeaders.set("x-frame-options", "ALLOW");`}
             </pre>
          </div>
        </aside>
      </main>

      {/* Raw View Modal */}
      <AnimatePresence>
        {showRawView && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-[#141414]/90 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#E4E3E0] border border-white/20 w-full max-w-4xl h-[80vh] flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-[#141414]">
                <h2 className="font-mono text-sm font-bold uppercase">Raw_Link_Buffer [100,000 Records]</h2>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={handleCopyAll}
                    disabled={isCopyingAll}
                    className="font-mono text-[10px] font-bold uppercase flex items-center gap-2 px-3 py-1 bg-[#141414] text-white hover:bg-orange-600 transition-colors"
                  >
                    {isCopyingAll ? <Check size={12} /> : <Copy size={12} />}
                    {isCopyingAll ? 'Copied' : 'Copy Buffer'}
                  </button>
                  <button 
                    onClick={() => setShowRawView(false)}
                    className="p-1 hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors"
                  >
                    <ChevronRight className="rotate-45" size={24} />
                  </button>
                </div>
              </div>
              <textarea 
                readOnly
                value={getAllLinks()}
                className="flex-1 bg-[#141414] text-[#E4E3E0] p-6 font-mono text-[10px] leading-relaxed focus:outline-none resize-none"
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              />
              <div className="p-4 border-t border-[#141414] flex justify-between items-center">
                <span className="font-mono text-[10px] opacity-50 uppercase">Double-click or use "Copy Buffer" to capture all data</span>
                <button 
                  onClick={() => setShowRawView(false)}
                  className="font-mono text-[10px] font-bold uppercase border border-[#141414] px-4 py-1.5 hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors"
                >
                  Close Buffer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="mt-12 border-t border-[#141414] p-6 text-center">
        <p className="font-mono text-[9px] opacity-40 uppercase tracking-widest">
          &copy; 2026 NikeHub Portal // Secure Link Directory Infrastructure v4.1.2
        </p>
      </footer>
    </div>
  );
}

// Helper to generate slugs
const CATEGORIES = ['air-max', 'jordan', 'dunk', 'cortez', 'blazer', 'pegasus', 'vomero', 'metcon'];
const TRAITS = ['retro', 'premium', 'og', 'remastered', 'special-edition', 'classic', 'performance', 'lifestyle'];

function indexToSlug(index: number): string {
  const catIdx = index % CATEGORIES.length;
  const traitIdx = Math.floor(index / CATEGORIES.length) % TRAITS.length;
  const uniqueId = Math.floor(index / (CATEGORIES.length * TRAITS.length));
  
  return `${CATEGORIES[catIdx]}-${TRAITS[traitIdx]}-${String(uniqueId).padStart(4, '0')}`;
}
