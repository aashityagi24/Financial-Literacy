import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import { Trophy, Star, RotateCw } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
    if (percentage >= 50) return 'bg-[#FFD23F]';
    return 'bg-[#EE6C4D]';
  };

  if (loading || !scores || scores.length === 0) return null;

  const attemptedChildren = scores.filter(c => c.attempted);
  if (attemptedChildren.length === 0) return null;

  const tooltipClass = "z-[100] rounded-xl bg-[#1D3557] text-white px-4 py-2 text-sm font-medium shadow-lg border-2 border-[#FFD23F]";

  return (
    <div className="mt-3 pt-3 border-t border-gray-200">
      <div className="flex items-center gap-2 mb-2">
        <Trophy className="w-4 h-4 text-[#FFD23F]" />
        <span className="text-xs font-bold text-[#3D5A80]">Scores</span>
      </div>
      <TooltipProvider delayDuration={150}>
        <div className="space-y-2">
          {attemptedChildren.map((child) => (
            <div key={child.child_id} className="flex items-center gap-2 p-2 bg-[#F8F9FA] rounded-lg">
              <span className="text-sm font-medium text-[#1D3557] flex-1 truncate">
                {child.child_name}
              </span>
              <div className="flex gap-1 items-center">
                {child.scores?.slice(0, 2).map((score, i) => (
                  <Tooltip key={i}>
                    <TooltipTrigger asChild>
                      <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold text-white cursor-default ${getScoreColor(score.percentage)}`}>
                        <Star className="w-3 h-3 fill-white" />
                        {score.percentage}%
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={8} className={tooltipClass}>
                      {i === 0 ? 'Latest score' : 'Previous score'}
                    </TooltipContent>
                  </Tooltip>
                ))}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-[#3D5A80]/15 text-[#3D5A80] cursor-default">
                      <RotateCw className="w-3 h-3" />
                      {child.scores?.length || 0}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8} className={tooltipClass}>
                    Number of attempts
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          ))}
        </div>
      </TooltipProvider>
    </div>
  );
}
