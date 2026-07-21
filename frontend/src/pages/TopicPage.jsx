import { useState, useEffect, useRef } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { API, getAssetUrl } from '@/App';
import { toast } from 'sonner';
import { 
  BookOpen, ChevronLeft, ChevronRight, Check, Download,
  FileText, FileSpreadsheet, Gamepad2, FolderOpen, ExternalLink, X,
  Video, Book, Play, Lock, CheckCircle, BarChart3, Lightbulb
} from 'lucide-react';
import { useFirstVisitAnimation } from '@/hooks/useFirstVisitAnimation';
import { Progress } from "@/components/ui/progress";
import ActivityScoresBadge from "@/components/ActivityScoresBadge";
import ChildActivityScore from "@/components/ChildActivityScore";
import TrialLimitDialog from "@/components/TrialLimitDialog";

const CONTENT_TYPE_CONFIG = {
  worksheet: { icon: FileSpreadsheet, color: 'text-orange-600', bg: 'bg-orange-100', label: 'Worksheet' },
  activity: { icon: Gamepad2, color: 'text-purple-600', bg: 'bg-purple-100', label: 'Activity' },
  book: { icon: BookOpen, color: 'text-green-600', bg: 'bg-green-100', label: 'Book' },
  workbook: { icon: Book, color: 'text-blue-600', bg: 'bg-blue-100', label: 'Workbook' },
  know_it_sheet: { icon: Lightbulb, color: 'text-yellow-700', bg: 'bg-yellow-100', label: 'Know-It Sheet' },
  video: { icon: Video, color: 'text-red-600', bg: 'bg-red-100', label: 'Video' },
};

// Worksheet-style content types: they share the same PDF viewer/download/edit UI.
const WORKSHEET_LIKE_TYPES = new Set(['worksheet', 'workbook', 'know_it_sheet']);
const isWorksheetLike = (type) => WORKSHEET_LIKE_TYPES.has(type);

export default function TopicPage({ user }) {
  const { topicId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const gradeFilter = searchParams.get('grade');
  const [topic, setTopic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedContent, setSelectedContent] = useState(null);
  const [showViewer, setShowViewer] = useState(false);
  const [contentFilter, setContentFilter] = useState('all');
  const [htmlFiles, setHtmlFiles] = useState([]);
  const [currentHtmlIndex, setCurrentHtmlIndex] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState({ is_limited: false, remaining: null, limit: null });
  const [downloading, setDownloading] = useState(false);
  const [showTrialLimitDialog, setShowTrialLimitDialog] = useState(false);
  // Content IDs the teacher has marked "Done in Class" across their classrooms.
  // Fetched once for teachers; children see the same info via `content.done_in_class`
  // returned by the topic API.
  const [teacherDoneIds, setTeacherDoneIds] = useState(new Set());
  const trialBannerShownRef = useRef(false);
  const showAnimations = useFirstVisitAnimation(`topic-${topicId}`);
  const lastCompletedRef = useRef(null);
  
  useEffect(() => {
    fetchTopicData();
  }, [topicId, gradeFilter]);

  // Load the teacher's Done-in-Class list once — TopicPage re-renders will use it
  // to show the checkbox state next to each content row.
  useEffect(() => {
    if (user?.role !== 'teacher') return;
    (async () => {
      try {
        const res = await axios.get(`${API}/teacher/done-in-class`);
        setTeacherDoneIds(new Set(res.data?.content_ids || []));
      } catch (e) {
        /* silent — teacher without classrooms yet */
      }
    })();
  }, [user?.role]);

  const toggleDoneInClass = async (contentId, e) => {
    e?.stopPropagation();
    try {
      const res = await axios.post(`${API}/teacher/content/${contentId}/toggle-done-in-class`);
      setTeacherDoneIds(prev => {
        const next = new Set(prev);
        if (res.data.done_in_class) next.add(contentId);
        else next.delete(contentId);
        return next;
      });
      toast.success(res.data.message);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not update Done-in-Class');
    }
  };
  
  // Fetch the user's current trial-download status whenever a downloadable
  // item is opened, so we can show "X downloads left" and disable when zero.
  useEffect(() => {
    if (!selectedContent?.content_id) return;
    const hasDownloadable = !!(selectedContent.content_data?.pdf_url);
    if (!hasDownloadable) {
      setDownloadStatus({ is_limited: false, remaining: null, limit: null });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${API}/content/${selectedContent.content_id}/download-status`);
        if (cancelled) return;
        const data = res.data || {};
        setDownloadStatus(data);
        // First-time-this-session educational nudge for trial users so the
        // cap doesn't surprise them when they hit it later.
        if (data.is_limited && !trialBannerShownRef.current) {
          trialBannerShownRef.current = true;
          if (typeof data.remaining === 'number') {
            if (data.remaining === 0) {
              toast.error(`Trial download limit reached (${data.limit}/${data.limit}). Upgrade for unlimited access.`, { duration: 6000 });
            } else {
              toast(
                `${data.remaining} of ${data.limit} trial downloads remaining — upgrade for unlimited access.`,
                { duration: 6000 }
              );
            }
          }
        }
      } catch {
        if (!cancelled) setDownloadStatus({ is_limited: false, remaining: null, limit: null });
      }
    })();
    return () => { cancelled = true; };
  }, [selectedContent?.content_id]);
  
  const handleDownload = async () => {
    if (!selectedContent?.content_id) return;
    // Pre-empt the round trip when we already know the trial allowance is
    // exhausted so the user immediately sees the upsell modal.
    if (downloadStatus.is_limited && downloadStatus.remaining === 0) {
      setShowTrialLimitDialog(true);
      return;
    }
    setDownloading(true);
    try {
      const res = await axios.post(`${API}/content/${selectedContent.content_id}/download`);
      const { url, is_limited, remaining, limit } = res.data || {};
      if (url) {
        const a = document.createElement('a');
        a.href = getAssetUrl(url);
        a.download = '';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      if (is_limited) {
        setDownloadStatus({ is_limited: true, remaining, limit });
        // Let the global banner refresh its count too.
        window.dispatchEvent(new Event('trial-status-refresh'));
        if (typeof remaining === 'number') {
          if (remaining === 0) {
            // Used the last allowed download — show the upsell.
            setShowTrialLimitDialog(true);
          } else {
            toast.success(`${remaining} of ${limit} trial downloads remaining`);
          }
        }
      }
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail || 'Download failed';
      if (status === 403) {
        setDownloadStatus({ is_limited: true, remaining: 0, limit: downloadStatus.limit || 5 });
        window.dispatchEvent(new Event('trial-status-refresh'));
        // Hard wall → show the explanation modal.
        setShowTrialLimitDialog(true);
      } else {
        toast.error(detail);
      }
    } finally {
      setDownloading(false);
    }
  };
  
  // Listen for activity score messages from iframes
  // Track last score save time to debounce rapid postMessage events
  const lastScoreSaveRef = useRef(0);
  
  useEffect(() => {
    const handleActivityMessage = async (event) => {
      // Validate message structure
      if (!event.data || typeof event.data !== 'object') return;
      
      const { type, score, timeSpent, correctAnswers, totalQuestions, maxScore, percentage, extraData } = event.data;
      
      // Handle activity completion message
      if (type === 'ACTIVITY_COMPLETE' && selectedContent && user?.role === 'child') {
        // Debounce: ignore if a score was saved within last 3 seconds
        const now = Date.now();
        if (now - lastScoreSaveRef.current < 3000) return;
        lastScoreSaveRef.current = now;
        
        try {
          await axios.post(`${API}/activity/score`, {
            content_id: selectedContent.content_id,
            score: score || 0,
            max_score: maxScore || 100,
            percentage: percentage || score || 0,
            timeSpent: timeSpent || 0,
            correctAnswers: correctAnswers || 0,
            totalQuestions: totalQuestions || 0,
            completed: true,
            extraData: extraData || {}
          });
          
          // Show encouraging feedback based on percentage
          const pct = totalQuestions ? Math.round(((correctAnswers || 0) / totalQuestions) * 100) : (percentage || 0);
          let feedback, toastFn;
          if (pct >= 80) { feedback = 'Great job!'; toastFn = toast.success; }
          else if (pct >= 50) { feedback = 'Almost there!'; toastFn = toast.info; }
          else { feedback = 'Keep practicing!'; toastFn = toast.warning; }
          
          // Auto-complete the content if not already completed
          if (!selectedContent.is_completed) {
            try {
              const response = await axios.post(`${API}/content/items/${selectedContent.content_id}/complete`, {
                percentage: pct
              });
              const coins = response.data.coins_awarded || 0;
              if (pct >= 80) {
                toastFn(`${feedback} Earned ₹${coins}!`, { duration: 4000 });
              } else if (pct >= 50) {
                toastFn(`${feedback} Earned ₹${coins}. Score higher for more!`, { duration: 4000 });
              } else {
                toastFn(`${feedback} Earned ₹${coins}. Try again for a bigger reward!`, { duration: 4000 });
              }
              lastCompletedRef.current = selectedContent.content_id;
              // Close viewer after delay, then silently refresh in background
              setTimeout(() => { closeViewer(); fetchTopicData(true); }, 2500);
            } catch (completeError) {
              toastFn(feedback, { duration: 4000 });
            }
          } else {
            toastFn(feedback, { duration: 4000 });
          }
        } catch (error) {
          console.error('Failed to save activity score:', error);
        }
      }
      
      // Handle progress update (for partial saves)
      if (type === 'ACTIVITY_PROGRESS' && selectedContent && user?.role === 'child') {
        console.log('Activity progress:', event.data);
        // Could be used for auto-save functionality
      }
    };
    
    window.addEventListener('message', handleActivityMessage);
    return () => window.removeEventListener('message', handleActivityMessage);
  }, [selectedContent, user]);
  
  const fetchTopicData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // Build API URL with grade filter for teachers/parents
      let url = `${API}/content/topics/${topicId}`;
      if (gradeFilter !== null && gradeFilter !== undefined) {
        url += `?grade=${gradeFilter}`;
      }
      const res = await axios.get(url);
      setTopic(res.data);
      
      // Scroll to last completed item after data loads
      if (lastCompletedRef.current) {
        const scrollTarget = lastCompletedRef.current;
        setTimeout(() => {
          const el = document.querySelector(`[data-content-id="${scrollTarget}"]`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          lastCompletedRef.current = null;
        }, 300);
      }
    } catch (error) {
      toast.error('Failed to load topic');
      navigate('/learn');
    } finally {
      if (!silent) setLoading(false);
    }
  };
  
  const handleCompleteContent = async (contentId) => {
    try {
      const response = await axios.post(`${API}/content/items/${contentId}/complete`);
      const coins = response.data.coins_awarded || 0;
      if (coins > 0) {
        toast.success(`Completed! +₹${coins}`);
      } else {
        toast.success('Done! Reward already added to your wallet');
      }
      lastCompletedRef.current = contentId;
      closeViewer();
      fetchTopicData(true);
    } catch (error) {
      if (error.response?.data?.message === 'Already completed') {
        toast.success('Already done! Reward is in your wallet');
        closeViewer();
        fetchTopicData(true);
      } else {
        toast.error(error.response?.data?.detail || 'Failed to complete');
      }
    }
  };
  
  const openContent = async (content) => {
    setSelectedContent(content);
    setHtmlFiles([]);
    setCurrentHtmlIndex(0);
    
    if (isWorksheetLike(content.content_type)) {
      if (content.content_data?.pdf_url) {
        setShowViewer(true);
      } else {
        toast.info('No PDF available for this item');
      }
    } else if (content.content_type === 'activity') {
      if (content.content_data?.html_url) {
        // Check if we have html_files stored, otherwise fetch them
        if (content.content_data?.html_files?.length > 0) {
          setHtmlFiles(content.content_data.html_files);
        } else if (content.content_data?.html_folder) {
          // Fetch HTML files list from the server
          try {
            const res = await axios.get(`${API}/activity-files/${content.content_data.html_folder}`);
            if (res.data.html_files?.length > 0) {
              setHtmlFiles(res.data.html_files);
            }
          } catch (err) {
            // Fallback to single file
            setHtmlFiles([{ name: 'Activity', path: 'index.html', url: content.content_data.html_url }]);
          }
        }
        setShowViewer(true);
      } else {
        toast.info('No activity available for this item');
      }
    } else if (content.content_type === 'video') {
      if (content.content_data?.video_url) {
        setShowViewer(true);
      } else {
        toast.info('No video available for this item');
      }
    } else if (content.content_type === 'book') {
      // Books can have pdf_url, html_url, or external content_url
      if (content.content_data?.pdf_url) {
        setShowViewer(true);
      } else if (content.content_data?.html_url) {
        // Check for multiple HTML files
        if (content.content_data?.html_files?.length > 0) {
          setHtmlFiles(content.content_data.html_files);
        } else if (content.content_data?.html_folder) {
          try {
            const res = await axios.get(`${API}/activity-files/${content.content_data.html_folder}`);
            if (res.data.html_files?.length > 0) {
              setHtmlFiles(res.data.html_files);
            }
          } catch (err) {
            setHtmlFiles([{ name: 'Book', path: 'index.html', url: content.content_data.html_url }]);
          }
        }
        setShowViewer(true);
      } else if (content.content_data?.content_url) {
        window.open(content.content_data.content_url, '_blank');
      } else {
        toast.info('No book link available');
      }
    }
  };
  
  const closeViewer = () => {
    setShowViewer(false);
    setSelectedContent(null);
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#E0FBFC] flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-[#1D3557] border-t-[#FFD23F] rounded-full animate-spin"></div>
      </div>
    );
  }
  
  if (!topic) {
    return (
      <div className="min-h-screen bg-[#E0FBFC] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#3D5A80] text-lg">Topic not found</p>
          <Link to={`/learn${gradeFilter ? `?grade=${gradeFilter}` : ''}`} className="btn-primary mt-4 inline-block px-6 py-3">Back to Learn</Link>
        </div>
      </div>
    );
  }
  
  const getContentIcon = (type) => {
    const config = CONTENT_TYPE_CONFIG[type] || CONTENT_TYPE_CONFIG.worksheet;
    const Icon = config.icon;
    return <Icon className={`w-6 h-6 ${config.color}`} />;
  };
  
  const getVideoEmbedUrl = (url) => {
    // Convert YouTube URLs to embed format
    if (url.includes('youtube.com/watch')) {
      const videoId = url.split('v=')[1]?.split('&')[0];
      return `https://www.youtube.com/embed/${videoId}`;
    }
    if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1]?.split('?')[0];
      return `https://www.youtube.com/embed/${videoId}`;
    }
    return url;
  };
  
  return (
    <div className="min-h-screen bg-[#E0FBFC]" data-testid="topic-page">
      {/* Header */}
      <header className="bg-white border-b-4 border-[#1D3557]">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to={`/learn${gradeFilter ? `?grade=${gradeFilter}` : ''}`} className="p-2 rounded-xl border-3 border-[#1D3557] bg-white hover:bg-[#FFD23F]/20 transition-colors">
              <ChevronLeft className="w-6 h-6 text-[#1D3557]" />
            </Link>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {topic.thumbnail ? (
                <img src={getAssetUrl(topic.thumbnail)} alt="" className="w-12 h-12 rounded-xl border-3 border-[#1D3557] object-contain bg-white" />
              ) : (
                <div className="w-12 h-12 bg-[#FFD23F] rounded-xl border-3 border-[#1D3557] flex items-center justify-center">
                  <FolderOpen className="w-7 h-7 text-[#1D3557]" />
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-[#1D3557] truncate" style={{ fontFamily: 'Fredoka' }}>
                  {topic.title}
                </h1>
                <p className="text-sm text-[#3D5A80] truncate">{topic.description}</p>
              </div>
            </div>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6">
        {/* Topic locked message for children */}
        {user?.role === 'child' && topic.is_unlocked === false && (
          <div className="card-playful p-6 mb-6 bg-gray-100 border-gray-400">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gray-300 flex items-center justify-center">
                <Lock className="w-8 h-8 text-gray-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-600">Topic Locked</h3>
                <p className="text-gray-500">Complete the previous topics to unlock this one!</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Subtopics */}
        {topic.subtopics?.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-[#1D3557] mb-4" style={{ fontFamily: 'Fredoka' }}>
              📂 Subtopics
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {topic.subtopics.map((subtopic, index) => {
                const isChild = user?.role === 'child';
                const isLocked = isChild && subtopic.is_unlocked === false;
                const isCompleted = isChild && subtopic.is_completed;
                
                if (isLocked) {
                  return (
                    <div
                      key={subtopic.topic_id}
                      className={`card-playful p-4 opacity-60 cursor-not-allowed ${showAnimations ? 'animate-bounce-in' : ''}`}
                      style={showAnimations ? { animationDelay: `${index * 0.05}s` } : {}}
                      onClick={() => toast.info('Complete the previous subtopic first!')}
                    >
                      <div className="relative">
                        {subtopic.thumbnail ? (
                          <img src={getAssetUrl(subtopic.thumbnail)} alt="" className="w-full aspect-video rounded-xl border-3 border-gray-400 object-contain bg-white mb-3 grayscale" />
                        ) : (
                          <div className="w-full aspect-video rounded-xl border-3 border-gray-400 bg-gray-200 flex items-center justify-center mb-3">
                            <FolderOpen className="w-10 h-10 text-gray-400" />
                          </div>
                        )}
                        <div className="absolute inset-0 mb-3 flex items-center justify-center bg-black/30 rounded-xl">
                          <Lock className="w-8 h-8 text-white" />
                        </div>
                      </div>
                      <h3 className="font-bold text-gray-500 text-sm line-clamp-2">{subtopic.title}</h3>
                      <p className="text-xs text-gray-400 font-medium mt-1">🔒 Locked</p>
                    </div>
                  );
                }
                
                return (
                <Link
                  key={subtopic.topic_id}
                  to={`/learn/topic/${subtopic.topic_id}${gradeFilter ? `?grade=${gradeFilter}` : ''}`}
                  className={`card-playful p-4 hover:scale-[1.02] transition-transform ${showAnimations ? 'animate-bounce-in' : ''} ${isCompleted ? 'border-[#06D6A0]' : ''}`}
                  style={showAnimations ? { animationDelay: `${index * 0.05}s` } : {}}
                >
                  <div className="relative">
                    {subtopic.thumbnail ? (
                      <img src={getAssetUrl(subtopic.thumbnail)} alt="" className={`w-full aspect-video rounded-xl border-3 ${isCompleted ? 'border-[#06D6A0]' : 'border-[#1D3557]'} object-contain bg-white mb-3`} />
                    ) : (
                      <div className={`w-full aspect-video rounded-xl border-3 ${isCompleted ? 'border-[#06D6A0] bg-[#06D6A0]/20' : 'border-[#1D3557] bg-[#FFD23F]/30'} flex items-center justify-center mb-3`}>
                        {isCompleted ? (
                          <CheckCircle className="w-10 h-10 text-[#06D6A0]" />
                        ) : (
                          <FolderOpen className="w-10 h-10 text-[#1D3557]" />
                        )}
                      </div>
                    )}
                    {isCompleted && (
                      <div className="absolute top-2 right-2 w-8 h-8 bg-[#06D6A0] rounded-full flex items-center justify-center border-2 border-white">
                        <CheckCircle className="w-5 h-5 text-white" />
                      </div>
                    )}
                  </div>
                  <h3 className={`font-bold text-sm line-clamp-2 ${isCompleted ? 'text-[#06D6A0]' : 'text-[#1D3557]'}`}>{subtopic.title}</h3>
                  {subtopic.content_count > 0 && (
                    <p className={`text-xs font-medium mt-1 ${isCompleted ? 'text-[#06D6A0]' : 'text-[#06D6A0]'}`}>
                      {subtopic.content_count} items
                      {isCompleted && ' ✓'}
                    </p>
                  )}
                </Link>
              )})}
            </div>
          </div>
        )}
        
        {/* Content Items */}
        {topic.content_items?.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
                📖 Learning Content
              </h2>
              {user?.role === 'child' && (
                <div className="flex gap-1.5 bg-white rounded-xl p-1 border-2 border-[#1D3557]/10" data-testid="content-filter-tabs">
                  {[
                    { key: 'all', label: 'All' },
                    { key: 'pending', label: 'Pending' },
                    { key: 'completed', label: 'Done' },
                  ].map(f => (
                    <button
                      key={f.key}
                      onClick={() => setContentFilter(f.key)}
                      data-testid={`content-filter-${f.key}`}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        contentFilter === f.key
                          ? 'bg-[#1D3557] text-white shadow-sm'
                          : 'text-[#3D5A80] hover:bg-[#1D3557]/10'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-4">
              {topic.content_items
                .filter(content => {
                  if (user?.role !== 'child' || contentFilter === 'all') return true;
                  if (contentFilter === 'completed') return content.is_completed;
                  if (contentFilter === 'pending') return !content.is_completed;
                  return true;
                })
                .map((content, index) => {
                const config = CONTENT_TYPE_CONFIG[content.content_type] || CONTENT_TYPE_CONFIG.worksheet;
                const Icon = config.icon;
                const isChild = user?.role === 'child';
                const isLocked = isChild && content.is_unlocked === false;
                const isCompleted = (isChild || user?.role === 'parent') && content.is_completed;
                
                if (isLocked) {
                  return (
                    <div
                      key={content.content_id}
                      data-content-id={content.content_id}
                      className={`card-playful p-5 opacity-60 cursor-not-allowed bg-gray-50 ${showAnimations ? 'animate-bounce-in' : ''}`}
                      style={showAnimations ? { animationDelay: `${index * 0.05}s` } : {}}
                      onClick={() => toast.info('Complete the previous content first!')}
                    >
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          {content.thumbnail ? (
                            <img src={getAssetUrl(content.thumbnail)} alt="" className="w-20 h-20 rounded-xl border-3 border-gray-400 object-contain bg-white flex-shrink-0 grayscale" />
                          ) : (
                            <div className="w-20 h-20 rounded-xl border-3 border-gray-400 bg-gray-200 flex items-center justify-center flex-shrink-0">
                              <Icon className="w-10 h-10 text-gray-400" />
                            </div>
                          )}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-xl">
                            <Lock className="w-6 h-6 text-white" />
                          </div>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs px-3 py-1 rounded-full font-medium bg-gray-200 text-gray-500">
                              {config.label}
                            </span>
                            <Lock className="w-4 h-4 text-gray-400" />
                          </div>
                          <h3 className="text-lg font-bold text-gray-500" style={{ fontFamily: 'Fredoka' }}>{content.title}</h3>
                          <p className="text-base text-gray-400 line-clamp-1">{content.description}</p>
                          <p className="text-base text-gray-400 font-bold mt-1">+₹{content.reward_coins}</p>
                        </div>
                        
                        <div className="flex items-center">
                          <div className="w-12 h-12 rounded-full bg-gray-300 border-3 border-gray-400 flex items-center justify-center">
                            <Lock className="w-5 h-5 text-gray-500" />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }
                
                return (
                  <div
                    key={content.content_id}
                    data-content-id={content.content_id}
                    className={`card-playful p-5 cursor-pointer hover:scale-[1.01] transition-transform ${showAnimations ? 'animate-bounce-in' : ''} ${isCompleted ? 'border-[#06D6A0] bg-[#06D6A0]/5' : ''}`}
                    style={showAnimations ? { animationDelay: `${index * 0.05}s` } : {}}
                    onClick={() => openContent(content)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        {content.thumbnail ? (
                          <img src={getAssetUrl(content.thumbnail)} alt="" className={`w-20 h-20 rounded-xl border-3 ${isCompleted ? 'border-[#06D6A0]' : 'border-[#1D3557]'} object-contain bg-white flex-shrink-0`} />
                        ) : (
                          <div className={`w-20 h-20 rounded-xl border-3 ${isCompleted ? 'border-[#06D6A0] bg-[#06D6A0]/20' : 'border-[#1D3557]'} ${config.bg} flex items-center justify-center flex-shrink-0`}>
                            {isCompleted ? (
                              <CheckCircle className={`w-10 h-10 text-[#06D6A0]`} />
                            ) : (
                              <Icon className={`w-10 h-10 ${config.color}`} />
                            )}
                          </div>
                        )}
                        {isCompleted && content.thumbnail && (
                          <div className="absolute -top-2 -right-2 w-8 h-8 bg-[#06D6A0] rounded-full flex items-center justify-center border-2 border-white">
                            <CheckCircle className="w-5 h-5 text-white" />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-xs px-3 py-1 rounded-full font-medium ${config.bg} ${config.color}`}>
                            {config.label}
                          </span>
                          {/* Child's Activity Score */}
                          {user?.role === 'child' && content.content_type === 'activity' && (
                            <ChildActivityScore contentId={content.content_id} user={user} />
                          )}
                          {/* Done in class badge for children */}
                          {user?.role === 'child' && content.done_in_class && (
                            <span
                              className="text-xs px-2 py-1 rounded-full font-semibold bg-amber-100 text-amber-700 flex items-center gap-1"
                              title="Your teacher covered this in class — feel free to skip or revisit."
                              data-testid={`done-in-class-badge-${content.content_id}`}
                            >
                              <Check className="w-3 h-3" /> Done in class
                            </span>
                          )}
                          {/* Teacher's Done-in-Class toggle */}
                          {user?.role === 'teacher' && (
                            <button
                              onClick={(e) => toggleDoneInClass(content.content_id, e)}
                              className={`text-xs px-2 py-1 rounded-full font-semibold flex items-center gap-1 transition-colors ${
                                teacherDoneIds.has(content.content_id)
                                  ? 'bg-[#06D6A0] text-white hover:bg-[#048A6A]'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                              title="Mark this as done in class — students in your classrooms will inherit it as completed."
                              data-testid={`teacher-done-toggle-${content.content_id}`}
                            >
                              <Check className="w-3 h-3" />
                              {teacherDoneIds.has(content.content_id) ? 'Done in class' : 'Mark done in class'}
                            </button>
                          )}
                          {/* Teacher Analytics Link */}
                          {user?.role === 'teacher' && content.content_type === 'activity' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/activity-analytics/${content.content_id}`);
                              }}
                              className="text-xs px-2 py-1 rounded-full font-bold bg-[#3D5A80] text-white hover:bg-[#1D3557] flex items-center gap-1"
                            >
                              <BarChart3 className="w-3 h-3" />
                              Analytics
                            </button>
                          )}
                        </div>
                        <h3 className="text-lg font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
                          {content.title}
                          {content.is_mandatory === false && (
                            <span className="ml-2 align-middle text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                              Optional
                            </span>
                          )}
                        </h3>
                        <p className="text-base text-[#3D5A80] line-clamp-1">{content.description}</p>
                        {user?.role === 'child' && (
                          <p className={`text-base font-bold mt-1 text-[#06D6A0]`}>
                            {isCompleted 
                              ? `✓ Earned ₹${content.coins_earned != null ? content.coins_earned : content.reward_coins}`
                              : `+₹${content.reward_coins}`
                            }
                          </p>
                        )}
                        
                        {/* Activity Scores for Parents/Teachers */}
                        {['parent', 'teacher'].includes(user?.role) && content.content_type === 'activity' && (
                          <ActivityScoresBadge contentId={content.content_id} user={user} />
                        )}
                      </div>
                      
                      <div className="flex items-center">
                        <div className={`w-12 h-12 rounded-full ${isCompleted ? 'bg-[#06D6A0]' : 'bg-[#FFD23F]'} border-3 border-[#1D3557] flex items-center justify-center`}>
                          {isCompleted ? (
                            <Check className="w-6 h-6 text-white" />
                          ) : (
                            <Play className="w-5 h-5 text-[#1D3557] ml-0.5" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Empty State */}
        {!topic.subtopics?.length && !topic.content_items?.length && (
          <div className="card-playful p-12 text-center">
            <FolderOpen className="w-20 h-20 mx-auto text-[#98C1D9] mb-4" />
            <h3 className="text-2xl font-bold text-[#1D3557] mb-2" style={{ fontFamily: 'Fredoka' }}>
              Coming Soon!
            </h3>
            <p className="text-lg text-[#3D5A80]">
              Content is being prepared for this topic!
            </p>
          </div>
        )}
      </main>
      
      {/* Content Viewer Modal */}
      {showViewer && selectedContent && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-2">
          <div className="bg-white rounded-2xl w-full max-w-5xl h-[96vh] flex flex-col border-4 border-[#1D3557]">
            {/* Modal Header - compact for children */}
            <div className="flex items-center justify-between px-3 py-2 border-b-2 border-[#1D3557]">
              {user?.role === 'child' ? (
                <span className="text-sm font-bold text-[#1D3557] truncate">{selectedContent.title}</span>
              ) : (
                <div className="flex items-center gap-3">
                  {getContentIcon(selectedContent.content_type)}
                  <div>
                    <h3 className="font-bold text-[#1D3557] text-lg">{selectedContent.title}</h3>
                    <p className="text-sm text-[#3D5A80]">{selectedContent.content_data?.instructions || selectedContent.description}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                {/* Download PDF button for worksheets/workbooks. Goes through
                    the API so 1-day trial accounts can be capped at 5 downloads. */}
                {isWorksheetLike(selectedContent.content_type) && selectedContent.content_data?.pdf_url && (
                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className={`p-2 rounded-xl border-2 border-[#1D3557] flex items-center gap-1.5 transition-colors ${
                      downloadStatus.is_limited && downloadStatus.remaining === 0
                        ? 'bg-orange-50 border-orange-400 hover:bg-orange-100'
                        : 'hover:bg-gray-100'
                    } ${downloading ? 'opacity-50 cursor-wait' : ''}`}
                    title={
                      downloadStatus.is_limited
                        ? (downloadStatus.remaining === 0
                            ? 'Trial download limit reached — click to see upgrade options'
                            : `${downloadStatus.remaining} of ${downloadStatus.limit} trial downloads left`)
                        : 'Download PDF'
                    }
                    data-testid="content-download-btn"
                  >
                    {downloadStatus.is_limited && downloadStatus.remaining === 0 ? (
                      <Lock className="w-5 h-5 text-orange-600" />
                    ) : (
                      <Download className="w-5 h-5 text-[#1D3557]" />
                    )}
                    {downloadStatus.is_limited && typeof downloadStatus.remaining === 'number' && (
                      <span className={`text-xs font-semibold ${downloadStatus.remaining === 0 ? 'text-orange-700' : 'text-[#1D3557]'}`}>
                        {downloadStatus.remaining}/{downloadStatus.limit}
                      </span>
                    )}
                  </button>
                )}
                {/* Open in new tab for worksheets/workbooks (for teachers/parents) */}
                {user?.role !== 'child' && isWorksheetLike(selectedContent.content_type) && selectedContent.content_data?.pdf_url && (
                  <a 
                    href={getAssetUrl(selectedContent.content_data.pdf_url)} 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 hover:bg-gray-100 rounded-xl border-2 border-[#1D3557]"
                    title="Open in new tab"
                  >
                    <ExternalLink className="w-5 h-5 text-[#1D3557]" />
                  </a>
                )}
                {/* Open in new tab for activities */}
                {selectedContent.content_type === 'activity' && selectedContent.content_data?.html_url && (
                  <a 
                    href={getAssetUrl(selectedContent.content_data.html_url)} 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 hover:bg-gray-100 rounded-xl border-2 border-[#1D3557]"
                    title="Open in new tab"
                  >
                    <ExternalLink className="w-5 h-5 text-[#1D3557]" />
                  </a>
                )}
                {/* Open in new tab for books with HTML */}
                {selectedContent.content_type === 'book' && selectedContent.content_data?.html_url && (
                  <a 
                    href={getAssetUrl(selectedContent.content_data.html_url)} 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 hover:bg-gray-100 rounded-xl border-2 border-[#1D3557]"
                    title="Open in new tab"
                  >
                    <ExternalLink className="w-5 h-5 text-[#1D3557]" />
                  </a>
                )}
                {/* Open in new tab for books with PDF */}
                {selectedContent.content_type === 'book' && selectedContent.content_data?.pdf_url && (
                  <a 
                    href={getAssetUrl(selectedContent.content_data.pdf_url)} 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 hover:bg-gray-100 rounded-xl border-2 border-[#1D3557]"
                    title="Open in new tab"
                  >
                    <ExternalLink className="w-5 h-5 text-[#1D3557]" />
                  </a>
                )}
                <button 
                  onClick={closeViewer}
                  className="p-2 hover:bg-red-100 rounded-xl border-2 border-[#1D3557]"
                >
                  <X className="w-5 h-5 text-[#1D3557]" />
                </button>
              </div>
            </div>
            
            {/* HTML Files Navigation - Only show tabs for teachers/parents to preview specific pages */}
            {user?.role !== 'child' && (selectedContent.content_type === 'activity' || (selectedContent.content_type === 'book' && selectedContent.content_data?.html_url)) && htmlFiles.length > 1 && (
              <div className="px-4 py-2 bg-[#E0FBFC] border-b-2 border-[#1D3557] flex items-center gap-2 overflow-x-auto">
                <span className="text-sm font-medium text-[#1D3557] whitespace-nowrap">Preview Pages:</span>
                {htmlFiles.map((file, index) => (
                  <button
                    key={file.path}
                    onClick={() => setCurrentHtmlIndex(index)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                      currentHtmlIndex === index 
                        ? 'bg-[#1D3557] text-white' 
                        : 'bg-white border-2 border-[#1D3557] text-[#1D3557] hover:bg-[#FFD23F]/30'
                    }`}
                  >
                    {file.name}
                  </button>
                ))}
              </div>
            )}
            
            {/* Modal Content */}
            <div className="flex-1 bg-gray-100">
              {isWorksheetLike(selectedContent.content_type) && (
                <iframe 
                  src={selectedContent.content_data.pdf_url}
                  className="w-full h-full"
                  title={selectedContent.title}
                />
              )}
              {selectedContent.content_type === 'activity' && (
                <iframe 
                  src={
                    user?.role === 'child' 
                      ? getAssetUrl(htmlFiles.length > 0 ? htmlFiles[0]?.url : selectedContent.content_data.html_url)
                      : getAssetUrl(htmlFiles.length > 0 ? htmlFiles[currentHtmlIndex]?.url : selectedContent.content_data.html_url)
                  }
                  className="w-full h-full"
                  title={selectedContent.title}
                  sandbox="allow-scripts allow-same-origin allow-forms"
                />
              )}
              {selectedContent.content_type === 'book' && selectedContent.content_data?.pdf_url && (
                <iframe 
                  src={getAssetUrl(selectedContent.content_data.pdf_url)}
                  className="w-full h-full"
                  title={selectedContent.title}
                />
              )}
              {selectedContent.content_type === 'book' && selectedContent.content_data?.html_url && !selectedContent.content_data?.pdf_url && (
                <iframe 
                  src={
                    user?.role === 'child'
                      ? getAssetUrl(htmlFiles.length > 0 ? htmlFiles[0]?.url : selectedContent.content_data.html_url)
                      : getAssetUrl(htmlFiles.length > 0 ? htmlFiles[currentHtmlIndex]?.url : selectedContent.content_data.html_url)
                  }
                  className="w-full h-full"
                  title={selectedContent.title}
                  sandbox="allow-scripts allow-same-origin allow-forms"
                />
              )}
              {selectedContent.content_type === 'video' && (
                <div className="w-full h-full flex items-center justify-center p-4">
                  <iframe 
                    src={getVideoEmbedUrl(selectedContent.content_data.video_url)}
                    className="w-full max-w-4xl aspect-video rounded-xl"
                    title={selectedContent.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )}
            </div>
            
            {/* Modal Footer - compact */}
            <div className="px-3 py-1.5 border-t-2 border-[#1D3557] flex justify-between items-center bg-[#FFD23F]/20">
              <span className="text-sm font-bold text-[#06D6A0]">
                {user?.role === 'child' 
                  ? (selectedContent.is_completed 
                      ? `✓ Earned ₹${selectedContent.coins_earned != null ? selectedContent.coins_earned : selectedContent.reward_coins}` 
                      : `+₹${selectedContent.reward_coins}`)
                  : `Reward: ₹${selectedContent.reward_coins}`
                }
              </span>
              <div className="flex items-center gap-2">
                {user?.role === 'child' && selectedContent.content_type !== 'activity' && (
                  <button 
                    onClick={() => { handleCompleteContent(selectedContent.content_id); }}
                    className="btn-primary px-3 py-1.5 text-sm"
                  >
                    <Check className="w-4 h-4 mr-1 inline" />
                    {selectedContent.is_completed ? 'Done' : 'Mark Done'}
                  </button>
                )}
                {user?.role === 'child' && selectedContent.content_type === 'activity' && !selectedContent.is_completed && (
                  <span className="text-xs text-[#3D5A80] italic">Complete the activity to earn reward</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      <TrialLimitDialog
        open={showTrialLimitDialog}
        onClose={() => setShowTrialLimitDialog(false)}
        limit={downloadStatus.limit || 5}
      />
    </div>
  );
}
