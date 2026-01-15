import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { 
  GraduationCap, ChevronLeft, Plus, Users, Trophy, 
  Copy, Trash2, Gift, Star, ChevronRight, Eye, Megaphone,
  BookOpen, LogOut, User
} from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function TeacherDashboard({ user }) {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [selectedClassroom, setSelectedClassroom] = useState(null);
  const [classroomDetails, setClassroomDetails] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Forms
  const [showCreateClass, setShowCreateClass] = useState(false);
  const [showReward, setShowReward] = useState(false);
  const [showChallenge, setShowChallenge] = useState(false);
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [showStudentProgress, setShowStudentProgress] = useState(null);
  
  const [classForm, setClassForm] = useState({ name: '', description: '', grade_level: 3 });
  const [rewardForm, setRewardForm] = useState({ student_ids: [], amount: 10, reason: '' });
  const [challengeForm, setChallengeForm] = useState({ title: '', description: '', reward_amount: 20 });
  const [announcementForm, setAnnouncementForm] = useState({ title: '', message: '' });
  
  useEffect(() => {
    if (user?.role !== 'teacher') {
      toast.error('Teacher access required');
      navigate('/dashboard');
      return;
    }
    fetchDashboard();
  }, [user, navigate]);
  
  const fetchDashboard = async () => {
    try {
      const response = await axios.get(`${API}/teacher/dashboard`);
      setDashboard(response.data);
    } catch (error) {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };
  
  const fetchClassroomDetails = async (classroomId) => {
    try {
      const [classRes, annRes] = await Promise.all([
        axios.get(`${API}/teacher/classrooms/${classroomId}`),
        axios.get(`${API}/teacher/classrooms/${classroomId}/announcements`)
      ]);
      setClassroomDetails(classRes.data);
      setAnnouncements(annRes.data || []);
      setSelectedClassroom(classroomId);
    } catch (error) {
      toast.error('Failed to load classroom');
    }
  };
  
  const handleCreateClassroom = async () => {
    try {
      await axios.post(`${API}/teacher/classrooms`, classForm);
      toast.success('Classroom created!');
      setShowCreateClass(false);
      setClassForm({ name: '', description: '', grade_level: 3 });
      fetchDashboard();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create classroom');
    }
  };
  
  const handleDeleteClassroom = async (classroomId) => {
    if (!window.confirm('Delete this classroom?')) return;
    try {
      await axios.delete(`${API}/teacher/classrooms/${classroomId}`);
      toast.success('Classroom deleted');
      setSelectedClassroom(null);
      setClassroomDetails(null);
      fetchDashboard();
    } catch (error) {
      toast.error('Failed to delete classroom');
    }
  };
  
  const handleGiveReward = async () => {
    if (rewardForm.student_ids.length === 0) {
      toast.error('Select at least one student');
      return;
    }
    try {
      await axios.post(`${API}/teacher/classrooms/${selectedClassroom}/reward`, rewardForm);
      toast.success('Rewards given!');
      setShowReward(false);
      setRewardForm({ student_ids: [], amount: 10, reason: '' });
      fetchClassroomDetails(selectedClassroom);
    } catch (error) {
      toast.error('Failed to give reward');
    }
  };
  
  const handleCreateChallenge = async () => {
    try {
      await axios.post(`${API}/teacher/classrooms/${selectedClassroom}/challenges`, challengeForm);
      toast.success('Challenge created!');
      setShowChallenge(false);
      setChallengeForm({ title: '', description: '', reward_amount: 20 });
      fetchClassroomDetails(selectedClassroom);
    } catch (error) {
      toast.error('Failed to create challenge');
    }
  };
  
  const handlePostAnnouncement = async () => {
    if (!announcementForm.title || !announcementForm.message) {
      toast.error('Please fill in title and message');
      return;
    }
    try {
      await axios.post(`${API}/teacher/classrooms/${selectedClassroom}/announcements`, announcementForm);
      toast.success('Announcement posted!');
      setShowAnnouncement(false);
      setAnnouncementForm({ title: '', message: '' });
      fetchClassroomDetails(selectedClassroom);
    } catch (error) {
      toast.error('Failed to post announcement');
    }
  };
  
  const handleDeleteAnnouncement = async (announcementId) => {
    try {
      await axios.delete(`${API}/teacher/announcements/${announcementId}`);
      toast.success('Announcement deleted');
      setAnnouncements(announcements.filter(a => a.announcement_id !== announcementId));
    } catch (error) {
      toast.error('Failed to delete announcement');
    }
  };
  
  const handleCompleteChallenge = async (challengeId, studentId) => {
    try {
      await axios.post(`${API}/teacher/challenges/${challengeId}/complete/${studentId}`);
      toast.success('Challenge completed for student!');
      fetchClassroomDetails(selectedClassroom);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed');
    }
  };
  
  const copyInviteCode = (code) => {
    navigator.clipboard.writeText(code);
    toast.success('Invite code copied!');
  };
  
  const gradeLabels = ['Kindergarten', '1st Grade', '2nd Grade', '3rd Grade', '4th Grade', '5th Grade'];
  
  const handleLogout = async () => {
    try {
      await axios.post(`${API}/auth/logout`);
      navigate('/');
    } catch (error) {
      console.error('Logout failed:', error);
      navigate('/');
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#E0FBFC] flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-[#1D3557] border-t-[#FFD23F] rounded-full animate-spin"></div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-[#E0FBFC]" data-testid="teacher-dashboard">
      {/* Header */}
      <header className="bg-[#EE6C4D] border-b-3 border-[#1D3557]">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-xl border-3 border-[#1D3557] flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-[#EE6C4D]" />
              </div>
              <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Fredoka' }}>Teacher Dashboard</h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-2 bg-white/20 rounded-xl">
                <User className="w-4 h-4 text-white" />
                <span className="text-sm font-medium text-white">{user?.name || 'Teacher'}</span>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-xl border-2 border-white hover:bg-white/20 transition-colors"
                data-testid="teacher-logout-btn"
              >
                <LogOut className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6">
        {!selectedClassroom ? (
          <>
            {/* Overview */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="card-playful p-5">
                <Users className="w-8 h-8 text-[#3D5A80] mb-2" />
                <p className="text-3xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>{dashboard?.total_students || 0}</p>
                <p className="text-sm text-[#3D5A80]">Total Students</p>
              </div>
              <div className="card-playful p-5">
                <GraduationCap className="w-8 h-8 text-[#EE6C4D] mb-2" />
                <p className="text-3xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>{dashboard?.classrooms?.length || 0}</p>
                <p className="text-sm text-[#3D5A80]">Classrooms</p>
              </div>
            </div>
            
            {/* Create Classroom Button */}
            <Dialog open={showCreateClass} onOpenChange={setShowCreateClass}>
              <DialogTrigger asChild>
                <button className="btn-primary w-full py-4 mb-6 flex items-center justify-center gap-2 text-lg">
                  <Plus className="w-5 h-5" /> Create Classroom
                </button>
              </DialogTrigger>
              <DialogContent className="bg-white border-3 border-[#1D3557] rounded-3xl">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>Create Classroom</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <Input 
                    placeholder="Classroom Name" 
                    value={classForm.name} 
                    onChange={(e) => setClassForm({...classForm, name: e.target.value})}
                    className="border-3 border-[#1D3557]"
                  />
                  <Textarea 
                    placeholder="Description (optional)" 
                    value={classForm.description} 
                    onChange={(e) => setClassForm({...classForm, description: e.target.value})}
                    className="border-3 border-[#1D3557]"
                  />
                  <Select 
                    value={classForm.grade_level.toString()} 
                    onValueChange={(v) => setClassForm({...classForm, grade_level: parseInt(v)})}
                  >
                    <SelectTrigger className="border-3 border-[#1D3557]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {gradeLabels.map((label, i) => (
                        <SelectItem key={i} value={i.toString()}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button onClick={handleCreateClassroom} className="btn-primary w-full py-3">Create</button>
                </div>
              </DialogContent>
            </Dialog>
            
            {/* Classrooms List */}
            <h2 className="text-xl font-bold text-[#1D3557] mb-4" style={{ fontFamily: 'Fredoka' }}>Your Classrooms</h2>
            
            {dashboard?.classrooms?.length === 0 ? (
              <div className="card-playful p-8 text-center">
                <GraduationCap className="w-16 h-16 mx-auto text-[#98C1D9] mb-4" />
                <h3 className="text-xl font-bold text-[#1D3557] mb-2">No Classrooms Yet</h3>
                <p className="text-[#3D5A80]">Create your first classroom to start teaching!</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {dashboard?.classrooms?.map((classroom, index) => (
                  <div 
                    key={classroom.classroom_id}
                    className="card-playful p-5 cursor-pointer hover:scale-[1.01] transition-transform"
                    style={{ animationDelay: `${index * 0.05}s` }}
                    onClick={() => fetchClassroomDetails(classroom.classroom_id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-[#1D3557] text-lg">{classroom.name}</h3>
                        <p className="text-sm text-[#3D5A80]">{gradeLabels[classroom.grade_level]} • {classroom.student_count} students</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="bg-[#FFD23F]/20 px-3 py-1 rounded-lg flex items-center gap-2">
                          <span className="text-xs text-[#3D5A80]">Code:</span>
                          <span className="font-bold text-[#1D3557]">{classroom.invite_code}</span>
                          <button onClick={(e) => { e.stopPropagation(); copyInviteCode(classroom.invite_code); }}>
                            <Copy className="w-4 h-4 text-[#3D5A80]" />
                          </button>
                        </div>
                        <ChevronRight className="w-5 h-5 text-[#3D5A80]" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Classroom Detail View */}
            <button 
              onClick={() => { setSelectedClassroom(null); setClassroomDetails(null); }}
              className="text-[#3D5A80] mb-4 flex items-center gap-2 hover:text-[#1D3557]"
            >
              <ChevronLeft className="w-4 h-4" /> Back to Classrooms
            </button>
            
            {classroomDetails && (
              <>
                {/* Classroom Header */}
                <div className="card-playful p-6 mb-6 bg-gradient-to-r from-[#EE6C4D] to-[#FF8A6C] text-white">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-2xl font-bold mb-1" style={{ fontFamily: 'Fredoka' }}>{classroomDetails.classroom.name}</h2>
                      <p className="opacity-90">{gradeLabels[classroomDetails.classroom.grade_level]}</p>
                      {classroomDetails.classroom.description && (
                        <p className="text-sm opacity-80 mt-2">{classroomDetails.classroom.description}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="bg-white/20 px-3 py-2 rounded-lg mb-2">
                        <p className="text-xs opacity-80">Invite Code</p>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg">{classroomDetails.classroom.invite_code}</span>
                          <button onClick={() => copyInviteCode(classroomDetails.classroom.invite_code)}>
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDeleteClassroom(selectedClassroom)}
                        className="text-white/80 hover:text-white text-sm flex items-center gap-1"
                      >
                        <Trash2 className="w-4 h-4" /> Delete
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex gap-3 mb-6">
                  <Dialog open={showReward} onOpenChange={setShowReward}>
                    <DialogTrigger asChild>
                      <button className="btn-primary flex-1 py-3 flex items-center justify-center gap-2">
                        <Gift className="w-5 h-5" /> Give Reward
                      </button>
                    </DialogTrigger>
                    <DialogContent className="bg-white border-3 border-[#1D3557] rounded-3xl">
                      <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>Give Reward</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 mt-4">
                        <div>
                          <label className="text-sm font-bold text-[#1D3557] mb-2 block">Select Students</label>
                          <div className="max-h-40 overflow-y-auto space-y-2">
                            {classroomDetails.students.map((s) => (
                              <label key={s.user_id} className="flex items-center gap-2 p-2 bg-[#E0FBFC] rounded-lg cursor-pointer">
                                <input 
                                  type="checkbox"
                                  checked={rewardForm.student_ids.includes(s.user_id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setRewardForm({...rewardForm, student_ids: [...rewardForm.student_ids, s.user_id]});
                                    } else {
                                      setRewardForm({...rewardForm, student_ids: rewardForm.student_ids.filter(id => id !== s.user_id)});
                                    }
                                  }}
                                  className="w-4 h-4"
                                />
                                <span className="text-[#1D3557]">{s.name}</span>
                              </label>
                            ))}
                          </div>
                          <button 
                            onClick={() => setRewardForm({...rewardForm, student_ids: classroomDetails.students.map(s => s.user_id)})}
                            className="text-sm text-[#3D5A80] mt-2 hover:text-[#1D3557]"
                          >
                            Select All
                          </button>
                        </div>
                        <Input 
                          type="number"
                          placeholder="Amount" 
                          value={rewardForm.amount} 
                          onChange={(e) => setRewardForm({...rewardForm, amount: parseFloat(e.target.value)})}
                          className="border-3 border-[#1D3557]"
                        />
                        <Input 
                          placeholder="Reason" 
                          value={rewardForm.reason} 
                          onChange={(e) => setRewardForm({...rewardForm, reason: e.target.value})}
                          className="border-3 border-[#1D3557]"
                        />
                        <button onClick={handleGiveReward} className="btn-primary w-full py-3">Give Reward</button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  
                  <Dialog open={showChallenge} onOpenChange={setShowChallenge}>
                    <DialogTrigger asChild>
                      <button className="btn-secondary flex-1 py-3 flex items-center justify-center gap-2">
                        <Trophy className="w-5 h-5" /> Create Challenge
                      </button>
                    </DialogTrigger>
                    <DialogContent className="bg-white border-3 border-[#1D3557] rounded-3xl">
                      <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>Create Challenge</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 mt-4">
                        <Input 
                          placeholder="Challenge Title" 
                          value={challengeForm.title} 
                          onChange={(e) => setChallengeForm({...challengeForm, title: e.target.value})}
                          className="border-3 border-[#1D3557]"
                        />
                        <Textarea 
                          placeholder="Description" 
                          value={challengeForm.description} 
                          onChange={(e) => setChallengeForm({...challengeForm, description: e.target.value})}
                          className="border-3 border-[#1D3557]"
                        />
                        <Input 
                          type="number"
                          placeholder="Reward Amount" 
                          value={challengeForm.reward_amount} 
                          onChange={(e) => setChallengeForm({...challengeForm, reward_amount: parseFloat(e.target.value)})}
                          className="border-3 border-[#1D3557]"
                        />
                        <button onClick={handleCreateChallenge} className="btn-primary w-full py-3">Create Challenge</button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  
                  <Dialog open={showAnnouncement} onOpenChange={setShowAnnouncement}>
                    <DialogTrigger asChild>
                      <button className="bg-[#FFD23F] border-3 border-[#1D3557] rounded-xl font-bold text-[#1D3557] hover:bg-[#FFE066] flex-1 py-3 flex items-center justify-center gap-2">
                        <Megaphone className="w-5 h-5" /> Announce
                      </button>
                    </DialogTrigger>
                    <DialogContent className="bg-white border-3 border-[#1D3557] rounded-3xl">
                      <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>Post Announcement</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 mt-4">
                        <p className="text-sm text-[#3D5A80]">This will be visible to all students and their parents.</p>
                        <Input 
                          placeholder="Announcement Title" 
                          value={announcementForm.title} 
                          onChange={(e) => setAnnouncementForm({...announcementForm, title: e.target.value})}
                          className="border-3 border-[#1D3557]"
                        />
                        <Textarea 
                          placeholder="Message" 
                          value={announcementForm.message} 
                          onChange={(e) => setAnnouncementForm({...announcementForm, message: e.target.value})}
                          className="border-3 border-[#1D3557]"
                          rows={4}
                        />
                        <button onClick={handlePostAnnouncement} className="btn-primary w-full py-3">Post Announcement</button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                
                {/* Announcements Section */}
                {announcements.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-xl font-bold text-[#1D3557] mb-4" style={{ fontFamily: 'Fredoka' }}>
                      <Megaphone className="w-5 h-5 inline mr-2" />
                      Announcements ({announcements.length})
                    </h3>
                    <div className="space-y-3">
                      {announcements.map((ann) => (
                        <div key={ann.announcement_id} className="card-playful p-4 bg-[#FFD23F]/10">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-bold text-[#1D3557]">{ann.title}</h4>
                              <p className="text-sm text-[#3D5A80] mt-1">{ann.message}</p>
                              <p className="text-xs text-[#3D5A80]/60 mt-2">
                                Posted: {new Date(ann.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <button 
                              onClick={() => handleDeleteAnnouncement(ann.announcement_id)}
                              className="p-2 hover:bg-[#EE6C4D]/20 rounded-lg text-[#EE6C4D]"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Students List */}
                <h3 className="text-xl font-bold text-[#1D3557] mb-4" style={{ fontFamily: 'Fredoka' }}>
                  Students ({classroomDetails.students.length})
                </h3>
                
                {classroomDetails.students.length === 0 ? (
                  <div className="card-playful p-6 text-center mb-6">
                    <Users className="w-12 h-12 mx-auto text-[#98C1D9] mb-2" />
                    <p className="text-[#3D5A80]">No students yet. Share the invite code!</p>
                  </div>
                ) : (
                  <div className="space-y-3 mb-6">
                    {classroomDetails.students.map((student) => (
                      <div key={student.user_id} className="card-playful p-4">
                        <div className="flex items-center gap-4">
                          <img 
                            src={student.picture || 'https://via.placeholder.com/40'} 
                            alt={student.name}
                            className="w-12 h-12 rounded-full border-2 border-[#1D3557]"
                          />
                          <div className="flex-1">
                            <h4 className="font-bold text-[#1D3557]">{student.name}</h4>
                            <div className="flex items-center gap-4 text-sm text-[#3D5A80]">
                              <span>💰 ₹{student.total_balance?.toFixed(0)}</span>
                              <span>📚 {student.lessons_completed} lessons</span>
                              <span>🔥 {student.streak_count || 0} streak</span>
                            </div>
                          </div>
                          <button 
                            onClick={() => setShowStudentProgress(student)}
                            className="p-2 rounded-lg hover:bg-[#E0FBFC]"
                          >
                            <Eye className="w-5 h-5 text-[#3D5A80]" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Challenges */}
                <h3 className="text-xl font-bold text-[#1D3557] mb-4" style={{ fontFamily: 'Fredoka' }}>
                  Active Challenges ({classroomDetails.challenges.length})
                </h3>
                
                {classroomDetails.challenges.length === 0 ? (
                  <div className="card-playful p-6 text-center">
                    <Trophy className="w-12 h-12 mx-auto text-[#98C1D9] mb-2" />
                    <p className="text-[#3D5A80]">No challenges yet. Create one to motivate students!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {classroomDetails.challenges.map((challenge) => (
                      <div key={challenge.challenge_id} className="card-playful p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-bold text-[#1D3557]">{challenge.title}</h4>
                            <p className="text-sm text-[#3D5A80]">{challenge.description}</p>
                          </div>
                          <span className="bg-[#FFD23F] px-3 py-1 rounded-lg font-bold text-[#1D3557]">
                            +₹{challenge.reward_amount}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {classroomDetails.students.map((student) => (
                            <button
                              key={student.user_id}
                              onClick={() => handleCompleteChallenge(challenge.challenge_id, student.user_id)}
                              className="px-3 py-1 text-sm rounded-full border-2 border-[#1D3557] bg-white hover:bg-[#06D6A0] hover:text-white transition-colors"
                            >
                              ✓ {student.name.split(' ')[0]}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
        
        {/* Student Progress Modal */}
        <Dialog open={!!showStudentProgress} onOpenChange={() => setShowStudentProgress(null)}>
          <DialogContent className="bg-white border-3 border-[#1D3557] rounded-3xl max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
                {showStudentProgress?.name}'s Progress
              </DialogTitle>
            </DialogHeader>
            {showStudentProgress && (
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-[#FFD23F]/20 rounded-xl p-3">
                    <p className="text-2xl font-bold text-[#1D3557]">₹{showStudentProgress.total_balance?.toFixed(0)}</p>
                    <p className="text-xs text-[#3D5A80]">Balance</p>
                  </div>
                  <div className="bg-[#06D6A0]/20 rounded-xl p-3">
                    <p className="text-2xl font-bold text-[#1D3557]">{showStudentProgress.lessons_completed}</p>
                    <p className="text-xs text-[#3D5A80]">Lessons</p>
                  </div>
                  <div className="bg-[#EE6C4D]/20 rounded-xl p-3">
                    <p className="text-2xl font-bold text-[#1D3557]">{showStudentProgress.streak_count || 0}</p>
                    <p className="text-xs text-[#3D5A80]">Streak</p>
                  </div>
                </div>
                <p className="text-sm text-[#3D5A80]">
                  Email: {showStudentProgress.email}
                </p>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
