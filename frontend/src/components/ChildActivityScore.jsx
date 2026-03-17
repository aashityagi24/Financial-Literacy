import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import { Star, RotateCw } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function ChildActivityScore({ contentId, user }) {
  const [scoreData, setScoreData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!contentId || !user || user.role !== 'child') {
      setLoading(false);
      return;
    }
    fetchMyScore();
  }, [contentId, user]);

  const fetchMyScore = async () => {
    try {
      const response = await axios.get(`${API}/activity/scores/me?limit=100`);
      const myScores = response.data.scores || [];
      const contentScores = myScores.filter(s => s.content_id === contentId);
      if (contentScores.length > 0) {
        const best = contentScores.reduce((a, b) => (a.percentage || 0) >= (b.percentage || 0) ? a : b);
        setScoreData({
          correctAnswers: best.correct_answers || best.score || 0,
          totalQuestions: best.total_questions || 0,
          percentage: best.percentage || 0,
          attempts: contentScores.length
        });
      }
    } catch (error) {
      console.error('Failed to fetch score:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || scoreData === null) {
    return null;
  }

  const getScoreStyle = () => {
    if (scoreData.percentage >= 80) return { bg: 'bg-[#06D6A0]', text: 'text-white', label: 'Great job!' };
    if (scoreData.percentage >= 50) return { bg: 'bg-[#FFD23F]', text: 'text-[#1D3557]', label: 'Almost there!' };
    return { bg: 'bg-[#EE6C4D]', text: 'text-white', label: 'Keep practicing!' };
  };

  const style = getScoreStyle();
  const showStar = scoreData.percentage >= 80;

  const tooltipClass = "z-[100] rounded-xl bg-[#1D3557] text-white px-4 py-2 text-sm font-medium shadow-lg border-2 border-[#FFD23F]";

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`text-xs px-3 py-1 rounded-full font-bold ${style.bg} ${style.text} inline-flex items-center gap-1 cursor-default`}
            data-testid="child-activity-score"
          >
            {showStar && <Star className="w-3.5 h-3.5 fill-current" />}
            {style.label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={8} className={tooltipClass}>
          Your best score from all attempts
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="text-xs px-3 py-1 rounded-full font-bold bg-[#3D5A80]/15 text-[#3D5A80] inline-flex items-center gap-1 cursor-default"
            data-testid="child-activity-attempts"
          >
            <RotateCw className="w-3 h-3" />
            {scoreData.attempts} {scoreData.attempts === 1 ? 'attempt' : 'attempts'}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={8} className={tooltipClass}>
          Number of times you did the activity
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
