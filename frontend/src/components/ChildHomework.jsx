import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { ClipboardList, Clock, AlertTriangle } from 'lucide-react';

const typeLabel = (t) => {
  const map = { activity: 'Activity', book: 'Story/Book', video: 'Video', worksheet: 'Worksheet', workbook: 'Workbook', know_it_sheet: 'Know-It Sheet', group_project: 'Group Project', discussion: 'Discussion' };
  return map[t] || 'Lesson';
};

export const ChildHomework = ({ variant = 'list' }) => {
  const navigate = useNavigate();
  const [homework, setHomework] = useState([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(null);

  const fetchHomework = async () => {
    try {
      const res = await axios.get(`${API}/child/homework`);
      setHomework(res.data?.homework || []);
    } catch (e) {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHomework(); }, []);

  const markDone = async (hw) => {
    setMarking(hw.homework_id);
    try {
      await axios.post(`${API}/child/homework/${hw.homework_id}/mark-done`);
      toast.success('Nice! Marked as done 🎉');
      fetchHomework();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not mark done');
    } finally {
      setMarking(null);
    }
  };

  const openContent = (hw) => {
    if (hw.topic_id) navigate(`/learn/topic/${hw.topic_id}?highlight=${hw.content_id}&homework=1`);
    else navigate('/learn');
  };

  if (loading) return null;

  const pending = homework.filter((h) => !h.done);
  if (pending.length === 0) return null;

  // Compact single-item banner used on the Grade K-3 learning-first dashboard —
  // shows just the most urgent homework item.
  if (variant === 'banner') {
    const hw = pending[0];
    return (
      <div
        className="bg-white rounded-2xl shadow-sm border-l-[6px] border-l-red-400 p-4 mb-4 flex items-center gap-4"
        data-testid="child-homework-banner"
      >
        <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
          <ClipboardList className="w-5 h-5 text-red-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-[#1A1A1A] truncate">Homework: {hw.content_title}</h3>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide flex-shrink-0 ${hw.overdue ? 'bg-red-100 text-red-600' : 'bg-rose-100 text-rose-500'}`}>
              {hw.overdue ? 'Overdue' : 'Due Today'}
            </span>
          </div>
          <p className="text-sm text-[#8A8378] truncate">
            {hw.teacher_name ? `Set by ${hw.teacher_name}` : hw.classroom_name || 'Homework'}
            {hw.reward_coins ? ` · earn ${hw.reward_coins} XP` : ''}
          </p>
        </div>
        {hw.is_activity ? (
          <button
            onClick={() => openContent(hw)}
            className="flex-shrink-0 border-2 border-[#1A1A1A] rounded-xl px-4 py-2 font-bold text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white transition-colors"
            data-testid={`homework-banner-do-${hw.homework_id}`}
          >
            Do homework
          </button>
        ) : (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => openContent(hw)}
              className="border-2 border-[#1A1A1A] rounded-xl px-3 py-2 font-bold text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white transition-colors text-sm"
              data-testid={`homework-banner-open-${hw.homework_id}`}
            >
              Open
            </button>
            <button
              onClick={() => markDone(hw)}
              disabled={marking === hw.homework_id}
              className="bg-[#06D6A0] hover:bg-[#05C090] text-white rounded-xl px-3 py-2 font-bold text-sm disabled:opacity-50"
              data-testid={`homework-banner-markdone-${hw.homework_id}`}
            >
              {marking === hw.homework_id ? '…' : 'Mark Done'}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="card-playful p-5 mb-6" data-testid="child-homework-section">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-xl bg-[#EE6C4D] flex items-center justify-center">
          <ClipboardList className="w-5 h-5 text-white" />
        </div>
        <h2 className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>My Homework</h2>
        <span className="ml-auto text-xs font-bold px-2 py-1 rounded-full bg-[#EE6C4D] text-white" data-testid="homework-pending-count">
          {pending.length} to do
        </span>
      </div>

      <div className="space-y-3">
        {pending.map((hw) => (
          <div
            key={hw.homework_id}
            className={`flex items-center gap-3 p-3 rounded-xl border-2 ${hw.overdue ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}
            data-testid={`homework-item-${hw.homework_id}`}
          >
            <div className="min-w-0 flex-1">
              <p className="font-bold text-[#1D3557] truncate">{hw.content_title}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold">{typeLabel(hw.content_type)}</span>
                <span className={`text-xs flex items-center gap-1 font-medium ${hw.overdue ? 'text-red-600' : 'text-[#3D5A80]'}`}>
                  {hw.overdue ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                  {hw.overdue ? 'Overdue' : 'Due'} {hw.due_date}
                </span>
              </div>
            </div>
            {hw.is_activity ? (
              <button
                onClick={() => openContent(hw)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#9B5DE5] hover:bg-[#8A4DD4] text-white shrink-0"
                data-testid={`homework-start-${hw.homework_id}`}
              >
                Start
              </button>
            ) : (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => openContent(hw)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-100 hover:bg-gray-200 text-[#1D3557]"
                  data-testid={`homework-open-${hw.homework_id}`}
                >
                  Open
                </button>
                <button
                  onClick={() => markDone(hw)}
                  disabled={marking === hw.homework_id}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#06D6A0] hover:bg-[#05C090] text-white disabled:opacity-50"
                  data-testid={`homework-markdone-${hw.homework_id}`}
                >
                  {marking === hw.homework_id ? '…' : 'Mark Done'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
