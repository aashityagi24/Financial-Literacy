import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import { Star } from 'lucide-react';

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
      // Find the best score for this content
      const contentScores = myScores.filter(s => s.content_id === contentId);
      if (contentScores.length > 0) {
        // Pick the one with the best percentage
        const best = contentScores.reduce((a, b) => (a.percentage || 0) >= (b.percentage || 0) ? a : b);
        setScoreData({
          correctAnswers: best.correct_answers || best.score || 0,
          totalQuestions: best.total_questions || 0,
          percentage: best.percentage || 0
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
    if (scoreData.percentage >= 80) return { bg: 'bg-[#06D6A0]' };
    if (scoreData.percentage >= 60) return { bg: 'bg-[#FFD23F]' };
    return { bg: 'bg-[#EE6C4D]' };
  };

  const style = getScoreStyle();
  const displayScore = scoreData.totalQuestions > 0
    ? `${scoreData.correctAnswers}/${scoreData.totalQuestions}`
    : `${scoreData.percentage}%`;

  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${style.bg} text-white text-sm font-bold shadow-md`}>
      <Star className="w-4 h-4 fill-white" />
      <span>{displayScore}</span>
    </div>
  );
}
