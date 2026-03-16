import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import { Star } from 'lucide-react';

export default function ChildActivityScore({ contentId, user }) {
  const [score, setScore] = useState(null);
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
        const bestScore = Math.max(...contentScores.map(s => s.percentage || 0));
        setScore(bestScore);
      }
    } catch (error) {
      console.error('Failed to fetch score:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || score === null) {
    return null;
  }

  const getScoreStyle = () => {
    if (score >= 80) return { bg: 'bg-[#06D6A0]', text: 'Great!' };
    if (score >= 60) return { bg: 'bg-[#FFD23F]', text: 'Good!' };
    return { bg: 'bg-[#EE6C4D]', text: 'Try again!' };
  };

  const style = getScoreStyle();

  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${style.bg} text-white text-sm font-bold shadow-md`}>
      <Star className="w-4 h-4 fill-white" />
      <span>{score}%</span>
    </div>
  );
}
