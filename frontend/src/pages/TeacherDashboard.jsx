import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API, getAssetUrl } from '@/App';
import { toast } from 'sonner';
import { 
  GraduationCap, ChevronLeft, Plus, Users, 
  Copy, Trash2, Gift, Star, ChevronRight, Eye, Megaphone,
  BookOpen, LogOut, User, Target, Calendar, Edit2,
  Wallet, TrendingUp, TrendingDown, Sprout, LineChart,
  Award, Flame, ArrowUpDown, CheckCircle, XCircle, Clock,
  BarChart3, Image as ImageIcon, FileText
} from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { getDefaultAvatar } from '@/utils/avatars';
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

export default function TeacherDashboard({ user }) {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [selectedClassroom, setSelectedClassroom] = useState(null);
  const [classroomDetails, setClassroomDetails] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [teacherQuests, setTeacherQuests] = useState([]);
  const [activeTab, setActiveTab] = useState('classroom');
  const [editingQuest, setEditingQuest] = useState(null);
  
  // Forms
  const [showCreateClass, setShowCreateClass] = useState(false);
  const [showReward, setShowReward] = useState(false);
  const [showCreateQuest, setShowCreateQuest] = useState(false);
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [showStudentProgress, setShowStudentProgress] = useState(null);
  const [studentInsights, setStudentInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonData, setComparisonData] = useState(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  
  const [classForm, setClassForm] = useState({ name: '', description: '', grade_level: 3 });
  const [rewardForm, setRewardForm] = useState({ student_ids: [], amount: 10, reason: '' });
  const [announcementForm, setAnnouncementForm] = useState({ title: '', message: '' });
  const [questForm, setQuestForm] = useState({
    title: '',
    description: '',
    image_url: '',
    pdf_url: '',
    reward_amount: 0,
    due_date: '',
    questions: []
  });
  
  const resetQuestForm = () => {
    setQuestForm({
      title: '',
      description: '',
      image_url: '',
      pdf_url: '',
      reward_amount: 0,
      due_date: '',
      questions: []
    });
    setEditingQuest(null);
  };
  
  const openEditQuest = (quest) => {
    setEditingQuest(quest);
    setQuestForm({
      title: quest.title,
      description: quest.description || '',
      image_url: quest.image_url || '',
      pdf_url: quest.pdf_url || '',
      reward_amount: quest.reward_amount || 0,
      due_date: quest.due_date,
      questions: quest.questions || []
    });
    setShowCreateQuest(true);
  };
  
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
      const [dashRes, questsRes] = await Promise.all([
        axios.get(`${API}/teacher/dashboard`),
        axios.get(`${API}/teacher/quests`).catch(() => ({ data: [] }))
      ]);
      setDashboard(dashRes.data);
      setTeacherQuests(questsRes.data);
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
  
  const fetchStudentInsights = async (student) => {
    if (!selectedClassroom || !student?.user_id) return;
    setShowStudentProgress(student);
    setInsightsLoading(true);
    try {
      const res = await axios.get(`${API}/teacher/classrooms/${selectedClassroom}/student/${student.user_id}/insights`);
      setStudentInsights(res.data);
    } catch (error) {
      toast.error('Failed to load student insights');
      console.error(error);
    } finally {
      setInsightsLoading(false);
    }
  };
  
  const fetchComparisonData = async () => {
    if (!selectedClassroom) return;
    setShowComparison(true);
    setComparisonLoading(true);
    try {
      const res = await axios.get(`${API}/teacher/classrooms/${selectedClassroom}/comparison`);
      setComparisonData(res.data);
    } catch (error) {
      toast.error('Failed to load comparison data');
      console.error(error);
    } finally {
      setComparisonLoading(false);
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
  
  const handleCreateQuest = async () => {
    if (!questForm.title || !questForm.due_date) {
      toast.error('Please fill title and due date');
      return;
    }
    
    // Calculate total reward points
    const totalQuestPoints = questForm.questions.reduce((sum, q) => sum + (q.points || 0), 0);
    
    // If no questions, base reward is mandatory
    if (questForm.questions.length === 0 && (!questForm.reward_amount || questForm.reward_amount <= 0)) {
      toast.error('Please add questions or set a reward amount');
      return;
    }
    
    // If there are questions, each must have reward points
    if (questForm.questions.length > 0) {
      const missingPoints = questForm.questions.some(q => !q.points || q.points <= 0);
      if (missingPoints) {
        toast.error('Each question must have reward points');
        return;
      }
      
      // Also check each question has correct answer set
      const missingAnswer = questForm.questions.some(q => {
        if (q.question_type === 'multi_select') {
          return !Array.isArray(q.correct_answer) || q.correct_answer.length === 0;
        }
        return !q.correct_answer || q.correct_answer === '';
      });
      if (missingAnswer) {
        toast.error('Each question must have a correct answer selected');
        return;
      }
    }
    
    try {
      if (editingQuest) {
        await axios.put(`${API}/teacher/quests/${editingQuest.quest_id}`, questForm);
        toast.success('Quest updated!');
      } else {
        await axios.post(`${API}/teacher/quests`, questForm);
        toast.success('Quest created! Students will be notified.');
      }
      setShowCreateQuest(false);
      resetQuestForm();
      fetchDashboard();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save quest');
    }
  };
  
  const handleQuestFileUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const formDataUpload = new FormData();
    formDataUpload.append('file', file);
    
    try {
      const res = await axios.post(`${API}/upload/quest-asset`, formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setQuestForm(prev => ({ ...prev, [type]: res.data.url }));
      toast.success(`${type === 'image_url' ? 'Image' : 'PDF'} uploaded!`);
    } catch (error) {
      toast.error('Upload failed');
    }
  };
  
  const addQuestion = () => {
    setQuestForm(prev => ({
      ...prev,
      questions: [
        ...prev.questions,
        {
          question_id: `q_${Date.now()}`,
          question_text: '',
          question_type: 'mcq',
          options: ['', '', '', ''],
          correct_answer: '',
          points: ''
        }
      ]
    }));
  };
  
  const updateQuestion = (index, field, value) => {
    setQuestForm(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => 
        i === index ? { ...q, [field]: value } : q
      )
    }));
  };
  
  const updateOption = (qIndex, oIndex, value) => {
    setQuestForm(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => 
        i === qIndex ? { ...q, options: q.options.map((o, j) => j === oIndex ? value : o) } : q
      )
    }));
  };
  
  const removeQuestion = (index) => {
    setQuestForm(prev => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index)
    }));
  };
  
  const handleDeleteQuest = async (questId) => {
    if (!window.confirm('Delete this quest?')) return;
    try {
      await axios.delete(`${API}/teacher/quests/${questId}`);
      toast.success('Quest deleted');
      fetchDashboard();
    } catch (error) {
      toast.error('Failed to delete quest');
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
                          <span className="font-bold text-[#1D3557]">{classroom.join_code || classroom.invite_code}</span>
                          <button onClick={(e) => { e.stopPropagation(); copyInviteCode(classroom.join_code || classroom.invite_code); }}>
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
                          <span className="font-bold text-lg">{classroomDetails.classroom.join_code || classroomDetails.classroom.invite_code}</span>
                          <button onClick={() => copyInviteCode(classroomDetails.classroom.join_code || classroomDetails.classroom.invite_code)}>
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
                  
                  <Dialog open={showCreateQuest} onOpenChange={(open) => { setShowCreateQuest(open); if (!open) resetQuestForm(); }}>
                    <DialogTrigger asChild>
                      <button className="btn-secondary flex-1 py-3 flex items-center justify-center gap-2" data-testid="create-quest-btn">
                        <Target className="w-5 h-5" /> Create Quest
                      </button>
                    </DialogTrigger>
                    <DialogContent className="bg-white border-3 border-[#1D3557] rounded-3xl max-w-2xl max-h-[85vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>{editingQuest ? 'Edit Quest' : 'Create Quest'}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 mt-4">
                        <Input 
                          placeholder="Quest Title *" 
                          value={questForm.title} 
                          onChange={(e) => setQuestForm({...questForm, title: e.target.value})}
                          className="border-3 border-[#1D3557]"
                        />
                        <Textarea 
                          placeholder="Description (optional)" 
                          value={questForm.description} 
                          onChange={(e) => setQuestForm({...questForm, description: e.target.value})}
                          className="border-3 border-[#1D3557]"
                          rows={2}
                        />
                        
                        {/* File Uploads */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-bold text-[#1D3557] mb-1 block">Image (optional)</label>
                            <Input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleQuestFileUpload(e, 'image_url')}
                              className="border-2 border-[#1D3557]/30"
                            />
                            {questForm.image_url && (
                              <img src={getAssetUrl(questForm.image_url)} alt="Preview" className="mt-2 h-16 rounded-lg" />
                            )}
                          </div>
                          <div>
                            <label className="text-sm font-bold text-[#1D3557] mb-1 block">PDF (optional)</label>
                            <Input
                              type="file"
                              accept=".pdf"
                              onChange={(e) => handleQuestFileUpload(e, 'pdf_url')}
                              className="border-2 border-[#1D3557]/30"
                            />
                            {questForm.pdf_url && (
                              <p className="text-sm text-green-600 mt-1">✓ PDF uploaded</p>
                            )}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-bold text-[#1D3557] mb-1 block">Due Date *</label>
                            <Input 
                              type="date" 
                              value={questForm.due_date} 
                              onChange={(e) => setQuestForm({...questForm, due_date: e.target.value})}
                              min={new Date().toISOString().split('T')[0]}
                              className="border-3 border-[#1D3557]"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-bold text-[#1D3557] mb-1 block">Base Reward (₹)</label>
                            <Input 
                              type="number" 
                              min="0"
                              placeholder="0 if using questions"
                              value={questForm.reward_amount || ''} 
                              onChange={(e) => setQuestForm({...questForm, reward_amount: parseFloat(e.target.value) || 0})}
                              className="border-3 border-[#1D3557]"
                            />
                            <p className="text-xs text-[#3D5A80] mt-1">For quests without questions</p>
                          </div>
                        </div>
                        
                        {/* Questions */}
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <label className="text-sm font-bold text-[#1D3557]">
                              Questions ({questForm.questions.length}) {questForm.questions.length > 0 && `- Total: ₹${questForm.questions.reduce((sum, q) => sum + (parseFloat(q.points) || 0), 0)}`}
                            </label>
                            <button type="button" onClick={addQuestion} className="text-sm text-[#06D6A0] hover:underline font-bold">
                              + Add Question
                            </button>
                          </div>
                          
                          {questForm.questions.length === 0 && (
                            <p className="text-sm text-[#3D5A80] bg-[#E0FBFC] p-3 rounded-lg">
                              No questions added. Students will complete the quest and earn the base reward.
                            </p>
                          )}
                          
                          <div className="space-y-4 max-h-60 overflow-y-auto">
                            {questForm.questions.map((q, qIndex) => (
                              <div key={q.question_id} className="bg-[#E0FBFC] rounded-xl p-3 border-2 border-[#1D3557]/20">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-bold text-[#3D5A80]">Q{qIndex + 1}</span>
                                  <button onClick={() => removeQuestion(qIndex)} className="text-[#EE6C4D] text-sm">Remove</button>
                                </div>
                                
                                <Input 
                                  placeholder="Question text" 
                                  value={q.question_text} 
                                  onChange={(e) => updateQuestion(qIndex, 'question_text', e.target.value)}
                                  className="border-2 border-[#1D3557]/30 mb-2"
                                />
                                
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                  <Select value={q.question_type} onValueChange={(v) => {
                                    updateQuestion(qIndex, 'question_type', v);
                                    // Reset correct_answer when type changes
                                    if (v === 'true_false') {
                                      updateQuestion(qIndex, 'correct_answer', '');
                                    } else if (v === 'multi_select') {
                                      updateQuestion(qIndex, 'correct_answer', []);
                                    } else {
                                      updateQuestion(qIndex, 'correct_answer', '');
                                    }
                                  }}>
                                    <SelectTrigger className="border-2 border-[#1D3557]/30">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="mcq">Multiple Choice</SelectItem>
                                      <SelectItem value="multi_select">Multi-Select</SelectItem>
                                      <SelectItem value="true_false">True/False</SelectItem>
                                      <SelectItem value="value">Number Entry</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <Input 
                                    type="number" 
                                    min="1"
                                    placeholder="Reward (₹) *" 
                                    value={q.points || ''} 
                                    onChange={(e) => updateQuestion(qIndex, 'points', parseInt(e.target.value) || 0)}
                                    className="border-2 border-[#1D3557]/30"
                                  />
                                </div>
                                
                                {/* MCQ Options with Radio for correct answer */}
                                {q.question_type === 'mcq' && (
                                  <div className="space-y-2">
                                    <label className="text-xs text-[#3D5A80] font-medium">Options (select correct answer):</label>
                                    {['A', 'B', 'C', 'D'].map((label, oIndex) => (
                                      <div key={label} className="flex items-center gap-2">
                                        <input
                                          type="radio"
                                          name={`mcq_teacher_${q.question_id}`}
                                          checked={q.correct_answer === label}
                                          onChange={() => updateQuestion(qIndex, 'correct_answer', label)}
                                          className="w-4 h-4 text-[#06D6A0]"
                                        />
                                        <span className="font-bold text-[#1D3557] w-6">{label}.</span>
                                        <Input
                                          value={q.options?.[oIndex] || ''}
                                          onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                                          placeholder={`Option ${label}`}
                                          className="flex-1 border-2 border-[#1D3557]/30"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                )}
                                
                                {/* Multi-Select Options with Checkboxes */}
                                {q.question_type === 'multi_select' && (
                                  <div className="space-y-2">
                                    <label className="text-xs text-[#3D5A80] font-medium">Options (select all correct answers):</label>
                                    {['A', 'B', 'C', 'D'].map((label, oIndex) => (
                                      <div key={label} className="flex items-center gap-2">
                                        <input
                                          type="checkbox"
                                          checked={Array.isArray(q.correct_answer) && q.correct_answer.includes(label)}
                                          onChange={(e) => {
                                            const current = Array.isArray(q.correct_answer) ? q.correct_answer : [];
                                            if (e.target.checked) {
                                              updateQuestion(qIndex, 'correct_answer', [...current, label].sort());
                                            } else {
                                              updateQuestion(qIndex, 'correct_answer', current.filter(a => a !== label));
                                            }
                                          }}
                                          className="w-4 h-4 text-[#06D6A0]"
                                        />
                                        <span className="font-bold text-[#1D3557] w-6">{label}.</span>
                                        <Input
                                          value={q.options?.[oIndex] || ''}
                                          onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                                          placeholder={`Option ${label}`}
                                          className="flex-1 border-2 border-[#1D3557]/30"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                )}
                                
                                {/* True/False Radio Buttons */}
                                {q.question_type === 'true_false' && (
                                  <div className="space-y-2">
                                    <label className="text-xs text-[#3D5A80] font-medium">Select correct answer:</label>
                                    <div className="flex gap-6">
                                      <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                          type="radio"
                                          name={`tf_teacher_${q.question_id}`}
                                          checked={q.correct_answer === 'True'}
                                          onChange={() => updateQuestion(qIndex, 'correct_answer', 'True')}
                                          className="w-5 h-5 text-green-600"
                                        />
                                        <span className="font-bold text-green-600">True</span>
                                      </label>
                                      <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                          type="radio"
                                          name={`tf_teacher_${q.question_id}`}
                                          checked={q.correct_answer === 'False'}
                                          onChange={() => updateQuestion(qIndex, 'correct_answer', 'False')}
                                          className="w-5 h-5 text-red-600"
                                        />
                                        <span className="font-bold text-red-600">False</span>
                                      </label>
                                    </div>
                                  </div>
                                )}
                                
                                {/* Value Entry - Number with 2 decimal places */}
                                {q.question_type === 'value' && (
                                  <div>
                                    <label className="text-xs text-[#3D5A80] font-medium">Correct Answer (number):</label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={q.correct_answer || ''}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        // Allow up to 2 decimal places
                                        if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
                                          updateQuestion(qIndex, 'correct_answer', val);
                                        }
                                      }}
                                      placeholder="Enter the correct number"
                                      className="mt-1 border-2 border-[#1D3557]/30"
                                    />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <button onClick={handleCreateQuest} className="btn-primary w-full py-3">{editingQuest ? 'Update Quest' : 'Create Quest'}</button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  
                  <Dialog open={showAnnouncement} onOpenChange={setShowAnnouncement}>
                    <DialogTrigger asChild>
                      <button className="btn-secondary flex-1 py-3 flex items-center justify-center gap-2">
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
                
                {/* Learning Content Link - Grade specific */}
                <Link 
                  to={`/learn?grade=${classroomDetails.classroom.grade_level}`}
                  className="mb-6 block bg-gradient-to-r from-[#FFD23F] to-[#FFEB99] rounded-xl p-5 hover:shadow-lg transition-shadow border-3 border-[#1D3557]"
                  data-testid="teacher-learn-link"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white rounded-xl border-3 border-[#1D3557] flex items-center justify-center">
                        <BookOpen className="w-6 h-6 text-[#1D3557]" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-[#1D3557]">Learning Content</h3>
                        <p className="text-[#1D3557]/80 text-sm">
                          View {gradeLabels[classroomDetails.classroom.grade_level]} lessons and content
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-6 h-6 text-[#1D3557]" />
                  </div>
                </Link>
                
                {/* My Quests Section */}
                {teacherQuests.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-xl font-bold text-[#1D3557] mb-4" style={{ fontFamily: 'Fredoka' }}>
                      <Target className="w-5 h-5 inline mr-2" />
                      My Quests ({teacherQuests.length})
                    </h3>
                    <div className="space-y-3">
                      {teacherQuests.map((quest) => (
                        <div key={quest.quest_id} className="card-playful p-4 bg-[#06D6A0]/10">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-bold text-[#1D3557]">{quest.title}</h4>
                              <p className="text-sm text-[#3D5A80] mt-1">{quest.description}</p>
                              <div className="flex items-center gap-4 mt-2 text-xs text-[#3D5A80]">
                                <span>₹{quest.total_points || quest.reward_amount || 0} total</span>
                                <span>
                                  {quest.questions?.length > 0 
                                    ? `${quest.questions.length} ${quest.questions[0]?.question_type === 'mcq' ? 'MCQ' : quest.questions[0]?.question_type === 'multi_select' ? 'Multi-select' : 'Text'} question${quest.questions.length > 1 ? 's' : ''}`
                                    : 'No questions'}
                                </span>
                                <span>Due: {quest.due_date ? new Date(quest.due_date).toLocaleDateString() : 'Not set'}</span>
                              </div>
                              {/* Attachment indicators */}
                              <div className="flex items-center gap-2 mt-2">
                                {quest.image_url && (
                                  <span className="text-xs bg-[#9B5DE5]/20 text-[#9B5DE5] px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <ImageIcon className="w-3 h-3" /> Image added
                                  </span>
                                )}
                                {quest.pdf_url && (
                                  <span className="text-xs bg-[#EE6C4D]/20 text-[#EE6C4D] px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <FileText className="w-3 h-3" /> PDF added
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => openEditQuest(quest)}
                                className="p-2 hover:bg-[#3D5A80]/20 rounded-lg text-[#3D5A80]"
                                data-testid={`edit-quest-${quest.quest_id}`}
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDeleteQuest(quest.quest_id)}
                                className="p-2 hover:bg-[#EE6C4D]/20 rounded-lg text-[#EE6C4D]"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
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
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
                    Students ({classroomDetails.students.length})
                  </h3>
                  {classroomDetails.students.length > 0 && (
                    <button
                      onClick={fetchComparisonData}
                      className="flex items-center gap-2 px-4 py-2 bg-[#3D5A80] text-white rounded-xl hover:bg-[#1D3557] transition-colors"
                      data-testid="compare-students-btn"
                    >
                      <BarChart3 className="w-4 h-4" />
                      Compare All
                    </button>
                  )}
                </div>
                
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
                            src={student.picture || getDefaultAvatar('child', student.name)} 
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
                            onClick={() => fetchStudentInsights(student)}
                            className="p-2 rounded-lg hover:bg-[#E0FBFC]"
                            data-testid={`view-student-${student.user_id}`}
                          >
                            <Eye className="w-5 h-5 text-[#3D5A80]" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
        
        {/* Student Insights Modal */}
        <Dialog open={!!showStudentProgress} onOpenChange={() => { setShowStudentProgress(null); setStudentInsights(null); }}>
          <DialogContent className="bg-white border-3 border-[#1D3557] rounded-3xl max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-[#1D3557] flex items-center gap-3" style={{ fontFamily: 'Fredoka' }}>
                <img 
                  src={showStudentProgress?.avatar || `https://api.dicebear.com/7.x/thumbs/svg?seed=${showStudentProgress?.name}`} 
                  alt="" 
                  className="w-10 h-10 rounded-full border-2 border-[#1D3557]"
                />
                {showStudentProgress?.name}&apos;s Insights
              </DialogTitle>
            </DialogHeader>
            
            {insightsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1D3557]"></div>
                <span className="ml-3 text-[#3D5A80]">Loading insights...</span>
              </div>
            ) : studentInsights ? (
              <div className="space-y-6 mt-4">
                {/* Quick Stats Row */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-[#FFD23F]/20 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-[#1D3557]">₹{studentInsights.wallet?.total_balance?.toFixed(0)}</p>
                    <p className="text-xs text-[#3D5A80]">Available Balance</p>
                  </div>
                  <div className="bg-[#06D6A0]/20 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-[#1D3557]">{studentInsights.learning?.lessons_completed}</p>
                    <p className="text-xs text-[#3D5A80]">Lessons Done</p>
                  </div>
                  <div className="bg-[#EE6C4D]/20 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-[#1D3557]">{studentInsights.student?.streak_count || 0}</p>
                    <p className="text-xs text-[#3D5A80]">Day Streak</p>
                  </div>
                  <div className="bg-[#3D5A80]/20 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-[#1D3557]">{studentInsights.achievements?.badges_earned || 0}</p>
                    <p className="text-xs text-[#3D5A80]">Badges</p>
                  </div>
                </div>

                {/* Money Jars - Now showing Balance & Spent */}
                <div className="bg-gradient-to-r from-[#FFD23F]/10 to-[#FFEB99]/10 rounded-xl p-4 border-2 border-[#FFD23F]/30">
                  <h4 className="font-bold text-[#1D3557] mb-3 flex items-center gap-2">
                    <Wallet className="w-5 h-5" /> Money Jars (Balance / Spent)
                  </h4>
                  <div className="grid grid-cols-4 gap-3">
                    {studentInsights.wallet?.accounts?.map((acc) => {
                      // Special handling for savings - show savings in goals
                      const isSavings = acc.account_type === 'savings';
                      const savedInGoals = studentInsights.wallet?.savings_in_goals || 0;
                      
                      return (
                        <div key={acc.account_type} className="bg-white rounded-lg p-3 border border-[#1D3557]/10">
                          <p className="text-xs text-[#3D5A80] capitalize mb-1">{acc.account_type}</p>
                          <p className="text-lg font-bold text-[#1D3557]">₹{acc.balance?.toFixed(0)}</p>
                          <p className="text-xs text-[#3D5A80]">available</p>
                          {isSavings ? (
                            <p className="text-xs mt-1">
                              <span className="text-green-600 font-medium">₹{savedInGoals?.toFixed(0)}</span>
                              <span className="text-[#3D5A80]"> in goals</span>
                            </p>
                          ) : (
                            <p className="text-xs mt-1">
                              <span className="text-red-500 font-medium">₹{acc.spent?.toFixed(0) || 0}</span>
                              <span className="text-[#3D5A80]"> spent</span>
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {studentInsights.wallet?.savings_goals_count > 0 && (
                    <p className="text-xs text-[#3D5A80] mt-2 text-center">
                      {studentInsights.wallet.savings_goals_count} savings goal(s) active
                    </p>
                  )}
                  <div className="mt-3 pt-3 border-t border-[#1D3557]/10 grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-500" />
                      <span className="text-[#3D5A80]">Total Earned: </span>
                      <span className="font-bold text-green-600">₹{studentInsights.transactions?.total_earned?.toFixed(0)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-red-500" />
                      <span className="text-[#3D5A80]">Total Spent: </span>
                      <span className="font-bold text-red-600">₹{studentInsights.transactions?.total_spent?.toFixed(0)}</span>
                    </div>
                  </div>
                </div>

                {/* Chores & Quests */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#06D6A0]/10 rounded-xl p-4 border-2 border-[#06D6A0]/30">
                    <h4 className="font-bold text-[#1D3557] mb-3 flex items-center gap-2">
                      <Target className="w-5 h-5" /> Parent Chores
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[#3D5A80]">Assigned:</span>
                        <span className="font-bold text-[#1D3557]">{studentInsights.chores?.total_assigned}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#3D5A80] flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-500" /> Completed:</span>
                        <span className="font-bold text-green-600">{studentInsights.chores?.completed}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#3D5A80] flex items-center gap-1"><Clock className="w-3 h-3 text-yellow-500" /> Pending:</span>
                        <span className="font-bold text-yellow-600">{studentInsights.chores?.pending}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#3D5A80] flex items-center gap-1"><XCircle className="w-3 h-3 text-red-500" /> Rejected:</span>
                        <span className="font-bold text-red-600">{studentInsights.chores?.rejected}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-[#EE6C4D]/10 rounded-xl p-4 border-2 border-[#EE6C4D]/30">
                    <h4 className="font-bold text-[#1D3557] mb-3 flex items-center gap-2">
                      <Star className="w-5 h-5" /> Teacher Quests
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[#3D5A80]">Assigned:</span>
                        <span className="font-bold text-[#1D3557]">{studentInsights.quests?.total_assigned}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#3D5A80]">Completed:</span>
                        <span className="font-bold text-green-600">{studentInsights.quests?.completed}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#3D5A80]">Completion Rate:</span>
                        <span className="font-bold text-[#1D3557]">{studentInsights.quests?.completion_rate}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Gift Activity */}
                <div className="bg-[#EE6C4D]/10 rounded-xl p-4 border-2 border-[#EE6C4D]/30">
                  <h4 className="font-bold text-[#1D3557] mb-3 flex items-center gap-2">
                    <Gift className="w-5 h-5" /> Gift Activity
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="bg-white rounded-lg p-3">
                      <p className="text-[#3D5A80]">Gifts Received</p>
                      <p className="text-lg font-bold text-green-600">
                        {studentInsights.gifts?.received_count} (₹{studentInsights.gifts?.received_total?.toFixed(0)})
                      </p>
                    </div>
                    <div className="bg-white rounded-lg p-3">
                      <p className="text-[#3D5A80]">Gifts Sent</p>
                      <p className="text-lg font-bold text-[#EE6C4D]">
                        {studentInsights.gifts?.sent_count} (₹{studentInsights.gifts?.sent_total?.toFixed(0)})
                      </p>
                    </div>
                  </div>
                </div>

                {/* Investments - Grade-based display */}
                {/* K (grade 0): No investments, 1-2: Garden only, 3-5: Stocks only */}
                {studentInsights.student?.grade >= 1 && (
                  <div className="grid grid-cols-1 gap-4">
                    {/* Money Garden - Show for grades 1-2 only */}
                    {studentInsights.student?.grade >= 1 && studentInsights.student?.grade <= 2 && (
                      <div className="bg-green-50 rounded-xl p-4 border-2 border-green-200">
                        <h4 className="font-bold text-[#1D3557] mb-3 flex items-center gap-2">
                          <Sprout className="w-5 h-5 text-green-600" /> Money Garden
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div className="text-center">
                            <span className="text-[#3D5A80] block">Plots Owned</span>
                            <span className="font-bold text-lg">{studentInsights.garden?.plots_owned || 0}</span>
                          </div>
                          <div className="text-center">
                            <span className="text-[#3D5A80] block">Total Invested</span>
                            <span className="font-bold text-lg">₹{studentInsights.garden?.total_invested?.toFixed(0) || 0}</span>
                          </div>
                          <div className="text-center">
                            <span className="text-[#3D5A80] block">Total Earned</span>
                            <span className="font-bold text-lg text-green-600">₹{studentInsights.garden?.total_earned?.toFixed(0) || 0}</span>
                          </div>
                          <div className="text-center">
                            <span className="text-[#3D5A80] block">Profit/Loss</span>
                            <span className={`font-bold text-lg ${(studentInsights.garden?.profit_loss || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {(studentInsights.garden?.profit_loss || 0) >= 0 ? '+' : ''}₹{studentInsights.garden?.profit_loss?.toFixed(0) || 0}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Stock Market - Show for grades 3-5 only */}
                    {studentInsights.student?.grade >= 3 && studentInsights.student?.grade <= 5 && (
                      <div className="bg-blue-50 rounded-xl p-4 border-2 border-blue-200">
                        <h4 className="font-bold text-[#1D3557] mb-3 flex items-center gap-2">
                          <LineChart className="w-5 h-5 text-blue-600" /> Stock Market
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div className="text-center">
                            <span className="text-[#3D5A80] block">Holdings</span>
                            <span className="font-bold text-lg">{studentInsights.stocks?.holdings_count || 0}</span>
                          </div>
                          <div className="text-center">
                            <span className="text-[#3D5A80] block">Portfolio Value</span>
                            <span className="font-bold text-lg">₹{studentInsights.stocks?.portfolio_value?.toFixed(0) || 0}</span>
                          </div>
                          <div className="text-center">
                            <span className="text-[#3D5A80] block">Realized Gains</span>
                            <span className={`font-bold text-lg ${(studentInsights.stocks?.realized_gains || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {(studentInsights.stocks?.realized_gains || 0) >= 0 ? '+' : ''}₹{studentInsights.stocks?.realized_gains?.toFixed(0) || 0}
                            </span>
                          </div>
                          <div className="text-center">
                            <span className="text-[#3D5A80] block">Unrealized P/L</span>
                            <span className={`font-bold text-lg ${(studentInsights.stocks?.unrealized_gains || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {(studentInsights.stocks?.unrealized_gains || 0) >= 0 ? '+' : ''}₹{studentInsights.stocks?.unrealized_gains?.toFixed(0) || 0}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Learning Progress */}
                <div className="bg-[#3D5A80]/10 rounded-xl p-4 border-2 border-[#3D5A80]/30">
                  <h4 className="font-bold text-[#1D3557] mb-3 flex items-center gap-2">
                    <BookOpen className="w-5 h-5" /> Learning Progress
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-[#3D5A80]">Lessons Completed:</span>
                      <span className="font-bold">{studentInsights.learning?.lessons_completed} / {studentInsights.learning?.total_lessons}</span>
                    </div>
                    <Progress 
                      value={studentInsights.learning?.completion_percentage} 
                      className="h-3"
                    />
                    <p className="text-center text-sm font-bold text-[#1D3557]">
                      {studentInsights.learning?.completion_percentage}% Complete
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-[#3D5A80]">
                No insights available
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Comparison Table Modal */}
        <Dialog open={showComparison} onOpenChange={setShowComparison}>
          <DialogContent className="bg-white border-3 border-[#1D3557] rounded-3xl max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-[#1D3557] flex items-center gap-2" style={{ fontFamily: 'Fredoka' }}>
                <BarChart3 className="w-6 h-6" />
                Student Comparison - {comparisonData?.classroom?.name}
              </DialogTitle>
            </DialogHeader>
            
            {comparisonLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1D3557]"></div>
                <span className="ml-3 text-[#3D5A80]">Loading comparison data...</span>
              </div>
            ) : comparisonData?.students?.length > 0 ? (
              <div className="overflow-auto flex-1">
                <table className="w-full text-xs">
                  <thead className="bg-[#3D5A80] text-white sticky top-0">
                    <tr>
                      <th className="px-2 py-2 text-left whitespace-nowrap">Student</th>
                      <th className="px-2 py-2 text-right whitespace-nowrap">Total Balance</th>
                      <th className="px-2 py-2 text-center whitespace-nowrap" colSpan="2">Spending</th>
                      <th className="px-2 py-2 text-center whitespace-nowrap" colSpan="2">Savings</th>
                      <th className="px-2 py-2 text-center whitespace-nowrap" colSpan="2">Gifting</th>
                      <th className="px-2 py-2 text-center whitespace-nowrap" colSpan="2">Investing</th>
                      <th className="px-2 py-2 text-center whitespace-nowrap">Chores</th>
                      <th className="px-2 py-2 text-center whitespace-nowrap">Quests</th>
                      <th className="px-2 py-2 text-center whitespace-nowrap">Lessons</th>
                      <th className="px-2 py-2 text-right whitespace-nowrap">Garden P/L</th>
                      <th className="px-2 py-2 text-right whitespace-nowrap">Stock P/L</th>
                      <th className="px-2 py-2 text-center whitespace-nowrap">Gifts</th>
                      <th className="px-2 py-2 text-center whitespace-nowrap">Badges</th>
                      <th className="px-2 py-2 text-center whitespace-nowrap">Streak</th>
                    </tr>
                    <tr className="bg-[#3D5A80]/80 text-white/80 text-[10px]">
                      <th className="px-2 py-1"></th>
                      <th className="px-2 py-1"></th>
                      <th className="px-2 py-1 text-center">Avail</th>
                      <th className="px-2 py-1 text-center">Spent</th>
                      <th className="px-2 py-1 text-center">Avail</th>
                      <th className="px-2 py-1 text-center">Goals</th>
                      <th className="px-2 py-1 text-center">Avail</th>
                      <th className="px-2 py-1 text-center">Sent</th>
                      <th className="px-2 py-1 text-center">Avail</th>
                      <th className="px-2 py-1 text-center">Spent</th>
                      <th className="px-2 py-1"></th>
                      <th className="px-2 py-1"></th>
                      <th className="px-2 py-1"></th>
                      <th className="px-2 py-1"></th>
                      <th className="px-2 py-1"></th>
                      <th className="px-2 py-1"></th>
                      <th className="px-2 py-1"></th>
                      <th className="px-2 py-1"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonData.students.map((student, idx) => (
                      <tr 
                        key={student.student_id} 
                        className={`border-b hover:bg-[#E0FBFC] ${idx === 0 ? 'bg-[#FFD23F]/20' : ''}`}
                      >
                        <td className="px-2 py-2 flex items-center gap-1">
                          <img 
                            src={student.avatar || `https://api.dicebear.com/7.x/thumbs/svg?seed=${student.name}`}
                            alt=""
                            className="w-5 h-5 rounded-full"
                          />
                          <span className="font-medium truncate max-w-[80px]">{student.name}</span>
                          {idx === 0 && <span className="text-yellow-500">👑</span>}
                        </td>
                        <td className="px-2 py-2 text-right font-bold">₹{student.total_balance}</td>
                        <td className="px-2 py-2 text-right">₹{student.spending_balance}</td>
                        <td className="px-2 py-2 text-right text-red-500">₹{student.spending_spent || 0}</td>
                        <td className="px-2 py-2 text-right">₹{student.savings_balance}</td>
                        <td className="px-2 py-2 text-right text-green-600">₹{student.savings_in_goals || 0}</td>
                        <td className="px-2 py-2 text-right">₹{student.gifting_balance}</td>
                        <td className="px-2 py-2 text-right text-red-500">₹{student.gifting_spent || 0}</td>
                        <td className="px-2 py-2 text-right">₹{student.investing_balance}</td>
                        <td className="px-2 py-2 text-right text-red-500">₹{student.investing_spent || 0}</td>
                        <td className="px-2 py-2 text-center">{student.chores_completed}</td>
                        <td className="px-2 py-2 text-center">{student.quests_completed}</td>
                        <td className="px-2 py-2 text-center">{student.lessons_completed}</td>
                        <td className={`px-2 py-2 text-right ${student.garden_pl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {student.garden_pl >= 0 ? '+' : ''}₹{student.garden_pl}
                        </td>
                        <td className={`px-2 py-2 text-right ${student.stock_pl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {student.stock_pl >= 0 ? '+' : ''}₹{student.stock_pl}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <span className="text-green-600">{student.gifts_received}↓</span>
                          <span className="mx-0.5">/</span>
                          <span className="text-red-600">{student.gifts_sent}↑</span>
                        </td>
                        <td className="px-2 py-2 text-center">{student.badges}</td>
                        <td className="px-2 py-2 text-center">
                          {student.streak > 0 && <span className="text-orange-500">🔥</span>}
                          {student.streak}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-[#3D5A80]">
                No students to compare
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
