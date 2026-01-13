import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API, getAssetUrl } from '@/App';
import { toast } from 'sonner';
import { 
  BookOpen, ChevronLeft, ChevronRight, Check, Download,
  FileText, FileSpreadsheet, Gamepad2, FolderOpen, ExternalLink, X,
  Video, Book, Play
} from 'lucide-react';
import { useFirstVisitAnimation } from '@/hooks/useFirstVisitAnimation';

const CONTENT_TYPE_CONFIG = {
  worksheet: { icon: FileSpreadsheet, color: 'text-orange-600', bg: 'bg-orange-100', label: 'Worksheet' },
  activity: { icon: Gamepad2, color: 'text-purple-600', bg: 'bg-purple-100', label: 'Activity' },
  book: { icon: BookOpen, color: 'text-green-600', bg: 'bg-green-100', label: 'Book' },
  workbook: { icon: Book, color: 'text-blue-600', bg: 'bg-blue-100', label: 'Workbook' },
  video: { icon: Video, color: 'text-red-600', bg: 'bg-red-100', label: 'Video' },
};

export default function TopicPage({ user }) {
  const { topicId } = useParams();
  const navigate = useNavigate();
  const [topic, setTopic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedContent, setSelectedContent] = useState(null);
  const [showViewer, setShowViewer] = useState(false);
  const showAnimations = useFirstVisitAnimation(`topic-${topicId}`);
  
  useEffect(() => {
    fetchTopicData();
  }, [topicId]);
  
  const fetchTopicData = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/content/topics/${topicId}`);
      setTopic(res.data);
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
      toast.success(`Completed! +₹${response.data.reward} 🎉`);
      fetchTopicData();
    } catch (error) {
      if (error.response?.data?.message === 'Already completed') {
        toast.info('You already completed this!');
      } else {
        toast.error(error.response?.data?.detail || 'Failed to complete');
      }
    }
  };
  
  const openContent = (content) => {
    setSelectedContent(content);
    
    if (content.content_type === 'worksheet' || content.content_type === 'workbook') {
      if (content.content_data?.pdf_url) {
        setShowViewer(true);
      } else {
        toast.info('No PDF available for this item');
      }
    } else if (content.content_type === 'activity') {
      if (content.content_data?.html_url) {
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
      if (content.content_data?.content_url) {
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
          <Link to="/learn" className="btn-primary mt-4 inline-block px-6 py-3">Back to Learn</Link>
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
            <Link to="/learn" className="p-2 rounded-xl border-3 border-[#1D3557] bg-white hover:bg-[#FFD23F]/20 transition-colors">
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
        {/* Subtopics */}
        {topic.subtopics?.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-[#1D3557] mb-4" style={{ fontFamily: 'Fredoka' }}>
              📂 Subtopics
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
                    <img src={getAssetUrl(subtopic.thumbnail)} alt="" className="w-full aspect-video rounded-xl border-3 border-[#1D3557] object-cover mb-3" />
                  ) : (
                    <div className="w-full aspect-video rounded-xl border-3 border-[#1D3557] bg-[#FFD23F]/30 flex items-center justify-center mb-3">
                      <FolderOpen className="w-10 h-10 text-[#1D3557]" />
                    </div>
                  )}
                  <h3 className="font-bold text-[#1D3557] text-sm line-clamp-2">{subtopic.title}</h3>
                  {subtopic.content_count > 0 && (
                    <p className="text-xs text-[#06D6A0] font-medium mt-1">{subtopic.content_count} items</p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}
        
        {/* Content Items */}
        {topic.content_items?.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-[#1D3557] mb-4" style={{ fontFamily: 'Fredoka' }}>
              📖 Learning Content
            </h2>
            <div className="space-y-4">
              {topic.content_items.map((content, index) => {
                const config = CONTENT_TYPE_CONFIG[content.content_type] || CONTENT_TYPE_CONFIG.worksheet;
                const Icon = config.icon;
                
                return (
                  <div
                    key={content.content_id}
                    className={`card-playful p-5 cursor-pointer hover:scale-[1.01] transition-transform ${showAnimations ? 'animate-bounce-in' : ''}`}
                    style={showAnimations ? { animationDelay: `${index * 0.05}s` } : {}}
                    onClick={() => openContent(content)}
                  >
                    <div className="flex items-center gap-4">
                      {content.thumbnail ? (
                        <img src={getAssetUrl(content.thumbnail)} alt="" className="w-20 h-20 rounded-xl border-3 border-[#1D3557] object-cover flex-shrink-0" />
                      ) : (
                        <div className={`w-20 h-20 rounded-xl border-3 border-[#1D3557] ${config.bg} flex items-center justify-center flex-shrink-0`}>
                          <Icon className={`w-10 h-10 ${config.color}`} />
                        </div>
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-3 py-1 rounded-full font-medium ${config.bg} ${config.color}`}>
                            {config.label}
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>{content.title}</h3>
                        <p className="text-[#3D5A80] line-clamp-1">{content.description}</p>
                        <p className="text-sm text-[#06D6A0] font-bold mt-1">+₹{content.reward_coins}</p>
                      </div>
                      
                      <div className="flex items-center">
                        <div className="w-12 h-12 rounded-full bg-[#FFD23F] border-3 border-[#1D3557] flex items-center justify-center">
                          <Play className="w-5 h-5 text-[#1D3557] ml-0.5" />
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
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col border-4 border-[#1D3557]">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b-3 border-[#1D3557]">
              <div className="flex items-center gap-3">
                {getContentIcon(selectedContent.content_type)}
                <div>
                  <h3 className="font-bold text-[#1D3557] text-lg">{selectedContent.title}</h3>
                  <p className="text-sm text-[#3D5A80]">{selectedContent.content_data?.instructions || selectedContent.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {(selectedContent.content_type === 'worksheet' || selectedContent.content_type === 'workbook') && selectedContent.content_data?.pdf_url && (
                  <a 
                    href={selectedContent.content_data.pdf_url} 
                    download 
                    className="p-2 hover:bg-gray-100 rounded-xl border-2 border-[#1D3557]"
                    title="Download PDF"
                  >
                    <Download className="w-5 h-5 text-[#1D3557]" />
                  </a>
                )}
                {selectedContent.content_type === 'activity' && selectedContent.content_data?.html_url && (
                  <a 
                    href={selectedContent.content_data.html_url} 
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
            
            {/* Modal Content */}
            <div className="flex-1 bg-gray-100">
              {(selectedContent.content_type === 'worksheet' || selectedContent.content_type === 'workbook') && (
                <iframe 
                  src={selectedContent.content_data.pdf_url}
                  className="w-full h-full"
                  title={selectedContent.title}
                />
              )}
              {selectedContent.content_type === 'activity' && (
                <iframe 
                  src={selectedContent.content_data.html_url}
                  className="w-full h-full"
                  title={selectedContent.title}
                  sandbox="allow-scripts allow-same-origin"
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
            
            {/* Modal Footer */}
            <div className="p-4 border-t-3 border-[#1D3557] flex justify-between items-center bg-[#FFD23F]/20">
              <span className="text-lg font-bold text-[#06D6A0]">+₹{selectedContent.reward_coins} on completion</span>
              <button 
                onClick={() => { handleCompleteContent(selectedContent.content_id); closeViewer(); }}
                className="btn-primary px-6 py-3 text-lg"
              >
                <Check className="w-5 h-5 mr-2 inline" />
                Mark as Complete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
