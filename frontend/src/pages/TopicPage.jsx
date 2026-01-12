import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { 
  ChevronLeft, ChevronRight, Check, Play, Clock, 
  BookOpen, Award, Star
} from 'lucide-react';
import { Progress } from "@/components/ui/progress";

export default function TopicPage({ user }) {
  const { topicId } = useParams();
  const navigate = useNavigate();
  const [topic, setTopic] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const lessonTypeIcons = {
    story: '📖',
    video: '🎬',
    interactive: '🎮',
    quiz: '❓',
    activity: '🎯'
  };
  
  useEffect(() => {
    fetchTopicData();
  }, [topicId]);
  
  const fetchTopicData = async () => {
    try {
      const response = await axios.get(`${API}/learn/topics/${topicId}`);
      setTopic(response.data.topic);
      setLessons(response.data.lessons);
    } catch (error) {
      toast.error('Failed to load topic');
      navigate('/learn');
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
  
  const completedCount = lessons.filter(l => l.completed).length;
  const topicProgress = lessons.length > 0 ? (completedCount / lessons.length) * 100 : 0;
  
  return (
    <div className="min-h-screen bg-[#E0FBFC]" data-testid="topic-page">
      {/* Header */}
      <header className="bg-white border-b-3 border-[#1D3557]">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/learn" className="p-2 rounded-xl border-2 border-[#1D3557] hover:bg-[#E0FBFC]">
              <ChevronLeft className="w-5 h-5 text-[#1D3557]" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#FFD23F] rounded-xl border-3 border-[#1D3557] flex items-center justify-center text-xl">
                {topic?.icon || '📚'}
              </div>
              <h1 className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>{topic?.title}</h1>
            </div>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6 max-w-3xl">
        {/* Topic Overview */}
        <div className="card-playful p-6 mb-6 animate-bounce-in">
          <p className="text-[#3D5A80] mb-4">{topic?.description}</p>
          
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1">
              <div className="flex justify-between text-sm text-[#3D5A80] mb-1">
                <span>Progress</span>
                <span>{completedCount}/{lessons.length} lessons</span>
              </div>
              <Progress value={topicProgress} className="h-3" />
            </div>
          </div>
          
          {topicProgress === 100 && (
            <div className="bg-[#06D6A0]/20 rounded-xl p-4 flex items-center gap-3 border-2 border-[#06D6A0]">
              <Award className="w-8 h-8 text-[#06D6A0]" />
              <div>
                <p className="font-bold text-[#1D3557]">Topic Complete!</p>
                <p className="text-sm text-[#3D5A80]">You've mastered this topic. Great job!</p>
              </div>
            </div>
          )}
        </div>
        
        {/* Lessons List */}
        <h2 className="text-xl font-bold text-[#1D3557] mb-4" style={{ fontFamily: 'Fredoka' }}>
          Lessons
        </h2>
        
        <div className="space-y-3">
          {lessons.map((lesson, index) => (
            <Link
              key={lesson.lesson_id}
              to={`/learn/lesson/${lesson.lesson_id}`}
              className={`card-playful p-4 flex items-center gap-4 hover:scale-[1.01] transition-transform animate-bounce-in ${
                lesson.completed ? 'bg-[#06D6A0]/10' : ''
              }`}
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className={`w-12 h-12 rounded-xl border-3 border-[#1D3557] flex items-center justify-center text-xl ${
                lesson.completed ? 'bg-[#06D6A0]' : 'bg-[#FFD23F]'
              }`}>
                {lesson.completed ? <Check className="w-6 h-6 text-white" /> : lessonTypeIcons[lesson.lesson_type] || '📖'}
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-[#1D3557]">{lesson.title}</h3>
                <div className="flex items-center gap-3 text-sm text-[#3D5A80]">
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" /> {lesson.duration_minutes} min
                  </span>
                  <span className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-[#FFD23F]" /> +{lesson.reward_coins}
                  </span>
                  <span className="capitalize px-2 py-0.5 bg-[#3D5A80]/10 rounded-full text-xs">
                    {lesson.lesson_type}
                  </span>
                </div>
              </div>
              
              <ChevronRight className="w-5 h-5 text-[#3D5A80]" />
            </Link>
          ))}
        </div>
        
        {lessons.length === 0 && (
          <div className="card-playful p-8 text-center">
            <BookOpen className="w-16 h-16 mx-auto text-[#98C1D9] mb-4" />
            <h3 className="text-xl font-bold text-[#1D3557] mb-2">No Lessons Yet</h3>
            <p className="text-[#3D5A80]">Lessons for this topic are being created!</p>
          </div>
        )}
      </main>
    </div>
  );
}
