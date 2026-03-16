import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import { Trophy, Users, TrendingUp, Clock } from 'lucide-react';

export default function ActivityScoresBadge({ contentId, user }) {
  const [scores, setScores] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!contentId || !user || !['parent', 'teacher'].includes(user.role)) {
      setLoading(false);
      return;
    }
    fetchScores();
  }, [contentId, user]);

  const fetchScores = async () => {
    try {
      const response = await axios.get(`${API}/activity/scores/by-content/${contentId}`);
      setScores(response.data.children);
    } catch (error) {
      console.error('Failed to fetch scores:', error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (percentage) => {
    if (percentage >= 80) return 'bg-[#06D6A0]';
    if (percentage >= 60) return 'bg-[#FFD23F]';
    return 'bg-[#EE6C4D]';
  };

  if (loading || !scores || scores.length === 0) {
    return null;
  }

  const attemptedChildren = scores.filter(c => c.attempted);
  
  if (attemptedChildren.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-200">
      <div className="flex items-center gap-2 mb-2">
        <Trophy className="w-4 h-4 text-[#FFD23F]" />
        <span className="text-xs font-bold text-[#3D5A80]">Activity Scores</span>
      </div>
      
      <div className="space-y-2">
        {attemptedChildren.map((child) => (
          <div 
            key={child.child_id}
            className="flex items-center gap-2 p-2 bg-[#F8F9FA] rounded-lg"
          >
            <span className="text-sm font-medium text-[#1D3557] flex-1 truncate">
              {child.child_name}
            </span>
            
            {/* Score badges - last 2 attempts */}
            <div className="flex gap-1">
              {child.scores?.slice(0, 2).map((score, i) => (
                <div 
                  key={i}
                  className={`w-8 h-6 rounded flex items-center justify-center text-xs font-bold text-white ${getScoreColor(score.percentage)}`}
                  title={`Attempt ${i + 1}: ${score.percentage}%`}
                >
                  {score.percentage}%
                </div>
              ))}
            </div>
            
            {/* Best score indicator */}
            {child.best_score && (
              <div className="flex items-center gap-1 text-xs text-[#06D6A0]">
                <TrendingUp className="w-3 h-3" />
                <span className="font-bold">{child.best_score}%</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
