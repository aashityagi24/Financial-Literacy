import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { BarChart3, Trophy, Users, CheckCircle, XCircle, Gamepad2, Award } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';

const scoreColor = (p) => (p >= 80 ? 'text-[#06D6A0]' : p >= 60 ? 'text-[#FFD23F]' : 'text-[#EE6C4D]');
const scoreBg = (p) => (p >= 80 ? 'bg-[#06D6A0]' : p >= 60 ? 'bg-[#FFD23F]' : 'bg-[#EE6C4D]');
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

export default function ActivityAnalyticsDialog({ contentId, title, open, onClose }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!open || !contentId) return;
    setLoading(true);
    setData(null);
    (async () => {
      try {
        const res = await axios.get(`${API}/activity/teacher/content-overview/${contentId}`);
        setData(res.data);
      } catch (e) {
        toast.error('Failed to load activity analytics');
        onClose();
      } finally {
        setLoading(false);
      }
    })();
  }, [open, contentId]);

  const { content, attempted, not_attempted, stats } = data || {};

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="bg-white border-3 border-[#1D3557] rounded-3xl max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="activity-analytics-dialog">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-[#1D3557] flex items-center gap-2" style={{ fontFamily: 'Fredoka' }}>
            <BarChart3 className="w-6 h-6" />
            Activity Analytics: {title || content?.title || 'Activity'}
          </DialogTitle>
        </DialogHeader>

        {loading || !data ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1D3557]"></div>
            <span className="ml-3 text-[#3D5A80]">Loading analytics…</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary tiles */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-[#E0FBFC] rounded-2xl p-3">
              <div className="text-center">
                <p className="text-2xl font-bold text-[#3D5A80]" style={{ fontFamily: 'Fredoka' }}>{stats?.total_students || 0}</p>
                <p className="text-xs font-semibold text-[#3D5A80] flex items-center justify-center gap-1"><Users className="w-3 h-3" />Students</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-[#06D6A0]" style={{ fontFamily: 'Fredoka' }}>{stats?.attempted_count || 0}</p>
                <p className="text-xs font-semibold text-[#3D5A80]">Completed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-[#EE6C4D]" style={{ fontFamily: 'Fredoka' }}>{stats?.not_attempted_count || 0}</p>
                <p className="text-xs font-semibold text-[#3D5A80]">Not attempted</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-[#FFD23F]" style={{ fontFamily: 'Fredoka' }}>{Math.round(stats?.average_score || 0)}%</p>
                <p className="text-xs font-semibold text-[#3D5A80]">Avg score</p>
              </div>
            </div>

            {/* Completion progress */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-[#1D3557]">Completion</span>
                <span className="text-xs text-[#3D5A80]">{stats?.attempted_count || 0}/{stats?.total_students || 0}</span>
              </div>
              <Progress value={stats?.total_students ? (stats.attempted_count / stats.total_students) * 100 : 0} className="h-2.5" />
            </div>

            {/* Completed */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-[#06D6A0]" />
                <h3 className="text-sm font-bold text-[#1D3557]">Completed ({attempted?.length || 0})</h3>
              </div>
              {attempted?.length === 0 ? (
                <div className="text-center py-6 text-[#3D5A80] bg-[#F8F9FA] rounded-xl">
                  <Gamepad2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No students have attempted this activity yet</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {attempted?.map((s, i) => (
                    <div key={s.student_id} className="flex items-center gap-3 p-2.5 bg-[#F8F9FA] rounded-xl" data-testid={`analytics-attempted-${s.student_id}`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${i === 0 ? 'bg-[#FFD23F] text-[#1D3557]' : i === 1 ? 'bg-[#C0C0C0] text-[#1D3557]' : i === 2 ? 'bg-[#CD7F32] text-white' : 'bg-[#E0FBFC] text-[#3D5A80]'}`}>{i + 1}</div>
                      <div className="w-9 h-9 rounded-full bg-[#3D5A80] text-white flex items-center justify-center font-bold shrink-0">{s.name?.charAt(0) || '?'}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[#1D3557] truncate text-sm">{s.name}</p>
                        <p className="text-xs text-[#3D5A80]">Best {s.best_score}% • {s.scores?.length || 0} attempt(s)</p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`text-lg font-bold ${scoreColor(s.latest_score)}`}>{s.latest_score}%</div>
                        <p className="text-[10px] text-[#3D5A80]">Latest</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {s.scores?.slice(0, 2).map((sc, k) => (
                          <div key={k} className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white ${scoreBg(sc.percentage)}`} title={fmtDate(sc.created_at)}>{sc.percentage}</div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Not attempted */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="w-4 h-4 text-[#EE6C4D]" />
                <h3 className="text-sm font-bold text-[#1D3557]">Not Attempted ({not_attempted?.length || 0})</h3>
              </div>
              {not_attempted?.length === 0 ? (
                <div className="text-center py-4 text-[#06D6A0] bg-[#F8F9FA] rounded-xl">
                  <Award className="w-8 h-8 mx-auto mb-1" />
                  <p className="text-sm font-bold">Everyone completed this activity!</p>
                </div>
              ) : (
                <div className="max-h-40 overflow-y-auto grid sm:grid-cols-2 gap-2 pr-1">
                  {not_attempted?.map((s) => (
                    <div key={s.student_id} className="flex items-center gap-2 p-2 bg-[#FFF5F5] rounded-xl border border-[#EE6C4D]/20" data-testid={`analytics-pending-${s.student_id}`}>
                      <div className="w-8 h-8 rounded-full bg-[#EE6C4D]/30 text-[#EE6C4D] flex items-center justify-center font-bold shrink-0">{s.name?.charAt(0) || '?'}</div>
                      <p className="flex-1 font-medium text-[#3D5A80] text-sm truncate">{s.name}</p>
                      <span className="px-2 py-0.5 bg-[#EE6C4D]/10 text-[#EE6C4D] text-[10px] font-bold rounded-full shrink-0">Pending</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
