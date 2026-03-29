import { useState, useRef, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Volume2, VolumeX, BookOpen } from 'lucide-react';
import { getAssetUrl } from '@/App';

const renderMarkdownBlock = (text, theme = 'light') => {
  const headingCls = theme === 'dark'
    ? 'text-white font-bold text-lg mt-2 mb-1'
    : 'text-[#1D3557] font-bold text-lg mt-2 mb-1';
  const textCls = theme === 'dark' ? 'text-white/90' : 'text-[#3D5A80]';
  const boldCls = theme === 'dark' ? 'text-white font-semibold' : 'text-[#1D3557] font-semibold';
  const listCls = theme === 'dark' ? 'text-white/80' : 'text-[#3D5A80]';

  return text.split('\n').map((line, i) => {
    if (line.startsWith('###')) {
      return <h3 key={i} className={headingCls} style={{ fontFamily: 'Fredoka' }}>{line.replace(/^###\s*/, '')}</h3>;
    }
    if (line.startsWith('- ') || line.match(/^\d+\.\s/)) {
      const content = line.replace(/^[-\d.]+\s/, '');
      const parts = content.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={j} className={boldCls}>{part.slice(2, -2)}</strong>;
        return part;
      });
      return <li key={i} className={`${listCls} ml-4 mb-1`}>{parts}</li>;
    }
    const parts = line.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**')) return <strong key={j} className={boldCls}>{part.slice(2, -2)}</strong>;
      return part;
    });
    if (line.trim()) return <p key={i} className={`${textCls} mb-2 leading-relaxed`}>{parts}</p>;
    return <div key={i} className="h-2" />;
  });
};

function splitIntoPages(text) {
  if (!text) return [{ title: 'Guide', content: '' }];
  const lines = text.split('\n');
  const pages = [];
  let currentTitle = 'Introduction';
  let currentContent = [];

  for (const line of lines) {
    if (line.startsWith('###')) {
      if (currentContent.length > 0) {
        pages.push({ title: currentTitle, content: currentContent.join('\n') });
      }
      currentTitle = line.replace(/^###\s*/, '');
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }
  if (currentContent.length > 0) {
    pages.push({ title: currentTitle, content: currentContent.join('\n') });
  }
  if (pages.length === 0) {
    pages.push({ title: 'Guide', content: text });
  }
  return pages;
}

export function JobGuideDialog({ open, onClose, guideText, pageAudios = [], theme = 'light', title = 'Guide' }) {
  const [currentPage, setCurrentPage] = useState(0);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);
  const pages = splitIntoPages(guideText);

  const currentAudioUrl = pageAudios[currentPage] || '';

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
  }, []);

  const playAudio = useCallback((url) => {
    if (!url || !audioEnabled) return;
    stopAudio();
    // Small delay to let the audio element update its src
    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      }
    }, 100);
  }, [audioEnabled, stopAudio]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setCurrentPage(0);
      stopAudio();
    }
  }, [open, stopAudio]);

  // Auto-play when dialog opens or page changes
  useEffect(() => {
    if (open && currentAudioUrl && audioEnabled) {
      playAudio(currentAudioUrl);
    } else {
      stopAudio();
    }
  }, [open, currentPage, currentAudioUrl, audioEnabled, playAudio, stopAudio]);

  const toggleAudioEnabled = () => {
    if (audioEnabled) {
      stopAudio();
    }
    setAudioEnabled(prev => !prev);
  };

  if (!open) return null;

  const isDark = theme === 'dark';
  const overlayBg = 'bg-black/60 backdrop-blur-sm';
  const panelBg = isDark ? 'bg-[#1D3557]' : 'bg-white';
  const headerBg = isDark ? 'bg-[#152A45]' : 'bg-[#E0FBFC]';
  const titleCls = isDark ? 'text-white' : 'text-[#1D3557]';
  const subtitleCls = isDark ? 'text-white/60' : 'text-[#3D5A80]';
  const dotActive = isDark ? 'bg-[#FFD23F]' : 'bg-[#1D3557]';
  const dotInactive = isDark ? 'bg-white/30' : 'bg-[#1D3557]/20';
  const navBtnCls = isDark
    ? 'bg-white/10 hover:bg-white/20 text-white'
    : 'bg-[#1D3557]/10 hover:bg-[#1D3557]/20 text-[#1D3557]';

  const page = pages[currentPage] || pages[0];
  const hasAnyAudio = pageAudios.some(a => a);

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${overlayBg}`} onClick={onClose}>
      <div
        className={`${panelBg} rounded-3xl shadow-2xl w-[95vw] max-w-lg max-h-[85vh] flex flex-col overflow-hidden border-3 border-[#1D3557]/20`}
        onClick={(e) => e.stopPropagation()}
        data-testid="job-guide-dialog"
      >
        {/* Header */}
        <div className={`${headerBg} px-5 py-4 flex items-center gap-3`}>
          <BookOpen className={`w-5 h-5 ${titleCls}`} />
          <div className="flex-1 min-w-0">
            <h2 className={`font-bold text-base ${titleCls}`} style={{ fontFamily: 'Fredoka' }}>{title}</h2>
            <div className="flex items-center gap-2">
              <p className={`text-xs ${subtitleCls}`}>Page {currentPage + 1} of {pages.length}</p>
              {isPlaying && currentAudioUrl && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isDark ? 'bg-[#FFD23F]/20 text-[#FFD23F]' : 'bg-[#06D6A0]/15 text-[#06D6A0]'} animate-pulse`}>
                  Playing
                </span>
              )}
            </div>
          </div>
          {hasAnyAudio && (
            <button
              data-testid="guide-audio-toggle"
              onClick={toggleAudioEnabled}
              className={`p-2 rounded-full transition-all ${audioEnabled
                ? (isDark ? 'bg-[#FFD23F] text-[#1D3557]' : 'bg-[#06D6A0] text-white')
                : (isDark ? 'bg-white/10 text-white/40' : 'bg-gray-200 text-gray-400')
              }`}
              title={audioEnabled ? 'Mute audio' : 'Enable audio'}
            >
              {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          )}
          <button onClick={onClose} className={`p-1.5 rounded-full ${navBtnCls}`} data-testid="close-guide-dialog">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Page Title */}
        <div className="px-5 pt-4 pb-2">
          <h3 className={`font-bold text-lg ${titleCls}`} style={{ fontFamily: 'Fredoka' }}>
            {page.title}
          </h3>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 text-sm">
          {renderMarkdownBlock(page.content, theme)}
        </div>

        {/* Footer with navigation */}
        <div className={`${headerBg} px-5 py-3 flex items-center justify-between`}>
          <button
            onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            className={`p-2 rounded-xl transition-all ${navBtnCls} ${currentPage === 0 ? 'opacity-30 cursor-not-allowed' : ''}`}
            data-testid="guide-prev-page"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex gap-1.5">
            {pages.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i)}
                className={`w-2 h-2 rounded-full transition-all ${i === currentPage ? `${dotActive} w-5` : dotInactive}`}
              />
            ))}
          </div>
          <button
            onClick={() => setCurrentPage(p => Math.min(pages.length - 1, p + 1))}
            disabled={currentPage === pages.length - 1}
            className={`p-2 rounded-xl transition-all ${navBtnCls} ${currentPage === pages.length - 1 ? 'opacity-30 cursor-not-allowed' : ''}`}
            data-testid="guide-next-page"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Hidden audio element */}
        {currentAudioUrl && (
          <audio
            ref={audioRef}
            src={getAssetUrl(currentAudioUrl)}
            onEnded={() => setIsPlaying(false)}
          />
        )}
      </div>
    </div>
  );
}
