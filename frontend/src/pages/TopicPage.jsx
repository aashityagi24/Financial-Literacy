import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { 
  BookOpen, ChevronLeft, ChevronRight, Check, Play, Download,
  FileText, FileSpreadsheet, Gamepad2, FolderOpen, ExternalLink, X
} from 'lucide-react';
import { Progress } from "@/components/ui/progress";
import { useFirstVisitAnimation } from '@/hooks/useFirstVisitAnimation';

const CONTENT_TYPE_CONFIG = {
  lesson: { icon: FileText, color: 'text-blue-500', bg: 'bg-blue-100', label: 'Lesson' },
  book: { icon: BookOpen, color: 'text-green-500', bg: 'bg-green-100', label: 'Book' },
  worksheet: { icon: FileSpreadsheet, color: 'text-orange-500', bg: 'bg-orange-100', label: 'Worksheet' },
  activity: { icon: Gamepad2, color: 'text-purple-500', bg: 'bg-purple-100', label: 'Activity' },
};

export default function TopicPage({ user }) {
  const { topicId } = useParams();
  const navigate = useNavigate();
  const [topic, setTopic] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [progress, setProgress] = useState({});
  const [loading, setLoading] = useState(true);
  const [isNewContent, setIsNewContent] = useState(false);
  const [selectedContent, setSelectedContent] = useState(null);
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const [showActivityViewer, setShowActivityViewer] = useState(false);
  const showAnimations = useFirstVisitAnimation(`topic-${topicId}`);
  
  useEffect(() => {
    fetchTopicData();
  }, [topicId]);
  
  const fetchTopicData = async () => {
    setLoading(true);
    try {
      // Try new content system first
      const newTopicRes = await axios.get(`${API}/content/topics/${topicId}`).catch(() => null);
      
      if (newTopicRes?.data) {
        setTopic(newTopicRes.data);
        setIsNewContent(true);
        setLessons([]); // Content items are in topic.content_items
      } else {
        // Fall back to legacy system
        const [topicRes, lessonsRes, progressRes] = await Promise.all([
          axios.get(`${API}/learn/topics/${topicId}`),
          axios.get(`${API}/learn/topics/${topicId}/lessons`),
          axios.get(`${API}/learn/progress`)
        ]);
        
        setTopic(topicRes.data);
        setLessons(lessonsRes.data);
        setProgress(progressRes.data?.by_lesson || {});
        setIsNewContent(false);
      }
    } catch (error) {
      toast.error('Failed to load topic');
      navigate('/learn');
    } finally {
      setLoading(false);
    }
  };
  
  const handleCompleteContent = async (contentId) => {
    try {
      const response = await axios.post(`${API}/content/items/${contentId}/complete`);
      toast.success(`Completed! +${response.data.reward} coins`);
      fetchTopicData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to complete');
    }
  };
  
  const openContent = (content) => {
    setSelectedContent(content);
    
    if (content.content_type === 'worksheet' && content.content_data?.pdf_url) {
      setShowPdfViewer(true);
    } else if (content.content_type === 'activity' && content.content_data?.html_url) {
      setShowActivityViewer(true);
    } else if (content.content_type === 'lesson') {
      // Navigate to lesson page
      navigate(`/learn/lesson/${content.content_id}`);
    }
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
          <p className="text-[#3D5A80]">Topic not found</p>
          <Link to="/learn" className="btn-primary mt-4">Back to Learn</Link>
        </div>
      </div>
    );
  }
  
  const renderContentIcon = (type) => {
    const config = CONTENT_TYPE_CONFIG[type] || CONTENT_TYPE_CONFIG.lesson;
    const Icon = config.icon;
    return <Icon className={`w-5 h-5 ${config.color}`} />;
  };
  
  return (
    <div className="min-h-screen bg-[#E0FBFC]" data-testid="topic-page">
      {/* Header */}
      <header className="bg-white border-b-3 border-[#1D3557]">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/learn" className="p-2 rounded-xl border-2 border-[#1D3557] hover:bg-[#E0FBFC]">
              <ChevronLeft className="w-5 h-5 text-[#1D3557]" />
            </Link>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {topic.thumbnail ? (
                <img src={topic.thumbnail} alt="" className="w-10 h-10 rounded-xl border-2 border-[#1D3557] object-cover" />
              ) : (
                <div className="w-10 h-10 bg-[#FFD23F] rounded-xl border-3 border-[#1D3557] flex items-center justify-center">
                  {topic.icon || <FolderOpen className="w-6 h-6 text-[#1D3557]" />}
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
        {/* New Content System */}
        {isNewContent && (
          <>
            {/* Subtopics */}
            {topic.subtopics?.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-bold text-[#1D3557] mb-4" style={{ fontFamily: 'Fredoka' }}>
                  Subtopics
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {topic.subtopics.map((subtopic, index) => (
                    <Link
                      key={subtopic.topic_id}
                      to={`/learn/topic/${subtopic.topic_id}`}
                      className={`card-playful p-4 hover:scale-[1.02] transition-transform ${showAnimations ? 'animate-bounce-in' : ''}`}
                      style={showAnimations ? { animationDelay: `${index * 0.05}s` } : {}}
                    >
                      {subtopic.thumbnail ? (
                        <img src={subtopic.thumbnail} alt="" className="w-full aspect-video rounded-lg border-2 border-[#1D3557] object-cover mb-3" />
                      ) : (
                        <div className="w-full aspect-video rounded-lg border-2 border-[#1D3557] bg-[#FFD23F]/20 flex items-center justify-center mb-3">
                          <FolderOpen className="w-8 h-8 text-[#FFD23F]" />
                        </div>
                      )}
                      <h3 className="font-bold text-[#1D3557] text-sm line-clamp-2">{subtopic.title}</h3>
                      <p className="text-xs text-[#3D5A80] mt-1">{subtopic.content_count || 0} items</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            
            {/* Content Items */}
            {topic.content_items?.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-[#1D3557] mb-4" style={{ fontFamily: 'Fredoka' }}>
                  Content
                </h2>
                <div className="space-y-3">
                  {topic.content_items.map((content, index) => {
                    const config = CONTENT_TYPE_CONFIG[content.content_type] || CONTENT_TYPE_CONFIG.lesson;
                    const Icon = config.icon;
                    
                    return (
                      <div
                        key={content.content_id}
                        className={`card-playful p-4 cursor-pointer hover:scale-[1.01] transition-transform ${showAnimations ? 'animate-bounce-in' : ''}`}
                        style={showAnimations ? { animationDelay: `${index * 0.05}s` } : {}}
                        onClick={() => openContent(content)}
                      >
                        <div className="flex items-center gap-4">
                          {content.thumbnail ? (
                            <img src={content.thumbnail} alt="" className="w-16 h-16 rounded-xl border-2 border-[#1D3557] object-cover flex-shrink-0" />
                          ) : (
                            <div className={`w-16 h-16 rounded-xl border-2 border-[#1D3557] ${config.bg} flex items-center justify-center flex-shrink-0`}>
                              <Icon className={`w-8 h-8 ${config.color}`} />
                            </div>
                          )}
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs px-2 py-0.5 rounded ${config.bg} ${config.color}`}>
                                {config.label}
                              </span>
                            </div>
                            <h3 className="font-bold text-[#1D3557]">{content.title}</h3>
                            <p className="text-sm text-[#3D5A80] line-clamp-1">{content.description}</p>
                            <p className="text-xs text-[#06D6A0] font-medium mt-1">+{content.reward_coins} coins</p>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {content.content_type === 'worksheet' && (
                              <span className="text-xs text-[#3D5A80]">PDF</span>
                            )}
                            {content.content_type === 'activity' && (
                              <span className="text-xs text-[#3D5A80]">Interactive</span>
                            )}
                            <ChevronRight className="w-5 h-5 text-[#3D5A80]" />
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
              <div className="card-playful p-8 text-center">
                <FolderOpen className="w-16 h-16 mx-auto text-[#98C1D9] mb-4" />
                <h3 className="text-xl font-bold text-[#1D3557] mb-2">No Content Yet</h3>
                <p className="text-[#3D5A80]">Content is being prepared for this topic!</p>
              </div>
            )}
          </>
        )}
        
        {/* Legacy Content System */}
        {!isNewContent && (
          <div className="space-y-3">
            {lessons.map((lesson, index) => {
              const isCompleted = progress[lesson.lesson_id]?.completed;
              
              return (
                <Link
                  key={lesson.lesson_id}
                  to={`/learn/lesson/${lesson.lesson_id}`}
                  className={`card-playful p-4 hover:scale-[1.01] transition-transform block ${showAnimations ? 'animate-bounce-in' : ''}`}
                  style={showAnimations ? { animationDelay: `${index * 0.05}s` } : {}}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl border-3 border-[#1D3557] flex items-center justify-center flex-shrink-0 ${
                      isCompleted ? 'bg-[#06D6A0]' : 'bg-[#FFD23F]'
                    }`}>
                      {isCompleted ? (
                        <Check className="w-6 h-6 text-white" />
                      ) : (
                        <span className="text-xl font-bold text-[#1D3557]">{index + 1}</span>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-[#1D3557]">{lesson.title}</h3>
                      <div className="flex items-center gap-3 text-sm text-[#3D5A80]">
                        <span className="capitalize">{lesson.lesson_type}</span>
                        <span>•</span>
                        <span>{lesson.duration_minutes} min</span>
                        <span>•</span>
                        <span className="text-[#06D6A0]">+{lesson.reward_coins} coins</span>
                      </div>
                    </div>
                    
                    <ChevronRight className="w-5 h-5 text-[#3D5A80]" />
                  </div>
                </Link>
              );
            })}
            
            {lessons.length === 0 && (
              <div className="card-playful p-8 text-center">
                <BookOpen className="w-16 h-16 mx-auto text-[#98C1D9] mb-4" />
                <h3 className="text-xl font-bold text-[#1D3557] mb-2">No Lessons Yet</h3>
                <p className="text-[#3D5A80]">Lessons are being prepared!</p>
              </div>
            )}
          </div>
        )}
      </main>
      
      {/* PDF Viewer Modal */}
      {showPdfViewer && selectedContent && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="font-bold text-[#1D3557]">{selectedContent.title}</h3>
                <p className="text-sm text-[#3D5A80]">{selectedContent.content_data?.instructions}</p>
              </div>
              <div className="flex items-center gap-2">
                <a 
                  href={selectedContent.content_data.pdf_url} 
                  download 
                  className="p-2 hover:bg-gray-100 rounded-lg"
                  title="Download PDF"
                >
                  <Download className="w-5 h-5 text-[#3D5A80]" />
                </a>
                <button 
                  onClick={() => { setShowPdfViewer(false); setSelectedContent(null); }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5 text-[#3D5A80]" />
                </button>
              </div>
            </div>
            <div className="flex-1 p-4">
              <iframe 
                src={selectedContent.content_data.pdf_url}
                className="w-full h-full rounded-lg border"
                title={selectedContent.title}
              />
            </div>
            <div className="p-4 border-t flex justify-between items-center">
              <span className="text-sm text-[#06D6A0] font-medium">+{selectedContent.reward_coins} coins on completion</span>
              <button 
                onClick={() => { handleCompleteContent(selectedContent.content_id); setShowPdfViewer(false); }}
                className="btn-primary"
              >
                Mark as Complete
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Activity Viewer Modal */}
      {showActivityViewer && selectedContent && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="font-bold text-[#1D3557]">{selectedContent.title}</h3>
                <p className="text-sm text-[#3D5A80]">{selectedContent.content_data?.instructions}</p>
              </div>
              <div className="flex items-center gap-2">
                <a 
                  href={selectedContent.content_data.html_url} 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 hover:bg-gray-100 rounded-lg"
                  title="Open in new tab"
                >
                  <ExternalLink className="w-5 h-5 text-[#3D5A80]" />
                </a>
                <button 
                  onClick={() => { setShowActivityViewer(false); setSelectedContent(null); }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5 text-[#3D5A80]" />
                </button>
              </div>
            </div>
            <div className="flex-1">
              <iframe 
                src={selectedContent.content_data.html_url}
                className="w-full h-full"
                title={selectedContent.title}
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
            <div className="p-4 border-t flex justify-between items-center">
              <span className="text-sm text-[#06D6A0] font-medium">+{selectedContent.reward_coins} coins on completion</span>
              <button 
                onClick={() => { handleCompleteContent(selectedContent.content_id); setShowActivityViewer(false); }}
                className="btn-primary"
              >
                Mark as Complete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
