import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import { Star } from 'lucide-react';
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
    if (scoreData.percentage >= 80) return { bg: 'bg-[#06D6A0]', text: 'text-white' };
    if (scoreData.percentage >= 40) return { bg: 'bg-[#FFD23F]', text: 'text-[#1D3557]' };
    return { bg: 'bg-[#EE6C4D]', text: 'text-white' };
  };

  const style = getScoreStyle();
  const showStar = scoreData.percentage >= 80;
  const displayScore = scoreData.totalQuestions > 0
    ? `${scoreData.correctAnswers}/${scoreData.totalQuestions}`
    : `${scoreData.percentage}%`;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`text-xs px-3 py-1 rounded-full font-medium ${style.bg} ${style.text} inline-flex items-center gap-1 cursor-default`}>
            {showStar && <Star className="w-3 h-3 fill-current" />}
            {displayScore}
          </span>
        </TooltipTrigger>
        <TooltipContent>Your highest score from all attempts</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-xs px-3 py-1 rounded-full font-medium bg-[#98C1D9]/30 text-[#3D5A80] cursor-default">
            {scoreData.attempts} {scoreData.attempts === 1 ? 'attempt' : 'attempts'}
          </span>
        </TooltipTrigger>
        <TooltipContent>Number of times you did the activity</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
