import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API, getAssetUrl } from '@/App';
import { toast } from 'sonner';
import { 
  BookOpen, ChevronLeft, Search, Star, Sparkles
} from 'lucide-react';
import { Input } from "@/components/ui/input";
import { useFirstVisitAnimation } from '@/hooks/useFirstVisitAnimation';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function GlossaryPage({ user }) {
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLetter, setSelectedLetter] = useState(null);
  const [availableLetters, setAvailableLetters] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [wordOfDay, setWordOfDay] = useState(null);
  const [expandedWord, setExpandedWord] = useState(null);
  const showAnimations = useFirstVisitAnimation('glossary');
  
  useEffect(() => {
    fetchWords();
    fetchWordOfDay();
  }, [searchQuery, selectedLetter, selectedCategory]);
  
  const fetchWords = async () => {
    try {
      let url = `${API}/glossary/words?limit=100`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;
      if (selectedLetter) url += `&letter=${selectedLetter}`;
      if (selectedCategory) url += `&category=${selectedCategory}`;
      
      const res = await axios.get(url);
      setWords(res.data.words || []);
      setAvailableLetters(res.data.letters || []);
      setCategories(res.data.categories || []);
    } catch (error) {
      console.error('Failed to load glossary:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchWordOfDay = async () => {
    try {
      const res = await axios.get(`${API}/glossary/word-of-day`);
      setWordOfDay(res.data);
    } catch (error) {
      console.error('Failed to load word of day:', error);
    }
  };
  
  const getBackLink = () => {
    if (user?.role === 'teacher') return '/teacher-dashboard';
    if (user?.role === 'parent') return '/parent-dashboard';
    if (user?.role === 'admin') return '/admin';
    return '/dashboard';
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#E0FBFC] flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-[#1D3557] border-t-[#FFD23F] rounded-full animate-spin"></div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-[#E0FBFC]" data-testid="glossary-page">
      {/* Header */}
      <header className="bg-white border-b-4 border-[#1D3557]">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to={getBackLink()} className="p-2 rounded-xl border-3 border-[#1D3557] bg-white hover:bg-[#FFD23F]/20 transition-colors">
              <ChevronLeft className="w-6 h-6 text-[#1D3557]" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-[#FFD23F] rounded-xl border-3 border-[#1D3557] shadow-[3px_3px_0px_0px_#1D3557] flex items-center justify-center">
                <BookOpen className="w-7 h-7 text-[#1D3557]" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
                  Word Bank
                </h1>
                <p className="text-base text-[#3D5A80]">Learn money words!</p>
              </div>
            </div>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6">
        {/* Word of the Day */}
        {wordOfDay && (
          <div className={`mb-6 bg-gradient-to-r from-[#FFD23F] to-[#FFEB99] rounded-2xl border-3 border-[#1D3557] shadow-[4px_4px_0px_0px_#1D3557] p-5 ${showAnimations ? 'animate-bounce-in' : ''}`}>
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-white rounded-xl border-3 border-[#1D3557] flex items-center justify-center flex-shrink-0">
                <Star className="w-8 h-8 text-[#FFD23F] fill-[#FFD23F]" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold text-[#1D3557]/70 uppercase tracking-wide">Word of the Day</span>
                  <Sparkles className="w-4 h-4 text-[#1D3557]" />
                </div>
                <h2 className="text-2xl font-bold text-[#1D3557] mb-1" style={{ fontFamily: 'Fredoka' }}>
                  {wordOfDay.term}
                </h2>
                <p className="text-[#1D3557] font-medium">{wordOfDay.meaning}</p>
                {wordOfDay.examples?.length > 0 && wordOfDay.examples[0] && (
                  <p className="text-sm text-[#1D3557]/80 mt-2 italic bg-white/50 rounded-lg px-3 py-2">
                    Example: "{wordOfDay.examples[0]}"
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#3D5A80]" />
          <Input
            placeholder="Search for a word..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setSelectedLetter(null); }}
            className="pl-12 py-6 text-lg border-3 border-[#1D3557] rounded-xl shadow-[3px_3px_0px_0px_#1D3557]"
            data-testid="glossary-search-input"
          />
        </div>
        
        {/* Alphabet Navigation */}
        <div className="mb-6 overflow-x-auto">
          <div className="flex gap-1 min-w-max pb-2">
            <button
              onClick={() => { setSelectedLetter(null); setSearchQuery(''); }}
              className={`px-3 py-2 rounded-lg font-bold text-sm transition-all ${
                !selectedLetter 
                  ? 'bg-[#1D3557] text-white' 
                  : 'bg-white border-2 border-[#1D3557] text-[#1D3557] hover:bg-[#FFD23F]/20'
              }`}
            >
              All
            </button>
            {ALPHABET.map(letter => {
              const hasWords = availableLetters.includes(letter);
              return (
                <button
                  key={letter}
                  onClick={() => { if (hasWords) { setSelectedLetter(letter); setSearchQuery(''); } }}
                  disabled={!hasWords}
                  className={`w-9 h-9 rounded-lg font-bold text-sm transition-all ${
                    selectedLetter === letter
                      ? 'bg-[#1D3557] text-white'
                      : hasWords
                        ? 'bg-white border-2 border-[#1D3557] text-[#1D3557] hover:bg-[#FFD23F]/20'
                        : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  }`}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        </div>
        
        {/* Category Pills */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-4 py-2 rounded-full font-medium text-sm transition-all ${
                !selectedCategory
                  ? 'bg-[#06D6A0] text-white border-2 border-[#1D3557]'
                  : 'bg-white border-2 border-[#3D5A80]/30 text-[#3D5A80] hover:border-[#06D6A0]'
              }`}
            >
              All Topics
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
                className={`px-4 py-2 rounded-full font-medium text-sm transition-all capitalize ${
                  selectedCategory === cat
                    ? 'bg-[#06D6A0] text-white border-2 border-[#1D3557]'
                    : 'bg-white border-2 border-[#3D5A80]/30 text-[#3D5A80] hover:border-[#06D6A0]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
        
        {/* Words List */}
        {words.length === 0 ? (
          <div className="bg-white rounded-2xl border-3 border-[#1D3557] p-12 text-center">
            <BookOpen className="w-16 h-16 mx-auto text-[#98C1D9] mb-4" />
            <h3 className="text-xl font-bold text-[#1D3557] mb-2" style={{ fontFamily: 'Fredoka' }}>
              No Words Found
            </h3>
            <p className="text-[#3D5A80]">
              {searchQuery 
                ? `No words match "${searchQuery}". Try a different search!`
                : selectedLetter 
                  ? `No words starting with "${selectedLetter}" yet.`
                  : 'The glossary is being built!'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {words.map((word, index) => (
              <div
                key={word.word_id}
                className={`bg-white rounded-xl border-3 border-[#1D3557] overflow-hidden transition-all ${
                  showAnimations ? 'animate-bounce-in' : ''
                } ${expandedWord === word.word_id ? 'shadow-[4px_4px_0px_0px_#1D3557]' : 'hover:shadow-lg'}`}
                style={showAnimations ? { animationDelay: `${index * 0.03}s` } : {}}
                data-testid={`glossary-word-${word.word_id}`}
              >
                {/* Word Header - Always visible */}
                <button
                  onClick={() => setExpandedWord(expandedWord === word.word_id ? null : word.word_id)}
                  className="w-full p-4 flex items-center gap-4 text-left hover:bg-[#E0FBFC]/50 transition-colors"
                >
                  {/* Letter/Image Circle */}
                  {word.image_url ? (
                    <img 
                      src={getAssetUrl(word.image_url)} 
                      alt={word.term}
                      className="w-14 h-14 rounded-xl border-3 border-[#1D3557] object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl border-3 border-[#1D3557] bg-gradient-to-br from-[#FFD23F] to-[#FFEB99] flex items-center justify-center flex-shrink-0">
                      <span className="text-2xl font-bold text-[#1D3557]">{word.first_letter}</span>
                    </div>
                  )}
                  
                  {/* Term & Short Meaning */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
                        {word.term}
                      </h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#3D5A80]/10 text-[#3D5A80] capitalize">
                        {word.category}
                      </span>
                    </div>
                    <p className={`text-[#3D5A80] ${expandedWord === word.word_id ? '' : 'line-clamp-1'}`}>
                      {word.meaning}
                    </p>
                  </div>
                  
                  {/* Expand indicator */}
                  <div className={`w-8 h-8 rounded-full bg-[#E0FBFC] flex items-center justify-center flex-shrink-0 transition-transform ${
                    expandedWord === word.word_id ? 'rotate-180' : ''
                  }`}>
                    <ChevronLeft className="w-5 h-5 text-[#1D3557] -rotate-90" />
                  </div>
                </button>
                
                {/* Expanded Content */}
                {expandedWord === word.word_id && (
                  <div className="px-4 pb-4 border-t-2 border-[#1D3557]/10 pt-3">
                    {/* Large Media Display - Image or Video */}
                    {word.video_url ? (
                      <div className="mb-4">
                        <video 
                          src={getAssetUrl(word.video_url)} 
                          controls
                          className="w-full max-w-md mx-auto rounded-xl border-3 border-[#1D3557] shadow-[3px_3px_0px_0px_#1D3557]"
                          poster={word.image_url ? getAssetUrl(word.image_url) : undefined}
                        />
                      </div>
                    ) : word.image_url && (
                      <div className="mb-4">
                        <img 
                          src={getAssetUrl(word.image_url)} 
                          alt={`${word.term} illustration`}
                          className="w-full max-w-md mx-auto rounded-xl border-3 border-[#1D3557] shadow-[3px_3px_0px_0px_#1D3557] object-contain bg-white"
                        />
                      </div>
                    )}
                    
                    {word.description && (
                      <div className="mb-3">
                        <h4 className="text-sm font-bold text-[#1D3557] mb-1">More Info:</h4>
                        <p className="text-[#3D5A80]">{word.description}</p>
                      </div>
                    )}
                    
                    {word.examples?.length > 0 && word.examples.some(e => e) && (
                      <div className="bg-[#FFD23F]/20 rounded-xl p-3">
                        <h4 className="text-sm font-bold text-[#1D3557] mb-2">Examples:</h4>
                        <ul className="space-y-1">
                          {word.examples.filter(e => e).map((example, i) => (
                            <li key={i} className="text-[#1D3557] text-sm pl-4 relative before:content-[''] before:absolute before:left-0 before:top-2 before:w-2 before:h-2 before:bg-[#06D6A0] before:rounded-full">
                              "{example}"
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
