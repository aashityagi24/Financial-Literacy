import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { Trophy, ChevronLeft, Lock, Check, Star } from 'lucide-react';
import { Progress } from "@/components/ui/progress";

export default function AchievementsPage({ user }) {
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  
  useEffect(() => {
    fetchAchievements();
  }, []);
  
  const fetchAchievements = async () => {
    try {
      const response = await axios.get(`${API}/achievements`);
      setAchievements(response.data);
    } catch (error) {
      toast.error('Failed to load achievements');
    } finally {
      setLoading(false);
    }
  };
  
  const handleClaim = async (achievementId) => {
    try {
      const response = await axios.post(`${API}/achievements/${achievementId}/claim`);
      toast.success(`Badge claimed! Earned ${response.data.points_earned} points!`);
      fetchAchievements();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to claim badge');
    }
  };
  
  const categoryColors = {
    savings: '#06D6A0',
    investing: '#3D5A80',
    learning: '#FFD23F',
    streak: '#EE6C4D',
    giving: '#9B5DE5'
  };
  
  const earnedCount = achievements.filter(a => a.earned).length;
  const totalCount = achievements.length;
  
  const filteredAchievements = filter === 'all' 
    ? achievements 
    : achievements.filter(a => a.category === filter);
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#E0FBFC] flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-[#1D3557] border-t-[#FFD23F] rounded-full animate-spin"></div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-[#E0FBFC]" data-testid="achievements-page">
      {/* Header */}
      <header className="bg-white border-b-3 border-[#1D3557]">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="p-2 rounded-xl border-2 border-[#1D3557] hover:bg-[#E0FBFC]">
              <ChevronLeft className="w-5 h-5 text-[#1D3557]" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#9B5DE5] rounded-xl border-3 border-[#1D3557] flex items-center justify-center">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>Achievements</h1>
            </div>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6">
        {/* Progress Banner */}
        <div className="card-playful p-6 mb-6 bg-gradient-to-r from-[#9B5DE5] to-[#B47EE5] text-white animate-bounce-in">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold mb-1" style={{ fontFamily: 'Fredoka' }}>
                🏆 Badge Collection
              </h2>
              <p className="opacity-90">Earn badges by completing financial goals!</p>
            </div>
            <div className="text-right">
              <p className="text-4xl font-bold" style={{ fontFamily: 'Fredoka' }}>{earnedCount}/{totalCount}</p>
              <p className="text-sm opacity-80">badges earned</p>
            </div>
          </div>
          <Progress value={(earnedCount / totalCount) * 100} className="h-3 bg-white/30" />
        </div>
        
        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {['all', 'savings', 'investing', 'learning', 'streak', 'giving'].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-4 py-2 rounded-xl border-2 border-[#1D3557] font-bold capitalize whitespace-nowrap transition-colors ${
                filter === cat 
                  ? 'bg-[#FFD23F] text-[#1D3557]' 
                  : 'bg-white text-[#3D5A80] hover:bg-[#E0FBFC]'
              }`}
            >
              {cat === 'all' ? 'All Badges' : cat}
            </button>
          ))}
        </div>
        
        {/* Achievements Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredAchievements.map((achievement, index) => (
            <div 
              key={achievement.achievement_id}
              className={`card-playful p-5 text-center animate-bounce-in ${!achievement.earned ? 'opacity-70' : ''}`}
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div 
                className={`w-20 h-20 mx-auto rounded-2xl border-3 border-[#1D3557] flex items-center justify-center text-4xl mb-3 relative ${
                  achievement.earned ? 'badge-earned' : 'badge-locked'
                }`}
                style={{ backgroundColor: achievement.earned ? categoryColors[achievement.category] : '#98C1D9' }}
              >
                {achievement.earned ? (
                  achievement.icon
                ) : (
                  <Lock className="w-10 h-10 text-[#3D5A80]" />
                )}
                {achievement.earned && (
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-[#06D6A0] rounded-full border-2 border-[#1D3557] flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
              
              <h3 className="font-bold text-[#1D3557] mb-1" style={{ fontFamily: 'Fredoka' }}>{achievement.name}</h3>
              <p className="text-sm text-[#3D5A80] mb-2 line-clamp-2">{achievement.description}</p>
              
              <div className="flex items-center justify-center gap-1 mb-2">
                <Star className="w-4 h-4 text-[#FFD23F]" />
                <span className="text-sm font-bold text-[#1D3557]">{achievement.points} pts</span>
              </div>
              
              <span 
                className="text-xs px-2 py-1 rounded-full capitalize inline-block"
                style={{ 
                  backgroundColor: categoryColors[achievement.category] + '30',
                  color: categoryColors[achievement.category]
                }}
              >
                {achievement.category}
              </span>
            </div>
          ))}
        </div>
        
        {filteredAchievements.length === 0 && (
          <div className="card-playful p-8 text-center">
            <Trophy className="w-16 h-16 mx-auto text-[#98C1D9] mb-4" />
            <h3 className="text-xl font-bold text-[#1D3557] mb-2">No Badges Yet</h3>
            <p className="text-[#3D5A80]">Complete quests and activities to earn badges!</p>
          </div>
        )}
        
        {/* Tips */}
        <div className="card-playful p-6 mt-6 bg-[#FFD23F]/20 animate-bounce-in stagger-3">
          <h3 className="font-bold text-[#1D3557] mb-2" style={{ fontFamily: 'Fredoka' }}>
            💡 How to Earn Badges
          </h3>
          <ul className="text-[#3D5A80] space-y-1 text-base">
            <li>• <strong>Savings badges:</strong> Save ₹ in your savings account</li>
            <li>• <strong>Investing badges:</strong> Grow your investments</li>
            <li>• <strong>Learning badges:</strong> Complete educational quests</li>
            <li>• <strong>Streak badges:</strong> Log in every day</li>
            <li>• <strong>Giving badges:</strong> Donate to your giving jar</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
