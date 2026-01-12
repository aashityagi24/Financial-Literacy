import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { 
  BookOpen, ChevronLeft, ChevronRight, GraduationCap, 
  Trophy, Clock, Check, Lock, Sparkles, Play
} from 'lucide-react';
import { Progress } from "@/components/ui/progress";

export default function LearnPage({ user }) {
  const navigate = useNavigate();
  const [topics, setTopics] = useState([]);
  const [books, setBooks] = useState([]);
  const [activities, setActivities] = useState([]);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('topics');
  
  const categoryIcons = {
    history: '🏛️',
    concepts: '💡',
    skills: '🎯',
    activities: '🎮'
  };
  
  const categoryColors = {
    history: '#9B5DE5',
    concepts: '#FFD23F',
    skills: '#06D6A0',
    activities: '#EE6C4D'
  };
  
  useEffect(() => {
    fetchData();
  }, []);
  
  const fetchData = async () => {
    try {
      const [topicsRes, booksRes, activitiesRes, progressRes] = await Promise.all([
        axios.get(`${API}/learn/topics`),
        axios.get(`${API}/learn/books`),
        axios.get(`${API}/learn/activities`),
        axios.get(`${API}/learn/progress`)
      ]);
      
      setTopics(topicsRes.data);
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
        <div className="card-playful p-6 mb-6 bg-gradient-to-r from-[#3D5A80] to-[#5A7BA0] text-white animate-bounce-in">
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
        
        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { id: 'topics', label: 'Topics', icon: '📖' },
            { id: 'books', label: 'Books', icon: '📚' },
            { id: 'activities', label: 'Activities', icon: '🎯' }
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
        
        {/* Topics Tab */}
        {activeTab === 'topics' && (
          <div className="grid gap-4">
            {topics.map((topic, index) => {
              const topicProgress = topic.total_lessons > 0 
                ? (topic.completed_lessons / topic.total_lessons) * 100 
                : 0;
              
              return (
                <Link
                  key={topic.topic_id}
                  to={`/learn/topic/${topic.topic_id}`}
                  className="card-playful p-5 hover:scale-[1.01] transition-transform animate-bounce-in"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-16 h-16 rounded-2xl border-3 border-[#1D3557] flex items-center justify-center text-3xl flex-shrink-0"
                      style={{ backgroundColor: categoryColors[topic.category] + '40' }}
                    >
                      {topic.icon}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-[#1D3557] text-lg">{topic.title}</h3>
                        <span 
                          className="text-xs px-2 py-1 rounded-full capitalize"
                          style={{ backgroundColor: categoryColors[topic.category], color: '#1D3557' }}
                        >
                          {topic.category}
                        </span>
                      </div>
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
            
            {topics.length === 0 && (
              <div className="card-playful p-8 text-center">
                <BookOpen className="w-16 h-16 mx-auto text-[#98C1D9] mb-4" />
                <h3 className="text-xl font-bold text-[#1D3557] mb-2">No Topics Yet</h3>
                <p className="text-[#3D5A80]">Learning content is being prepared for you!</p>
              </div>
            )}
          </div>
        )}
        
        {/* Books Tab */}
        {activeTab === 'books' && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {books.map((book, index) => (
              <div
                key={book.book_id}
                className="card-playful p-4 animate-bounce-in"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="w-full aspect-[3/4] bg-gradient-to-br from-[#3D5A80] to-[#5A7BA0] rounded-xl border-3 border-[#1D3557] flex items-center justify-center text-5xl mb-3">
                  {book.cover_url || '📖'}
                </div>
                
                <h3 className="font-bold text-[#1D3557] text-sm mb-1 line-clamp-2" style={{ fontFamily: 'Fredoka' }}>
                  {book.title}
                </h3>
                <p className="text-xs text-[#3D5A80] mb-2">by {book.author}</p>
                
                <span 
                  className="text-xs px-2 py-1 rounded-full capitalize bg-[#FFD23F]/30 text-[#1D3557]"
                >
                  {book.category}
                </span>
              </div>
            ))}
            
            {books.length === 0 && (
              <div className="col-span-full card-playful p-8 text-center">
                <span className="text-6xl block mb-4">📚</span>
                <h3 className="text-xl font-bold text-[#1D3557] mb-2">No Books Yet</h3>
                <p className="text-[#3D5A80]">Books are being added to the library!</p>
              </div>
            )}
          </div>
        )}
        
        {/* Activities Tab */}
        {activeTab === 'activities' && (
          <div className="grid gap-4">
            {activities.map((activity, index) => (
              <div
                key={activity.activity_id}
                className={`card-playful p-5 animate-bounce-in ${activity.completed ? 'opacity-70' : ''}`}
                style={{ animationDelay: `${index * 0.05}s` }}
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
            
            {activities.length === 0 && (
              <div className="card-playful p-8 text-center">
                <span className="text-6xl block mb-4">🎯</span>
                <h3 className="text-xl font-bold text-[#1D3557] mb-2">No Activities Yet</h3>
                <p className="text-[#3D5A80]">Fun activities are being prepared!</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
