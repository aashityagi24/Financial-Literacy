import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { Target, ChevronLeft, Check, Clock, Star, Sparkles } from 'lucide-react';
import { Progress } from "@/components/ui/progress";

export default function QuestsPage({ user }) {
  const [quests, setQuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  
  useEffect(() => {
    fetchQuests();
  }, []);
  
  const fetchQuests = async () => {
    try {
      const response = await axios.get(`${API}/quests`);
      setQuests(response.data);
    } catch (error) {
      toast.error('Failed to load quests');
    } finally {
      setLoading(false);
    }
  };
  
  const handleAcceptQuest = async (questId) => {
    try {
      await axios.post(`${API}/quests/${questId}/accept`);
      toast.success('Quest accepted!');
      fetchQuests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to accept quest');
    }
  };
  
  const handleCompleteQuest = async (questId) => {
    try {
      const response = await axios.post(`${API}/quests/${questId}/complete`);
      toast.success(`Quest completed! Earned ₹${response.data.reward}!`);
      fetchQuests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to complete quest');
    }
  };
  
  const questTypeColors = {
    daily: { bg: 'bg-[#FFD23F]', text: 'text-[#1D3557]' },
    weekly: { bg: 'bg-[#3D5A80]', text: 'text-white' },
    challenge: { bg: 'bg-[#EE6C4D]', text: 'text-white' },
  };
  
  const filteredQuests = filter === 'all' 
    ? quests 
    : quests.filter(q => q.quest_type === filter);
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#E0FBFC] flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-[#1D3557] border-t-[#FFD23F] rounded-full animate-spin"></div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-[#E0FBFC]" data-testid="quests-page">
      {/* Header */}
      <header className="bg-white border-b-3 border-[#1D3557]">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="p-2 rounded-xl border-2 border-[#1D3557] hover:bg-[#E0FBFC]">
              <ChevronLeft className="w-5 h-5 text-[#1D3557]" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#3D5A80] rounded-xl border-3 border-[#1D3557] flex items-center justify-center">
                <Target className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>Quest Board</h1>
            </div>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6">
        {/* Banner */}
        <div className="card-playful p-6 mb-6 bg-gradient-to-r from-[#3D5A80] to-[#5A7BA0] text-white animate-bounce-in">
          <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Fredoka' }}>
            🎯 Complete Quests, Earn ₹!
          </h2>
          <p className="opacity-90">
            Each quest teaches you something new about money while rewarding you with ₹!
          </p>
        </div>
        
        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {['all', 'daily', 'weekly', 'challenge'].map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-4 py-2 rounded-xl border-2 border-[#1D3557] font-bold capitalize whitespace-nowrap transition-colors ${
                filter === type 
                  ? 'bg-[#FFD23F] text-[#1D3557]' 
                  : 'bg-white text-[#3D5A80] hover:bg-[#E0FBFC]'
              }`}
            >
              {type === 'all' ? 'All Quests' : type}
            </button>
          ))}
        </div>
        
        {/* Quests Grid */}
        <div className="grid gap-4">
          {filteredQuests.length === 0 ? (
            <div className="card-playful p-8 text-center">
              <Target className="w-16 h-16 mx-auto text-[#98C1D9] mb-4" />
              <h3 className="text-xl font-bold text-[#1D3557] mb-2">No Quests Found</h3>
              <p className="text-[#3D5A80]">Check back later for new adventures!</p>
            </div>
          ) : (
            filteredQuests.map((quest, index) => {
              const colors = questTypeColors[quest.quest_type];
              
              return (
                <div 
                  key={quest.quest_id}
                  className="card-playful p-5 animate-bounce-in"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-14 h-14 ${colors.bg} rounded-xl border-3 border-[#1D3557] flex items-center justify-center flex-shrink-0`}>
                      {quest.completed ? (
                        <Check className={`w-7 h-7 ${colors.text}`} />
                      ) : quest.assigned ? (
                        <Clock className={`w-7 h-7 ${colors.text}`} />
                      ) : (
                        <Star className={`w-7 h-7 ${colors.text}`} />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-[#1D3557] text-lg">{quest.title}</h3>
                        <span className={`text-xs px-2 py-1 rounded-full ${colors.bg} ${colors.text} font-bold capitalize`}>
                          {quest.quest_type}
                        </span>
                      </div>
                      <p className="text-[#3D5A80] text-sm mb-3">{quest.description}</p>
                      
                      {quest.assigned && !quest.completed && (
                        <div className="mb-3">
                          <div className="flex justify-between text-xs text-[#3D5A80] mb-1">
                            <span>Progress</span>
                            <span>{quest.progress || 0}%</span>
                          </div>
                          <Progress value={quest.progress || 0} className="h-2" />
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between">
                        <span className="bg-[#06D6A0]/20 text-[#06D6A0] px-3 py-1 rounded-lg font-bold text-sm border border-[#06D6A0]">
                          +₹{quest.reward_amount} reward
                        </span>
                        
                        {quest.completed ? (
                          <span className="text-[#06D6A0] font-bold flex items-center gap-1">
                            <Check className="w-4 h-4" /> Completed
                          </span>
                        ) : quest.assigned ? (
                          <button
                            onClick={() => handleCompleteQuest(quest.quest_id)}
                            className="btn-primary px-4 py-2 text-sm"
                          >
                            Mark Complete
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAcceptQuest(quest.quest_id)}
                            className="btn-secondary px-4 py-2 text-sm flex items-center gap-1"
                          >
                            <Sparkles className="w-4 h-4" /> Accept Quest
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        
        {/* Tips */}
        <div className="card-playful p-6 mt-6 bg-[#FFD23F]/20 animate-bounce-in stagger-3">
          <h3 className="font-bold text-[#1D3557] mb-2" style={{ fontFamily: 'Fredoka' }}>
            💡 Quest Tips
          </h3>
          <ul className="text-[#3D5A80] space-y-1 text-sm">
            <li>• <strong>Daily quests</strong> reset each day - complete them for quick ₹!</li>
            <li>• <strong>Weekly quests</strong> give bigger rewards but take more time.</li>
            <li>• <strong>Challenges</strong> are special one-time quests with the best rewards!</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
