import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { 
  ChevronLeft, Trophy, Clock, Target, TrendingUp, 
  User, Gamepad2, Calendar, Award, BarChart3
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export default function ActivityScoresPage({ user }) {
  const navigate = useNavigate();
  const { childId } = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'summary'

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    
    // Children can only view their own scores
    if (user.role === 'child' && childId && childId !== user.user_id) {
      toast.error('You can only view your own scores');
      navigate('/dashboard');
      return;
    }
    
    fetchScores();
  }, [user, childId]);

  const fetchScores = async () => {
    try {
      let endpoint = childId 
        ? `${API}/activity/scores/child/${childId}`
        : `${API}/activity/scores/me`;
      
      const response = await axios.get(endpoint);
      setData(response.data);
    } catch (error) {
      toast.error('Failed to load activity scores');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    if (!seconds) return '0s';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getScoreColor = (percentage) => {
    if (percentage >= 80) return 'text-[#06D6A0]';
    if (percentage >= 60) return 'text-[#FFD23F]';
    return 'text-[#EE6C4D]';
  };

  const getScoreBg = (percentage) => {
    if (percentage >= 80) return 'bg-[#06D6A0]/10';
    if (percentage >= 60) return 'bg-[#FFD23F]/10';
    return 'bg-[#EE6C4D]/10';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#E0FBFC] flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-[#FFD23F] border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const scores = data?.scores || [];
  const child = data?.child || user;
  const avgScore = data?.average_score || (scores.length > 0 
    ? scores.reduce((sum, s) => sum + (s.percentage || 0), 0) / scores.length 
    : 0);

  return (
    <div className="min-h-screen bg-[#E0FBFC] p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className="border-2 border-[#1D3557]"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
              {childId ? `${child?.name || child?.username}'s ` : 'My '}Activity Scores
            </h1>
            <p className="text-[#3D5A80]">Track learning progress and achievements</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="card-playful bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#06D6A0]/20 flex items-center justify-center">
                <Gamepad2 className="w-5 h-5 text-[#06D6A0]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#1D3557]">{scores.length}</p>
                <p className="text-xs text-[#3D5A80]">Activities</p>
              </div>
            </div>
          </div>
          
          <div className="card-playful bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FFD23F]/20 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-[#FFD23F]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#1D3557]">{Math.round(avgScore)}%</p>
                <p className="text-xs text-[#3D5A80]">Avg Score</p>
              </div>
            </div>
          </div>
          
          <div className="card-playful bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#EE6C4D]/20 flex items-center justify-center">
                <Target className="w-5 h-5 text-[#EE6C4D]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#1D3557]">
                  {scores.filter(s => s.percentage >= 80).length}
                </p>
                <p className="text-xs text-[#3D5A80]">High Scores</p>
              </div>
            </div>
          </div>
          
          <div className="card-playful bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#3D5A80]/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-[#3D5A80]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#1D3557]">
                  {formatTime(scores.reduce((sum, s) => sum + (s.time_spent_seconds || 0), 0))}
                </p>
                <p className="text-xs text-[#3D5A80]">Total Time</p>
              </div>
            </div>
          </div>
        </div>

        {/* Score List */}
        {scores.length === 0 ? (
          <div className="card-playful bg-white p-12 text-center">
            <Gamepad2 className="w-16 h-16 mx-auto mb-4 text-[#3D5A80]/30" />
            <h3 className="text-xl font-bold text-[#1D3557] mb-2">No Activities Yet</h3>
            <p className="text-[#3D5A80]">
              Complete some activities to see your scores here!
            </p>
            <Button
              onClick={() => navigate('/learn')}
              className="mt-4 bg-[#06D6A0] hover:bg-[#05c090] text-white border-2 border-[#1D3557]"
            >
              Start Learning
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {scores.map((score, index) => (
              <div 
                key={score.score_id || index}
                className={`card-playful bg-white p-4 ${getScoreBg(score.percentage)}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center border-2 border-[#1D3557] ${getScoreBg(score.percentage)}`}>
                      <span className={`text-xl font-bold ${getScoreColor(score.percentage)}`}>
                        {Math.round(score.percentage)}%
                      </span>
                    </div>
                    <div>
                      <h3 className="font-bold text-[#1D3557]">{score.content_title}</h3>
                      <div className="flex items-center gap-3 text-sm text-[#3D5A80]">
                        {score.correct_answers > 0 && (
                          <span className="flex items-center gap-1">
                            <Target className="w-3 h-3" />
                            {score.correct_answers}/{score.total_questions}
                          </span>
                        )}
                        {score.time_spent_seconds > 0 && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTime(score.time_spent_seconds)}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(score.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {score.percentage >= 80 && (
                    <Award className="w-8 h-8 text-[#FFD23F]" />
                  )}
                </div>
                
                {/* Progress Bar */}
                <div className="mt-3">
                  <Progress 
                    value={score.percentage} 
                    className="h-2"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
