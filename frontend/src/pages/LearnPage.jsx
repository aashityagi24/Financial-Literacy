import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { 
  BookOpen, ChevronLeft, ChevronRight, GraduationCap, 
  Trophy, Clock, Check, Lock, Sparkles, Play, FolderOpen,
  FileText, FileSpreadsheet, Gamepad2
} from 'lucide-react';
import { Progress } from "@/components/ui/progress";
import { useFirstVisitAnimation } from '@/hooks/useFirstVisitAnimation';

const CONTENT_TYPE_ICONS = {
  lesson: { icon: FileText, color: 'text-blue-500', bg: 'bg-blue-100' },
  book: { icon: BookOpen, color: 'text-green-500', bg: 'bg-green-100' },
  worksheet: { icon: FileSpreadsheet, color: 'text-orange-500', bg: 'bg-orange-100' },
  activity: { icon: Gamepad2, color: 'text-purple-500', bg: 'bg-purple-100' },
};

export default function LearnPage({ user }) {
  const navigate = useNavigate();
  const [topics, setTopics] = useState([]);
  const [legacyTopics, setLegacyTopics] = useState([]);
  const [books, setBooks] = useState([]);
  const [activities, setActivities] = useState([]);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('topics');
  const showAnimations = useFirstVisitAnimation('learn');
  
  useEffect(() => {
    fetchData();
  }, []);
  
  const fetchData = async () => {
    try {
      const [newTopicsRes, legacyTopicsRes, booksRes, activitiesRes, progressRes] = await Promise.all([
        axios.get(`${API}/content/topics`).catch(() => ({ data: [] })),
        axios.get(`${API}/learn/topics`).catch(() => ({ data: [] })),
        axios.get(`${API}/learn/books`).catch(() => ({ data: [] })),
        axios.get(`${API}/learn/activities`).catch(() => ({ data: [] })),
        axios.get(`${API}/learn/progress`).catch(() => ({ data: { lessons: { total: 0, completed: 0 } } }))
      ]);
      
      setTopics(newTopicsRes.data);
      setLegacyTopics(legacyTopicsRes.data);
      setBooks(booksRes.data);
      setActivities(activitiesRes.data);
      setProgress(progressRes.data);
    } catch (error) {
      console.error('Failed to fetch learning data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleCompleteActivity = async (activityId) => {
    try {
      const response = await axios.post(`${API}/learn/activities/${activityId}/complete`);
      toast.success(`Activity completed! +${response.data.reward} coins`);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to complete activity');
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#E0FBFC] flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-[#1D3557] border-t-[#FFD23F] rounded-full animate-spin"></div>
      </div>
    );
  }
  
  const totalLessons = progress?.lessons?.total || 0;
  const completedLessons = progress?.lessons?.completed || 0;
  const overallProgress = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;
  
  // Combine new topics with legacy topics for display
  const hasNewContent = topics.length > 0;
  const hasLegacyContent = legacyTopics.length > 0 || books.length > 0 || activities.length > 0;
  
  return (
    <div className="min-h-screen bg-[#E0FBFC]" data-testid="learn-page">
      {/* Header */}
      <header className="bg-white border-b-3 border-[#1D3557]">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="p-2 rounded-xl border-2 border-[#1D3557] hover:bg-[#E0FBFC]">
              <ChevronLeft className="w-5 h-5 text-[#1D3557]" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#FFD23F] rounded-xl border-3 border-[#1D3557] flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-[#1D3557]" />
              </div>
              <h1 className="text-2xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>Learn</h1>
            </div>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6">
        {/* Progress Banner */}
        <div className={`card-playful p-6 mb-6 bg-gradient-to-r from-[#3D5A80] to-[#5A7BA0] text-white ${showAnimations ? 'animate-bounce-in' : ''}`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold mb-1" style={{ fontFamily: 'Fredoka' }}>
                📚 Your Learning Journey
              </h2>
              <p className="opacity-90">Keep learning to earn coins and badges!</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold" style={{ fontFamily: 'Fredoka' }}>{completedLessons}/{totalLessons}</p>
              <p className="text-sm opacity-80">lessons completed</p>
            </div>
          </div>
          <Progress value={overallProgress} className="h-3 bg-white/30" />
        </div>
        
        {/* New Hierarchical Topics */}
        {hasNewContent && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-[#1D3557] mb-4" style={{ fontFamily: 'Fredoka' }}>
              📖 Topics
            </h2>
            <div className="grid gap-4">
              {topics.map((topic, index) => (
                <div 
                  key={topic.topic_id} 
                  className={`card-playful overflow-hidden ${showAnimations ? 'animate-bounce-in' : ''}`}
                  style={showAnimations ? { animationDelay: `${index * 0.05}s` } : {}}
                >
                  {/* Topic Header */}
                  <Link 
                    to={`/learn/topic/${topic.topic_id}`}
                    className="flex items-center gap-4 p-5 hover:bg-[#F8F9FA] transition-colors"
                  >
                    {topic.thumbnail ? (
                      <img 
                        src={topic.thumbnail} 
                        alt={topic.title} 
                        className="w-16 h-16 rounded-xl border-3 border-[#1D3557] object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-xl border-3 border-[#1D3557] bg-[#FFD23F]/30 flex items-center justify-center flex-shrink-0">
                        <FolderOpen className="w-8 h-8 text-[#1D3557]" />
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-[#1D3557] text-lg" style={{ fontFamily: 'Fredoka' }}>
                        {topic.title}
                      </h3>
                      <p className="text-sm text-[#3D5A80] line-clamp-1">{topic.description}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-[#3D5A80]">
                        <span>{topic.subtopics?.length || 0} subtopics</span>
                        <span>{topic.content_count || 0} items</span>
                      </div>
                    </div>
                    
                    <ChevronRight className="w-6 h-6 text-[#3D5A80]" />
                  </Link>
                  
                  {/* Subtopics Preview */}
                  {topic.subtopics?.length > 0 && (
                    <div className="border-t border-gray-100 px-5 py-3 bg-[#F8F9FA]">
                      <div className="flex flex-wrap gap-2">
                        {topic.subtopics.slice(0, 4).map((subtopic) => (
                          <Link
                            key={subtopic.topic_id}
                            to={`/learn/topic/${subtopic.topic_id}`}
                            className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-gray-200 text-sm hover:border-[#FFD23F] transition-colors"
                          >
                            {subtopic.thumbnail ? (
                              <img src={subtopic.thumbnail} alt="" className="w-5 h-5 rounded object-cover" />
                            ) : (
                              <FolderOpen className="w-4 h-4 text-blue-400" />
                            )}
                            <span className="text-[#3D5A80]">{subtopic.title}</span>
                          </Link>
                        ))}
                        {topic.subtopics.length > 4 && (
                          <span className="px-3 py-1.5 text-sm text-[#3D5A80]">
                            +{topic.subtopics.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Legacy Content Tabs */}
        {hasLegacyContent && (
          <>
            {hasNewContent && (
              <div className="border-t border-gray-200 my-6 pt-6">
                <h2 className="text-lg font-bold text-[#3D5A80] mb-4">More Learning Resources</h2>
              </div>
            )}
            
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              {[
                ...(legacyTopics.length > 0 ? [{ id: 'legacy-topics', label: 'More Topics', icon: '📖' }] : []),
                ...(books.length > 0 ? [{ id: 'books', label: 'Books', icon: '📚' }] : []),
                ...(activities.length > 0 ? [{ id: 'activities', label: 'Activities', icon: '🎯' }] : [])
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-5 py-3 rounded-xl border-3 border-[#1D3557] font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                    activeTab === tab.id 
                      ? 'bg-[#FFD23F] text-[#1D3557] shadow-[3px_3px_0px_0px_#1D3557]' 
                      : 'bg-white text-[#3D5A80] hover:bg-[#E0FBFC]'
                  }`}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>
            
            {/* Legacy Topics Tab */}
            {activeTab === 'legacy-topics' && legacyTopics.length > 0 && (
              <div className="grid gap-4">
                {legacyTopics.map((topic, index) => {
                  const topicProgress = topic.total_lessons > 0 
                    ? (topic.completed_lessons / topic.total_lessons) * 100 
                    : 0;
                  
                  return (
                    <Link
                      key={topic.topic_id}
                      to={`/learn/topic/${topic.topic_id}`}
                      className={`card-playful p-5 hover:scale-[1.01] transition-transform ${showAnimations ? 'animate-bounce-in' : ''}`}
                      style={showAnimations ? { animationDelay: `${index * 0.05}s` } : {}}
                    >
                      <div className="flex items-center gap-4">
                        <div 
                          className="w-16 h-16 rounded-2xl border-3 border-[#1D3557] flex items-center justify-center text-3xl flex-shrink-0 bg-[#FFD23F]/30"
                        >
                          {topic.icon}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-[#1D3557] text-lg">{topic.title}</h3>
                          <p className="text-sm text-[#3D5A80] mb-2">{topic.description}</p>
                          
                          <div className="flex items-center gap-4">
                            <div className="flex-1">
                              <Progress value={topicProgress} className="h-2" />
                            </div>
                            <span className="text-sm font-bold text-[#3D5A80]">
                              {topic.completed_lessons}/{topic.total_lessons}
                            </span>
                          </div>
                        </div>
                        
                        <ChevronRight className="w-6 h-6 text-[#3D5A80]" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
            
            {/* Books Tab */}
            {activeTab === 'books' && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {books.map((book, index) => (
                  <div
                    key={book.book_id}
                    className={`card-playful p-4 ${showAnimations ? 'animate-bounce-in' : ''}`}
                    style={showAnimations ? { animationDelay: `${index * 0.05}s` } : {}}
                  >
                    <div className="w-full aspect-[3/4] bg-gradient-to-br from-[#3D5A80] to-[#5A7BA0] rounded-xl border-3 border-[#1D3557] flex items-center justify-center text-5xl mb-3">
                      {book.cover_url || '📖'}
                    </div>
                    
                    <h3 className="font-bold text-[#1D3557] text-sm mb-1 line-clamp-2" style={{ fontFamily: 'Fredoka' }}>
                      {book.title}
                    </h3>
                    <p className="text-xs text-[#3D5A80] mb-2">by {book.author}</p>
                    
                    <span className="text-xs px-2 py-1 rounded-full capitalize bg-[#FFD23F]/30 text-[#1D3557]">
                      {book.category}
                    </span>
                  </div>
                ))}
              </div>
            )}
            
            {/* Activities Tab */}
            {activeTab === 'activities' && (
              <div className="grid gap-4">
                {activities.map((activity, index) => (
                  <div
                    key={activity.activity_id}
                    className={`card-playful p-5 ${activity.completed ? 'opacity-70' : ''} ${showAnimations ? 'animate-bounce-in' : ''}`}
                    style={showAnimations ? { animationDelay: `${index * 0.05}s` } : {}}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-14 h-14 rounded-xl border-3 border-[#1D3557] flex items-center justify-center text-2xl flex-shrink-0 ${
                        activity.completed ? 'bg-[#06D6A0]' : 'bg-[#FFD23F]'
                      }`}>
                        {activity.completed ? <Check className="w-7 h-7 text-white" /> : '🎯'}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-[#1D3557]">{activity.title}</h3>
                          <span className="text-xs px-2 py-1 rounded-full bg-[#3D5A80]/10 text-[#3D5A80] capitalize">
                            {activity.activity_type.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-sm text-[#3D5A80] mb-3">{activity.description}</p>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-[#06D6A0] font-bold">+{activity.reward_coins} coins</span>
                          
                          {activity.completed ? (
                            <span className="text-[#06D6A0] font-bold flex items-center gap-1 text-sm">
                              <Check className="w-4 h-4" /> Completed
                            </span>
                          ) : (
                            <button
                              onClick={() => handleCompleteActivity(activity.activity_id)}
                              className="btn-primary px-4 py-2 text-sm"
                            >
                              Mark Complete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        
        {/* Empty State */}
        {!hasNewContent && !hasLegacyContent && (
          <div className="card-playful p-8 text-center">
            <BookOpen className="w-16 h-16 mx-auto text-[#98C1D9] mb-4" />
            <h3 className="text-xl font-bold text-[#1D3557] mb-2">No Content Yet</h3>
            <p className="text-[#3D5A80]">Learning content is being prepared for you!</p>
          </div>
        )}
      </main>
    </div>
  );
}
