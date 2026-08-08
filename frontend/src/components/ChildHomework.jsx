import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import {
  Rocket, Clock, AlertTriangle, CheckCircle2,
  FileSpreadsheet, Gamepad2, BookOpen, Book, Lightbulb, Video, Sparkles,
} from 'lucide-react';

// Subject/content-type visual for a mission
const TYPE_META = {
  activity: { label: 'Game', Icon: Gamepad2, color: '#9B5DE5' },
  book: { label: 'Story', Icon: BookOpen, color: '#06D6A0' },
  video: { label: 'Video', Icon: Video, color: '#EE6C4D' },
  worksheet: { label: 'Worksheet', Icon: FileSpreadsheet, color: '#F59E0B' },
  workbook: { label: 'Workbook', Icon: Book, color: '#3D5A80' },
  know_it_sheet: { label: 'Know-It', Icon: Lightbulb, color: '#EAB308' },
};
const typeMeta = (t) => TYPE_META[t] || { label: 'Lesson', Icon: BookOpen, color: '#3D5A80' };

export const ChildHomework = () => {
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
    if (hw.topic_id) navigate(`/learn/topic/${hw.topic_id}?highlight=${hw.content_id}`);
    else navigate('/learn');
  };

  if (loading) return null;

  const pending = homework.filter((h) => !h.done);
  if (pending.length === 0) return null;

  return (
    <div className="card-playful p-5 mb-6" data-testid="child-homework-section">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-10 h-10 rounded-xl bg-[#EE6C4D] border-[3px] border-[#1D3557] flex items-center justify-center shadow-[2px_2px_0px_#1D3557]">
          <Rocket className="w-5 h-5 text-white" strokeWidth={2.5} />
        </div>
        <h2 className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>My Missions</h2>
        <span className="ml-auto text-xs font-bold px-2.5 py-1 rounded-full bg-[#EE6C4D] text-white border-2 border-[#1D3557]" data-testid="homework-pending-count">
          {pending.length} to do
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {pending.map((hw) => {
          const { label, Icon, color } = typeMeta(hw.content_type);
          return (
            <div
              key={hw.homework_id}
              className="relative bg-white rounded-2xl border-[3px] border-[#1D3557] shadow-[4px_4px_0px_#1D3557] p-4 flex flex-col gap-3"
              data-testid={`homework-item-${hw.homework_id}`}
            >
              {hw.overdue && (
                <span className="absolute -top-2 -right-2 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-red-500 text-white border-2 border-[#1D3557]">
                  <AlertTriangle className="w-3 h-3" /> Overdue
                </span>
              )}
              <div className="flex items-start gap-3">
                <div
                  className="w-12 h-12 rounded-xl border-[3px] border-[#1D3557] flex items-center justify-center shrink-0 shadow-[2px_2px_0px_#1D3557]"
                  style={{ backgroundColor: color }}
                >
                  <Icon className="w-6 h-6 text-white" strokeWidth={2.5} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-[#1D3557] leading-tight line-clamp-2" style={{ fontFamily: 'Fredoka' }}>
                    {hw.content_title}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: color }}>
                      {label}
                    </span>
                    <span className={`text-xs flex items-center gap-1 font-semibold ${hw.overdue ? 'text-red-600' : 'text-[#3D5A80]'}`}>
                      <Clock className="w-3 h-3" /> Due {hw.due_date}
                    </span>
                  </div>
                </div>
              </div>

              {hw.is_activity ? (
                <button
                  onClick={() => openContent(hw)}
                  className="w-full py-2.5 rounded-xl text-sm font-bold bg-[#9B5DE5] hover:-translate-y-0.5 text-white border-[3px] border-[#1D3557] shadow-[3px_3px_0px_#1D3557] hover:shadow-[4px_4px_0px_#1D3557] active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-center gap-1.5"
                  style={{ fontFamily: 'Fredoka' }}
                  data-testid={`homework-start-${hw.homework_id}`}
                >
                  <Sparkles className="w-4 h-4" /> Start Mission
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openContent(hw)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-[#FFD23F] hover:-translate-y-0.5 text-[#1D3557] border-[3px] border-[#1D3557] shadow-[3px_3px_0px_#1D3557] hover:shadow-[4px_4px_0px_#1D3557] active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-center gap-1.5"
                    style={{ fontFamily: 'Fredoka' }}
                    data-testid={`homework-open-${hw.homework_id}`}
                  >
                    <Rocket className="w-4 h-4" /> Open
                  </button>
                  <button
                    onClick={() => markDone(hw)}
                    disabled={marking === hw.homework_id}
                    className="py-2.5 px-3 rounded-xl text-sm font-bold bg-[#06D6A0] hover:-translate-y-0.5 text-white border-[3px] border-[#1D3557] shadow-[3px_3px_0px_#1D3557] hover:shadow-[4px_4px_0px_#1D3557] active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-50 flex items-center justify-center"
                    title="Mark done"
                    data-testid={`homework-markdone-${hw.homework_id}`}
                  >
                    {marking === hw.homework_id ? '…' : <CheckCircle2 className="w-5 h-5" strokeWidth={2.5} />}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
