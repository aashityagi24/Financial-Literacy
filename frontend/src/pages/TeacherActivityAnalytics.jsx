import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { API, getAssetUrl } from '@/App';
import { toast } from 'sonner';
import { 
  ChevronLeft, Trophy, Users, CheckCircle, XCircle, 
  TrendingUp, Clock, Target, Award, Gamepad2
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export default function TeacherActivityAnalytics({ user }) {
  const navigate = useNavigate();
  const { contentId } = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!user || !['teacher', 'admin'].includes(user.role)) {
      toast.error('Teacher access required');
      navigate('/dashboard');
      return;
    }
    fetchData();
  }, [user, contentId]);

  const fetchData = async () => {
    try {
      const response = await axios.get(`${API}/activity/teacher/content-overview/${contentId}`);
      setData(response.data);
    } catch (error) {
      toast.error('Failed to load activity data');
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (percentage) => {
    if (percentage >= 80) return 'text-[#06D6A0]';
    if (percentage >= 60) return 'text-[#FFD23F]';
    return 'text-[#EE6C4D]';
  };

  const getScoreBg = (percentage) => {
    if (percentage >= 80) return 'bg-[#06D6A0]';
    if (percentage >= 60) return 'bg-[#FFD23F]';
    return 'bg-[#EE6C4D]';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-IN', { 
      day: 'numeric', 
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#E0FBFC] flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-[#FFD23F] border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const { content, attempted, not_attempted, stats } = data || {};

  return (
    <div className="min-h-screen bg-[#E0FBFC] p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className="border-2 border-[#1D3557]"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
              Activity Analytics
            </h1>
            <p className="text-[#3D5A80]">{content?.title || 'Activity'}</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="card-playful bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#3D5A80]/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-[#3D5A80]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#1D3557]">{stats?.total_students || 0}</p>
                <p className="text-xs text-[#3D5A80]">Total Students</p>
              </div>
            </div>
          </div>
          
          <div className="card-playful bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#06D6A0]/20 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-[#06D6A0]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#1D3557]">{stats?.attempted_count || 0}</p>
                <p className="text-xs text-[#3D5A80]">Completed</p>
              </div>
            </div>
          </div>
          
          <div className="card-playful bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#EE6C4D]/20 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-[#EE6C4D]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#1D3557]">{stats?.not_attempted_count || 0}</p>
                <p className="text-xs text-[#3D5A80]">Not Attempted</p>
              </div>
            </div>
          </div>
          
          <div className="card-playful bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FFD23F]/20 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-[#FFD23F]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#1D3557]">{Math.round(stats?.average_score || 0)}%</p>
                <p className="text-xs text-[#3D5A80]">Avg Score</p>
              </div>
            </div>
          </div>
        </div>

        {/* Completion Progress */}
        <div className="card-playful bg-white p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-[#1D3557]">Completion Rate</span>
            <span className="text-sm text-[#3D5A80]">
              {stats?.attempted_count || 0} / {stats?.total_students || 0} students
            </span>
          </div>
          <Progress 
            value={stats?.total_students ? (stats.attempted_count / stats.total_students) * 100 : 0} 
            className="h-3"
          />
        </div>

        {/* Two Column Layout */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Completed Students */}
          <div className="card-playful bg-white p-6">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="w-5 h-5 text-[#06D6A0]" />
              <h2 className="text-lg font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
                Completed ({attempted?.length || 0})
              </h2>
            </div>
            
            {attempted?.length === 0 ? (
              <div className="text-center py-8 text-[#3D5A80]">
                <Gamepad2 className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>No students have attempted this activity yet</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {attempted?.map((student, index) => (
                  <div 
                    key={student.student_id}
                    className="flex items-center gap-3 p-3 bg-[#F8F9FA] rounded-xl"
                  >
                    {/* Rank */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      index === 0 ? 'bg-[#FFD23F] text-[#1D3557]' :
                      index === 1 ? 'bg-[#C0C0C0] text-[#1D3557]' :
                      index === 2 ? 'bg-[#CD7F32] text-white' :
                      'bg-[#E0FBFC] text-[#3D5A80]'
                    }`}>
                      {index + 1}
                    </div>
                    
                    {/* Avatar */}
                    {student.picture ? (
                      <img src={student.picture} alt="" className="w-10 h-10 rounded-full" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-[#3D5A80] text-white flex items-center justify-center font-bold">
                        {student.name?.charAt(0) || '?'}
                      </div>
                    )}
                    
                    {/* Name & Scores */}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[#1D3557] truncate">{student.name}</p>
                      <div className="flex items-center gap-2 text-xs text-[#3D5A80]">
                        <span>Best: {student.best_score}%</span>
                        <span>•</span>
                        <span>Attempts: {student.scores?.length || 0}</span>
                      </div>
                    </div>
                    
                    {/* Latest Score */}
                    <div className="text-right">
                      <div className={`text-xl font-bold ${getScoreColor(student.latest_score)}`}>
                        {student.latest_score}%
                      </div>
                      <p className="text-xs text-[#3D5A80]">Latest</p>
                    </div>
                    
                    {/* Score History */}
                    <div className="flex gap-1">
                      {student.scores?.slice(0, 2).map((score, i) => (
                        <div 
                          key={i}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white ${getScoreBg(score.percentage)}`}
                          title={formatDate(score.created_at)}
                        >
                          {score.percentage}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Not Attempted Students */}
          <div className="card-playful bg-white p-6">
            <div className="flex items-center gap-2 mb-4">
              <XCircle className="w-5 h-5 text-[#EE6C4D]" />
              <h2 className="text-lg font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
                Not Attempted ({not_attempted?.length || 0})
              </h2>
            </div>
            
            {not_attempted?.length === 0 ? (
              <div className="text-center py-8 text-[#06D6A0]">
                <Award className="w-12 h-12 mx-auto mb-2" />
                <p className="font-bold">All students have completed this activity!</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {not_attempted?.map((student) => (
                  <div 
                    key={student.student_id}
                    className="flex items-center gap-3 p-3 bg-[#FFF5F5] rounded-xl border border-[#EE6C4D]/20"
                  >
                    {/* Avatar */}
                    {student.picture ? (
                      <img src={student.picture} alt="" className="w-10 h-10 rounded-full opacity-60" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-[#EE6C4D]/30 text-[#EE6C4D] flex items-center justify-center font-bold">
                        {student.name?.charAt(0) || '?'}
                      </div>
                    )}
                    
                    {/* Name */}
                    <div className="flex-1">
                      <p className="font-medium text-[#3D5A80]">{student.name}</p>
                      {student.grade !== undefined && (
                        <p className="text-xs text-[#3D5A80]/60">Grade {student.grade}</p>
                      )}
                    </div>
                    
                    {/* Status */}
                    <span className="px-3 py-1 bg-[#EE6C4D]/10 text-[#EE6C4D] text-xs font-bold rounded-full">
                      Pending
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
