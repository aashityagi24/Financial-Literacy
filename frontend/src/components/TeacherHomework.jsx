import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { ClipboardList, Check, X, Trash2, Users, BarChart3 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const typeLabel = (t) => {
  const map = { activity: 'Activity', book: 'Story/Book', video: 'Video', worksheet: 'Worksheet', workbook: 'Workbook', know_it_sheet: 'Know-It Sheet' };
  return map[t] || 'Lesson';
};

export const TeacherHomework = ({ classroomId, refreshKey }) => {
  const [homework, setHomework] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeHw, setActiveHw] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchHomework = async () => {
    try {
      const res = await axios.get(`${API}/teacher/homework`);
      const all = res.data?.homework || [];
      setHomework(classroomId ? all.filter((h) => h.classroom_id === classroomId) : all);
    } catch (e) {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHomework(); }, [classroomId, refreshKey]);

  const openAnalytics = async (hw) => {
    setActiveHw(hw);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await axios.get(`${API}/teacher/homework/${hw.homework_id}`);
      setDetail(res.data);
    } catch (e) {
      toast.error('Could not load analytics');
      setActiveHw(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeAnalytics = () => { setActiveHw(null); setDetail(null); };

  const removeHomework = async (hw, e) => {
    e.stopPropagation();
    if (!window.confirm(`Remove homework "${hw.content_title}"?`)) return;
    try {
      await axios.delete(`${API}/teacher/homework/${hw.homework_id}`);
      toast.success('Homework removed');
      if (activeHw?.homework_id === hw.homework_id) closeAnalytics();
      fetchHomework();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not remove');
    }
  };

  if (loading || homework.length === 0) return null;

  return (
    <div className="mb-6" data-testid="teacher-homework-section">
      <h3 className="text-xl font-bold text-[#1D3557] mb-4" style={{ fontFamily: 'Fredoka' }}>
        <ClipboardList className="w-5 h-5 inline mr-2" />
        Homework ({homework.length})
      </h3>
      <div className="space-y-3">
        {homework.map((hw) => {
          const pct = hw.total_students ? Math.round((hw.completed_count / hw.total_students) * 100) : 0;
          return (
            <div key={hw.homework_id} className="card-playful p-4" data-testid={`teacher-homework-${hw.homework_id}`}>
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-[#1D3557] truncate">{hw.content_title}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold">{typeLabel(hw.content_type)}</span>
                    <span className="text-xs text-[#3D5A80] font-medium">Due {hw.due_date}</span>
                    <span className="text-xs flex items-center gap-1 text-[#3D5A80]"><Users className="w-3 h-3" />{hw.completed_count}/{hw.total_students} done</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-gray-200 overflow-hidden max-w-xs">
                    <div className="h-full bg-[#06D6A0]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <button
                  onClick={() => openAnalytics(hw)}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors bg-[#EEF2FF] text-[#3D5A80] hover:bg-[#E0E7FF]"
                  data-testid={`homework-analytics-btn-${hw.homework_id}`}
                >
                  <BarChart3 className="w-4 h-4" />
                  Analytics
                </button>
                <button onClick={(e) => removeHomework(hw, e)} className="text-gray-400 hover:text-[#EE6C4D] shrink-0" title="Remove homework" data-testid={`remove-homework-${hw.homework_id}`}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Analytics popup */}
      <Dialog open={!!activeHw} onOpenChange={(o) => { if (!o) closeAnalytics(); }}>
        <DialogContent className="bg-white border-3 border-[#1D3557] rounded-3xl max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="homework-analytics-dialog">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#1D3557] flex items-center gap-2" style={{ fontFamily: 'Fredoka' }}>
              <BarChart3 className="w-6 h-6" />
              Homework Analytics: {activeHw?.content_title}
            </DialogTitle>
          </DialogHeader>

          {detailLoading || !detail ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1D3557]"></div>
              <span className="ml-3 text-[#3D5A80]">Loading analytics…</span>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Class-level tiles */}
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 rounded-xl bg-[#06D6A0]/10">
                  <p className="text-2xl font-bold text-[#06D6A0]" style={{ fontFamily: 'Fredoka' }}>{detail.completed_count}</p>
                  <p className="text-xs font-semibold text-[#3D5A80]">Done</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-[#EE6C4D]/10">
                  <p className="text-2xl font-bold text-[#EE6C4D]" style={{ fontFamily: 'Fredoka' }}>{detail.not_done_count}</p>
                  <p className="text-xs font-semibold text-[#3D5A80]">Not done</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-[#3D5A80]/10">
                  <p className="text-2xl font-bold text-[#3D5A80]" style={{ fontFamily: 'Fredoka' }}>
                    {detail.total_students ? Math.round((detail.completed_count / detail.total_students) * 100) : 0}%
                  </p>
                  <p className="text-xs font-semibold text-[#3D5A80]">Completion</p>
                </div>
              </div>
              <p className="text-xs text-[#3D5A80]">
                {activeHw?.is_activity ? 'Completion is auto-tracked from student activity.' : 'Students mark this done themselves.'}
              </p>

              {/* Per-student list */}
              <div>
                <h4 className="text-sm font-bold text-[#1D3557] mb-2 flex items-center gap-1">
                  <Users className="w-4 h-4" /> Students ({detail.total_students})
                </h4>
                <div className="max-h-64 overflow-y-auto grid sm:grid-cols-2 gap-2 pr-1" data-testid="homework-student-list">
                  {detail.students.map((s) => (
                    <div key={s.student_id} className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${s.done ? 'bg-green-50' : 'bg-red-50'}`} data-testid={`hw-student-${s.student_id}`}>
                      <span className="font-medium text-[#1D3557] truncate">{s.name}</span>
                      {s.done ? (
                        <span className="flex items-center gap-1 text-green-600 font-bold shrink-0"><Check className="w-4 h-4" /> Done</span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-500 font-bold shrink-0"><X className="w-4 h-4" /> Not done</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
