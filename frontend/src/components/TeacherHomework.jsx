import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { ClipboardList, Check, X, ChevronDown, ChevronUp, Trash2, Users, BarChart3 } from 'lucide-react';

const typeLabel = (t) => {
  const map = { activity: 'Activity', book: 'Story/Book', video: 'Video', worksheet: 'Worksheet', workbook: 'Workbook', know_it_sheet: 'Know-It Sheet' };
  return map[t] || 'Lesson';
};

export const TeacherHomework = ({ classroomId, refreshKey }) => {
  const [homework, setHomework] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showStudents, setShowStudents] = useState(false);

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

  const toggleDetail = async (hw) => {
    if (expanded === hw.homework_id) { setExpanded(null); setDetail(null); setShowStudents(false); return; }
    setExpanded(hw.homework_id);
    setDetail(null);
    setShowStudents(false);
    setDetailLoading(true);
    try {
      const res = await axios.get(`${API}/teacher/homework/${hw.homework_id}`);
      setDetail(res.data);
    } catch (e) {
      toast.error('Could not load analytics');
    } finally {
      setDetailLoading(false);
    }
  };

  const removeHomework = async (hw, e) => {
    e.stopPropagation();
    if (!window.confirm(`Remove homework "${hw.content_title}"?`)) return;
    try {
      await axios.delete(`${API}/teacher/homework/${hw.homework_id}`);
      toast.success('Homework removed');
      if (expanded === hw.homework_id) { setExpanded(null); setDetail(null); }
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
          const isOpen = expanded === hw.homework_id;
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
                  onClick={() => toggleDetail(hw)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${isOpen ? 'bg-[#3D5A80] text-white' : 'bg-[#EEF2FF] text-[#3D5A80] hover:bg-[#E0E7FF]'}`}
                  data-testid={`homework-analytics-btn-${hw.homework_id}`}
                >
                  <BarChart3 className="w-4 h-4" />
                  Analytics
                  {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                <button onClick={(e) => removeHomework(hw, e)} className="text-gray-400 hover:text-[#EE6C4D] shrink-0" title="Remove homework" data-testid={`remove-homework-${hw.homework_id}`}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {isOpen && (
                <div className="mt-4 pt-4 border-t border-gray-200" data-testid={`homework-analytics-${hw.homework_id}`}>
                  {detailLoading || !detail ? (
                    <p className="text-sm text-[#3D5A80]">Loading…</p>
                  ) : (
                    <>
                      {/* Analytics summary (compact, class-level) */}
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
                      <p className="text-xs text-[#3D5A80] mt-2">
                        {hw.is_activity ? 'Completion is auto-tracked from student activity.' : 'Students mark this done themselves.'}
                      </p>

                      {/* Per-student list on demand (scrollable, so it stays compact) */}
                      <button
                        onClick={() => setShowStudents(v => !v)}
                        className="mt-3 text-sm font-semibold text-[#3D5A80] hover:text-[#1D3557] flex items-center gap-1"
                        data-testid={`homework-toggle-students-${hw.homework_id}`}
                      >
                        {showStudents ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        {showStudents ? 'Hide student list' : `View student list (${detail.total_students})`}
                      </button>
                      {showStudents && (
                        <div className="mt-2 max-h-48 overflow-y-auto grid sm:grid-cols-2 gap-2 pr-1" data-testid={`homework-student-list-${hw.homework_id}`}>
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
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
