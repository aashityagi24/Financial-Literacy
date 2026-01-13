import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API, getAssetUrl } from '@/App';
import { toast } from 'sonner';
import { 
  BookOpen, ChevronLeft, ChevronRight, Trophy, FolderOpen,
  FileText, FileSpreadsheet, Gamepad2, Video, Book
} from 'lucide-react';
import { Progress } from "@/components/ui/progress";
import { useFirstVisitAnimation } from '@/hooks/useFirstVisitAnimation';

const CONTENT_TYPE_ICONS = {
  worksheet: { icon: FileSpreadsheet, color: 'text-orange-500', bg: 'bg-orange-100' },
  activity: { icon: Gamepad2, color: 'text-purple-500', bg: 'bg-purple-100' },
  book: { icon: BookOpen, color: 'text-green-500', bg: 'bg-green-100' },
  workbook: { icon: Book, color: 'text-blue-500', bg: 'bg-blue-100' },
  video: { icon: Video, color: 'text-red-500', bg: 'bg-red-100' },
};

export default function LearnPage({ user }) {
  const navigate = useNavigate();
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const showAnimations = useFirstVisitAnimation('learn');
  
  useEffect(() => {
    fetchTopics();
  }, []);
  
  const fetchTopics = async () => {
    try {
      const res = await axios.get(`${API}/content/topics`);
      setTopics(res.data);
    } catch (error) {
      console.error('Failed to fetch topics:', error);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#E0FBFC] flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-[#1D3557] border-t-[#FFD23F] rounded-full animate-spin"></div>
      </div>
    );
  }
  
  // Calculate total content count
  const totalContent = topics.reduce((acc, topic) => {
    const topicContent = topic.content_count || 0;
    const subtopicContent = topic.subtopics?.reduce((sum, st) => sum + (st.content_count || 0), 0) || 0;
    return acc + topicContent + subtopicContent;
  }, 0);
  
  return (
    <div className="min-h-screen bg-[#E0FBFC]" data-testid="learn-page">
      {/* Header */}
      <header className="bg-white border-b-4 border-[#1D3557]">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="p-2 rounded-xl border-3 border-[#1D3557] bg-white hover:bg-[#FFD23F]/20 transition-colors">
              <ChevronLeft className="w-6 h-6 text-[#1D3557]" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-[#FFD23F] rounded-xl border-3 border-[#1D3557] shadow-[3px_3px_0px_0px_#1D3557] flex items-center justify-center">
                <BookOpen className="w-7 h-7 text-[#1D3557]" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>Learn</h1>
                <p className="text-base text-[#3D5A80]">Explore fun money lessons!</p>
              </div>
            </div>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6">
        {/* Welcome Banner */}
        <div className={`rounded-2xl border-3 border-[#1D3557] shadow-[4px_4px_0px_0px_#1D3557] p-6 mb-6 bg-[#3D5A80] ${showAnimations ? 'animate-bounce-in' : ''}`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2 text-white" style={{ fontFamily: 'Fredoka' }}>
                📚 Your Learning Adventure
              </h2>
              <p className="text-white text-lg opacity-90">Learn about money and earn ₹!</p>
            </div>
            <div className="text-right">
              <p className="text-4xl font-bold text-white" style={{ fontFamily: 'Fredoka' }}>{topics.length}</p>
              <p className="text-white opacity-80">Topics to explore</p>
            </div>
          </div>
        </div>
        
        {/* Explanation Banner */}
        <div className="card-playful p-5 mb-6 bg-gradient-to-r from-[#FFD23F] to-[#FFEB99] border-3 border-[#1D3557]">
          <h2 className="text-xl font-bold text-[#1D3557] mb-2" style={{ fontFamily: 'Fredoka' }}>
            📖 How Does Learning Work?
          </h2>
          <p className="text-[#1D3557]/90 text-base leading-relaxed">
            Click on any <strong>topic</strong> below to start learning! Each topic has fun <strong>lessons, activities, and games</strong> that teach you about money. 
            When you finish an activity, you&apos;ll earn ₹ to add to your wallet. The more you learn, the smarter you get with money!
          </p>
        </div>
        
        {/* Topics List */}
        {topics.length === 0 ? (
          <p className="text-center text-[#3D5A80] py-4 text-lg">Exciting learning content is coming soon!</p>
        ) : (
          <div className="grid gap-5">
            {topics.map((topic, index) => (
              <div 
                key={topic.topic_id} 
                className={`card-playful overflow-hidden ${showAnimations ? 'animate-bounce-in' : ''}`}
                style={showAnimations ? { animationDelay: `${index * 0.08}s` } : {}}
              >
                {/* Topic Header */}
                <Link 
                  to={`/learn/topic/${topic.topic_id}`}
                  className="flex items-center gap-5 p-5 hover:bg-[#FFD23F]/10 transition-colors"
                >
                  {topic.thumbnail ? (
                    <img 
                      src={getAssetUrl(topic.thumbnail)} 
                      alt={topic.title} 
                      className="w-20 h-20 rounded-2xl border-3 border-[#1D3557] object-contain bg-white flex-shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl border-3 border-[#1D3557] bg-[#FFD23F] flex items-center justify-center flex-shrink-0">
                      <FolderOpen className="w-10 h-10 text-[#1D3557]" />
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold text-[#1D3557] mb-1" style={{ fontFamily: 'Fredoka' }}>
                      {topic.title}
                    </h3>
                    <p className="text-[#3D5A80] mb-2 line-clamp-2">{topic.description}</p>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="px-3 py-1 bg-[#3D5A80]/10 rounded-full text-[#3D5A80] font-medium">
                        {topic.subtopics?.length || 0} Subtopics
                      </span>
                      <span className="px-3 py-1 bg-[#06D6A0]/20 rounded-full text-[#06D6A0] font-medium">
                        {(topic.content_count || 0) + (topic.subtopics?.reduce((sum, st) => sum + (st.content_count || 0), 0) || 0)} Items
                      </span>
                    </div>
                  </div>
                  
                  <ChevronRight className="w-8 h-8 text-[#3D5A80]" />
                </Link>
                
                {/* Subtopics Preview */}
                {topic.subtopics?.length > 0 && (
                  <div className="border-t-3 border-[#1D3557]/20 px-5 py-4 bg-[#F8F9FA]">
                    <p className="text-sm font-medium text-[#3D5A80] mb-3">Quick access:</p>
                    <div className="flex flex-wrap gap-2">
                      {topic.subtopics.slice(0, 4).map((subtopic) => (
                        <Link
                          key={subtopic.topic_id}
                          to={`/learn/topic/${subtopic.topic_id}`}
                          className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border-2 border-[#1D3557]/30 hover:border-[#FFD23F] hover:bg-[#FFD23F]/10 transition-all"
                        >
                          {subtopic.thumbnail ? (
                            <img src={getAssetUrl(subtopic.thumbnail)} alt="" className="w-6 h-6 rounded object-contain bg-gray-100" />
                          ) : (
                            <FolderOpen className="w-5 h-5 text-[#3D5A80]" />
                          )}
                          <span className="text-sm font-medium text-[#1D3557]">{subtopic.title}</span>
                          {subtopic.content_count > 0 && (
                            <span className="text-xs px-2 py-0.5 bg-[#06D6A0]/20 rounded-full text-[#06D6A0]">
                              {subtopic.content_count}
                            </span>
                          )}
                        </Link>
                      ))}
                      {topic.subtopics.length > 4 && (
                        <span className="px-4 py-2 text-sm text-[#3D5A80] font-medium">
                          +{topic.subtopics.length - 4} more
                        </span>
                      )}
                    </div>
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
