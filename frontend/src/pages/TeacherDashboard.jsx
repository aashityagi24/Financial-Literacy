import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  BarChart3, Image as ImageIcon, FileText, Search, FolderOpen, Filter
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
  const [studentSearch, setStudentSearch] = useState('');
  
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
  
  // Repository picker state
  const [showRepositoryPicker, setShowRepositoryPicker] = useState(false);
  const [repositoryItems, setRepositoryItems] = useState([]);
  const [repositoryTopics, setRepositoryTopics] = useState([]);
  const [repositorySubtopics, setRepositorySubtopics] = useState([]);
  const [repoFilterTopic, setRepoFilterTopic] = useState('');
  const [repoFilterSubtopic, setRepoFilterSubtopic] = useState('');
  const [repoFilterType, setRepoFilterType] = useState('');
  const [repoSearch, setRepoSearch] = useState('');
  const [pickingFor, setPickingFor] = useState(null); // 'image' or 'pdf'
  const [comparisonLoading, setComparisonLoading] = useState(false);
  
  // Quest Responses
  const [showQuestResponses, setShowQuestResponses] = useState(false);
  const [questResponses, setQuestResponses] = useState(null);
  const [responsesLoading, setResponsesLoading] = useState(false);
  const [selectedResponseStudent, setSelectedResponseStudent] = useState(null);
  
  const [classForm, setClassForm] = useState({ name: '', description: '', grade_level: 3 });
  const [rewardForm, setRewardForm] = useState({ student_ids: [], amount: 10, reason: '', category: 'reward' });
  const [announcementForm, setAnnouncementForm] = useState({ title: '', message: '' });
  const [questForm, setQuestForm] = useState({
    title: '',
    description: '',
    image_url: '',
    pdf_url: '',
    reward_amount: 0,
    due_date: '',
    classroom_id: '',
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
      classroom_id: '',
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
      classroom_id: quest.classroom_id || '',
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
    
    if (!rewardForm.reason.trim()) {
      toast.error(`Please provide a reason for the ${rewardForm.category}`);
      return;
    }
    
    if (!rewardForm.amount || rewardForm.amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    const isReward = rewardForm.category === 'reward';
    
    try {
      // Use the new reward-penalty endpoint for individual students
      for (const studentId of rewardForm.student_ids) {
        await axios.post(`${API}/teacher/reward-penalty`, {
          student_id: studentId,
          amount: rewardForm.amount,
          title: rewardForm.reason,
          category: rewardForm.category
        });
      }
      toast.success(`${isReward ? 'Rewards' : 'Penalties'} applied to ${rewardForm.student_ids.length} student(s)!`);
      setShowReward(false);
      setRewardForm({ student_ids: [], amount: 10, reason: '', category: 'reward' });
      fetchClassroomDetails(selectedClassroom);
    } catch (error) {
      toast.error(`Failed to apply ${isReward ? 'reward' : 'penalty'}`);
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
  
  // Repository functions
  const fetchRepository = async () => {
    try {
      let url = `${API}/teacher/repository?`;
      if (repoFilterTopic) url += `topic_id=${repoFilterTopic}&`;
      if (repoFilterSubtopic) url += `subtopic_id=${repoFilterSubtopic}&`;
      if (repoFilterType) url += `file_type=${repoFilterType}&`;
      
      // Filter by classroom grade level
      if (classroomDetails?.classroom?.grade_level !== undefined) {
        url += `grade=${classroomDetails.classroom.grade_level}&`;
      }
      
      const res = await axios.get(url);
      setRepositoryItems(res.data.items || []);
      setRepositoryTopics(res.data.topics || []);
    } catch (error) {
      console.error('Failed to fetch repository:', error);
    }
  };
  
  const fetchRepoSubtopics = async (topicId) => {
    if (!topicId) {
      setRepositorySubtopics([]);
      return;
    }
    try {
      const res = await axios.get(`${API}/teacher/repository/subtopics/${topicId}`);
      setRepositorySubtopics(res.data.subtopics || []);
    } catch (error) {
      console.error('Failed to fetch subtopics:', error);
    }
  };
  
  const openRepositoryPicker = (forField) => {
    setPickingFor(forField);
    setShowCreateQuest(false); // Close parent dialog to allow repository picker interaction
    setShowRepositoryPicker(true);
    fetchRepository();
  };
  
  const selectFromRepository = (item) => {
    if (pickingFor === 'image') {
      setQuestForm(prev => ({ ...prev, image_url: item.file_url }));
    } else if (pickingFor === 'pdf') {
      setQuestForm(prev => ({ ...prev, pdf_url: item.file_url }));
    }
    setShowRepositoryPicker(false);
    setPickingFor(null);
    setShowCreateQuest(true); // Re-open the create quest dialog
    toast.success(`${item.file_type === 'image' ? 'Image' : 'PDF'} selected from repository`);
  };
  
  const filteredRepoItems = repositoryItems.filter(item => {
    // Filter by type based on what we're picking for
    if (pickingFor === 'image' && item.file_type !== 'image') return false;
    if (pickingFor === 'pdf' && item.file_type !== 'pdf') return false;
    
    // Filter by search
    if (repoSearch) {
      const query = repoSearch.toLowerCase();
      return item.title.toLowerCase().includes(query) ||
             item.description?.toLowerCase().includes(query) ||
             item.tags?.some(t => t.toLowerCase().includes(query));
    }
    return true;
  });
  
  const handleCreateQuest = async () => {
    // Debug log
    console.log('Quest form:', questForm);
    
    if (!questForm.title?.trim()) {
      toast.error('Please fill in the quest title');
      return;
    }
    
    if (!questForm.due_date) {
      toast.error('Please select a due date');
      return;
    }
    
    // Auto-set classroom_id if not set (should be set from selectedClassroom)
    const formToSubmit = {
      ...questForm,
      classroom_id: questForm.classroom_id || selectedClassroom
    };
    
    if (!formToSubmit.classroom_id) {
      toast.error('Classroom not found. Please try again.');
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
        await axios.put(`${API}/teacher/quests/${editingQuest.quest_id}`, formToSubmit);
        toast.success('Quest updated!');
      } else {
        await axios.post(`${API}/teacher/quests`, formToSubmit);
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
  
  const fetchQuestResponses = async (questId) => {
    setResponsesLoading(true);
    setShowQuestResponses(true);
    setSelectedResponseStudent(null);
    try {
      const res = await axios.get(`${API}/teacher/quests/${questId}/responses`);
      setQuestResponses(res.data);
    } catch (error) {
      toast.error('Failed to load quest responses');
      setShowQuestResponses(false);
    } finally {
      setResponsesLoading(false);
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
                <span className="text-sm font-medium text-white">
                  {user?.name || 'Teacher'}
                  {user?.school_name && <span className="text-white/80"> • {user.school_name}</span>}
                </span>
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
            
            {/* Create Classroom Button - Only show if teacher is NOT connected to a school */}
            {!user?.school_id && (
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
            )}
            
            {/* Info message for school-connected teachers - removed per user request */}
            
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
                      {/* Delete button - Only show if teacher is NOT connected to a school */}
                      {!user?.school_id && (
                        <button 
                          onClick={() => handleDeleteClassroom(selectedClassroom)}
                          className="text-white/80 hover:text-white text-sm flex items-center gap-1"
                        >
                          <Trash2 className="w-4 h-4" /> Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex gap-3 mb-6">
                  <Dialog open={showReward} onOpenChange={setShowReward}>
                    <DialogTrigger asChild>
                      <button className="btn-secondary flex-1 py-3 flex items-center justify-center gap-2">
                        <Gift className="w-5 h-5" /> Reward / Penalty
                      </button>
                    </DialogTrigger>
                    <DialogContent className="bg-white border-3 border-[#1D3557] rounded-3xl">
                      <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
                          {rewardForm.category === 'reward' ? '🌟 Give Reward' : '⚠️ Apply Penalty'}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 mt-4">
                        {/* Category Toggle */}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setRewardForm({...rewardForm, category: 'reward'})}
                            className={`flex-1 py-2 rounded-lg font-bold transition-colors ${
                              rewardForm.category === 'reward' 
                                ? 'bg-[#06D6A0] text-white' 
                                : 'bg-gray-100 text-[#3D5A80]'
                            }`}
                          >
                            🌟 Reward
                          </button>
                          <button
                            type="button"
                            onClick={() => setRewardForm({...rewardForm, category: 'penalty'})}
                            className={`flex-1 py-2 rounded-lg font-bold transition-colors ${
                              rewardForm.category === 'penalty' 
                                ? 'bg-[#EE6C4D] text-white' 
                                : 'bg-gray-100 text-[#3D5A80]'
                            }`}
                          >
                            ⚠️ Penalty
                          </button>
                        </div>
                        
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
                            type="button"
                            onClick={() => setRewardForm({...rewardForm, student_ids: classroomDetails.students.map(s => s.user_id)})}
                            className="text-sm text-[#3D5A80] mt-2 hover:text-[#1D3557]"
                          >
                            Select All
                          </button>
                        </div>
                        <Input 
                          type="number"
                          placeholder="Amount (₹)" 
                          value={rewardForm.amount} 
                          onChange={(e) => setRewardForm({...rewardForm, amount: parseFloat(e.target.value) || 0})}
                          className="border-3 border-[#1D3557]"
                        />
                        <Input 
                          placeholder={rewardForm.category === 'reward' ? "Reason for reward *" : "Reason for penalty *"} 
                          value={rewardForm.reason} 
                          onChange={(e) => setRewardForm({...rewardForm, reason: e.target.value})}
                          className="border-3 border-[#1D3557]"
                        />
                        <button 
                          onClick={handleGiveReward} 
                          className={`w-full py-3 font-bold rounded-xl transition-colors ${
                            rewardForm.category === 'reward' 
                              ? 'bg-[#06D6A0] hover:bg-[#05c795] text-white' 
                              : 'bg-[#EE6C4D] hover:bg-[#e55939] text-white'
                          }`}
                        >
                          {rewardForm.category === 'reward' ? '🌟 Give Reward' : '⚠️ Apply Penalty'}
                        </button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  
                  <Dialog open={showCreateQuest} onOpenChange={(open) => { 
                    setShowCreateQuest(open); 
                    if (!open) resetQuestForm(); 
                    // Auto-set classroom_id when opening the dialog
                    if (open && selectedClassroom) {
                      setQuestForm(prev => ({ ...prev, classroom_id: selectedClassroom }));
                    }
                  }}>
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
                        {/* Show current classroom info instead of selection */}
                        {classroomDetails && (
                          <div className="bg-[#E0FBFC] rounded-lg p-3 border border-[#3D5A80]/20">
                            <p className="text-sm text-[#3D5A80]">
                              Creating quest for: <span className="font-bold text-[#1D3557]">{classroomDetails.classroom.name}</span>
                              {' '}({gradeLabels[classroomDetails.classroom.grade_level]})
                            </p>
                          </div>
                        )}
                        
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
                            <div className="space-y-2">
                              <Input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleQuestFileUpload(e, 'image_url')}
                                className="border-2 border-[#1D3557]/30"
                              />
                              <button 
                                type="button"
                                onClick={() => openRepositoryPicker('image')}
                                className="w-full px-3 py-2 text-sm bg-[#E0F7FA] hover:bg-[#B2EBF2] text-[#1D3557] rounded-lg flex items-center justify-center gap-2 border border-[#1D3557]/20"
                              >
                                <FolderOpen className="w-4 h-4" />
                                Select from Repository
                              </button>
                            </div>
                            {questForm.image_url && (
                              <div className="mt-2 relative">
                                <img src={getAssetUrl(questForm.image_url)} alt="Preview" className="h-16 rounded-lg" />
                                <button
                                  type="button"
                                  onClick={() => setQuestForm(prev => ({ ...prev, image_url: '' }))}
                                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                          <div>
                            <label className="text-sm font-bold text-[#1D3557] mb-1 block">PDF (optional)</label>
                            <div className="space-y-2">
                              <Input
                                type="file"
                                accept=".pdf"
                                onChange={(e) => handleQuestFileUpload(e, 'pdf_url')}
                                className="border-2 border-[#1D3557]/30"
                              />
                              <button 
                                type="button"
                                onClick={() => openRepositoryPicker('pdf')}
                                className="w-full px-3 py-2 text-sm bg-[#FFF3E0] hover:bg-[#FFE0B2] text-[#1D3557] rounded-lg flex items-center justify-center gap-2 border border-[#1D3557]/20"
                              >
                                <FolderOpen className="w-4 h-4" />
                                Select from Repository
                              </button>
                            </div>
                            {questForm.pdf_url && (
                              <div className="mt-2 flex items-center gap-2">
                                <p className="text-sm text-green-600">✓ PDF selected</p>
                                <button
                                  type="button"
                                  onClick={() => setQuestForm(prev => ({ ...prev, pdf_url: '' }))}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </div>
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
                      {teacherQuests.map((quest) => {
                        const questClassroom = (dashboard?.classrooms || []).find(c => c.classroom_id === quest.classroom_id);
                        return (
                        <div key={quest.quest_id} className="card-playful p-4 bg-[#06D6A0]/10">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-bold text-[#1D3557]">{quest.title}</h4>
                              {questClassroom && (
                                <span className="inline-block px-2 py-0.5 bg-[#3D5A80]/10 text-[#3D5A80] text-xs rounded-full mt-1">
                                  {questClassroom.name} (Grade {questClassroom.grade_level})
                                </span>
                              )}
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
                                onClick={() => fetchQuestResponses(quest.quest_id)}
                                className="p-2 hover:bg-[#3D5A80]/20 rounded-lg text-[#3D5A80]"
                                title="View Student Responses"
                                data-testid={`view-responses-${quest.quest_id}`}
                              >
                                <BarChart3 className="w-4 h-4" />
                              </button>
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
                      );
                      })}
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
                
                {/* Student Search */}
                {classroomDetails.students.length > 0 && (
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#3D5A80]" />
                    <Input
                      type="text"
                      placeholder="Search students by name..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="pl-10 py-2 h-10 text-base bg-white border-2 border-[#1D3557]/20 rounded-xl"
                      data-testid="teacher-student-search"
                    />
                  </div>
                )}
                
                {classroomDetails.students.length === 0 ? (
                  <div className="card-playful p-6 text-center mb-6">
                    <Users className="w-12 h-12 mx-auto text-[#98C1D9] mb-2" />
                    <p className="text-[#3D5A80]">No students yet. Share the invite code!</p>
                  </div>
                ) : (
                  <div className="space-y-3 mb-6">
                    {classroomDetails.students
                      .filter(s => s.name?.toLowerCase().includes(studentSearch.toLowerCase()))
                      .map((student) => (
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
                  src={showStudentProgress?.avatar || getDefaultAvatar('child', showStudentProgress?.name)} 
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
                      <th className="px-2 py-2 text-center whitespace-nowrap" colSpan="2">Piggy Bank</th>
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
                            src={student.avatar || getDefaultAvatar('child', student.name)}
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

        {/* Quest Responses Modal */}
        <Dialog open={showQuestResponses} onOpenChange={(open) => { setShowQuestResponses(open); if (!open) { setQuestResponses(null); setSelectedResponseStudent(null); }}}>
          <DialogContent className="bg-white border-3 border-[#1D3557] rounded-3xl max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-[#1D3557] flex items-center gap-2" style={{ fontFamily: 'Fredoka' }}>
                <BarChart3 className="w-6 h-6" />
                Quest Responses: {questResponses?.quest?.title}
              </DialogTitle>
            </DialogHeader>
            
            {responsesLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1D3557]"></div>
                <span className="ml-3 text-[#3D5A80]">Loading responses...</span>
              </div>
            ) : questResponses ? (
              <div className="flex-1 overflow-hidden flex flex-col">
                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4 p-3 bg-[#E0FBFC] rounded-xl">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-[#1D3557]">{questResponses.summary.total_responses}</div>
                    <div className="text-xs text-[#3D5A80]">Responses</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-[#06D6A0]">{questResponses.summary.average_percentage}%</div>
                    <div className="text-xs text-[#3D5A80]">Avg Score</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-[#06D6A0]">{questResponses.summary.pass_count}</div>
                    <div className="text-xs text-[#3D5A80]">Passed (≥60%)</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-[#EE6C4D]">{questResponses.summary.fail_count}</div>
                    <div className="text-xs text-[#3D5A80]">Failed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-[#3D5A80]">{questResponses.summary.pass_rate}%</div>
                    <div className="text-xs text-[#3D5A80]">Pass Rate</div>
                  </div>
                </div>

                {/* Two Column Layout */}
                <div className="flex-1 overflow-hidden flex gap-4">
                  {/* Left: Student List */}
                  <div className="w-1/3 flex flex-col overflow-hidden">
                    <h4 className="font-bold text-[#1D3557] mb-2 flex items-center gap-2">
                      <Users className="w-4 h-4" /> Students ({questResponses.responses.length})
                    </h4>
                    <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                      {questResponses.responses.length === 0 ? (
                        <p className="text-[#3D5A80] text-sm text-center py-4">No responses yet</p>
                      ) : (
                        questResponses.responses.map((response) => (
                          <button
                            key={response.user_id}
                            onClick={() => setSelectedResponseStudent(response)}
                            className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                              selectedResponseStudent?.user_id === response.user_id
                                ? 'border-[#1D3557] bg-[#FFD23F]/20'
                                : 'border-[#E0FBFC] hover:border-[#3D5A80]/50 bg-white'
                            }`}
                            data-testid={`response-student-${response.user_id}`}
                          >
                            <div className="flex items-center gap-3">
                              <img 
                                src={response.avatar_url || getDefaultAvatar('child', response.student_name)} 
                                alt={response.student_name}
                                className="w-10 h-10 rounded-full border-2 border-[#1D3557]"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-[#1D3557] truncate">{response.student_name}</div>
                                <div className="text-xs text-[#3D5A80]">
                                  {response.total_correct}/{response.total_questions} correct
                                </div>
                              </div>
                              <div className={`text-lg font-bold ${response.percentage >= 60 ? 'text-[#06D6A0]' : 'text-[#EE6C4D]'}`}>
                                {response.percentage}%
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Right: Response Details or Question Analytics */}
                  <div className="w-2/3 flex flex-col overflow-hidden">
                    {selectedResponseStudent ? (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-bold text-[#1D3557] flex items-center gap-2">
                            <Eye className="w-4 h-4" /> {selectedResponseStudent.student_name}'s Answers
                          </h4>
                          <button
                            onClick={() => setSelectedResponseStudent(null)}
                            className="text-xs text-[#3D5A80] hover:text-[#1D3557]"
                          >
                            ← Back to Overview
                          </button>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                          {selectedResponseStudent.question_details.map((q, idx) => (
                            <div 
                              key={q.question_id} 
                              className={`p-3 rounded-xl border-2 ${q.is_correct ? 'border-[#06D6A0] bg-[#06D6A0]/10' : 'border-[#EE6C4D] bg-[#EE6C4D]/10'}`}
                            >
                              <div className="flex items-start gap-2 mb-2">
                                {q.is_correct ? (
                                  <CheckCircle className="w-5 h-5 text-[#06D6A0] flex-shrink-0 mt-0.5" />
                                ) : (
                                  <XCircle className="w-5 h-5 text-[#EE6C4D] flex-shrink-0 mt-0.5" />
                                )}
                                <div className="flex-1">
                                  <div className="font-medium text-[#1D3557] text-sm">Q{idx + 1}: {q.question_text}</div>
                                </div>
                                <div className="text-xs font-bold text-[#3D5A80]">
                                  {q.points_earned}/{q.max_points} pts
                                </div>
                              </div>
                              
                              {/* Show options for MCQ/True-False */}
                              {q.options && (
                                <div className="ml-7 space-y-1">
                                  {q.options.map((opt, optIdx) => {
                                    const isUserAnswer = q.question_type === 'multi_select' 
                                      ? (q.user_answer || []).includes(optIdx)
                                      : q.user_answer === optIdx;
                                    const isCorrectAnswer = q.question_type === 'multi_select'
                                      ? (q.correct_answer || []).includes(optIdx)
                                      : q.correct_answer === optIdx;
                                    
                                    return (
                                      <div 
                                        key={optIdx}
                                        className={`text-xs p-1.5 rounded ${
                                          isCorrectAnswer 
                                            ? 'bg-[#06D6A0]/30 text-[#1D3557] font-medium' 
                                            : isUserAnswer && !isCorrectAnswer
                                              ? 'bg-[#EE6C4D]/30 text-[#1D3557] line-through'
                                              : 'text-[#3D5A80]'
                                        }`}
                                      >
                                        {isUserAnswer && '→ '}{opt}
                                        {isCorrectAnswer && ' ✓'}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                              
                              {/* Show text answer for fill_blank */}
                              {q.question_type === 'fill_blank' && (
                                <div className="ml-7 text-sm">
                                  <div className="text-[#3D5A80]">
                                    Student's answer: <span className={q.is_correct ? 'text-[#06D6A0] font-medium' : 'text-[#EE6C4D] line-through'}>{q.user_answer || '(no answer)'}</span>
                                  </div>
                                  {!q.is_correct && (
                                    <div className="text-[#06D6A0] font-medium">Correct: {q.correct_answer}</div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <>
                        <h4 className="font-bold text-[#1D3557] mb-2 flex items-center gap-2">
                          <Target className="w-4 h-4" /> Question Analytics
                        </h4>
                        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                          {questResponses.question_analytics.map((q, idx) => {
                            // Determine correct answer text
                            const letterMap = { 0: 'A', 1: 'B', 2: 'C', 3: 'D' };
                            let correctAnswerText = '';
                            if (q.question_type === 'mcq' || q.question_type === 'multi_select') {
                              if (typeof q.correct_answer === 'string' && ['A', 'B', 'C', 'D'].includes(q.correct_answer)) {
                                const idx = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 }[q.correct_answer];
                                correctAnswerText = q.options?.[idx] || q.correct_answer;
                              } else if (typeof q.correct_answer === 'number') {
                                correctAnswerText = q.options?.[q.correct_answer] || q.correct_answer;
                              } else if (Array.isArray(q.correct_answer)) {
                                correctAnswerText = q.correct_answer.map(ca => {
                                  if (['A', 'B', 'C', 'D'].includes(ca)) {
                                    const idx = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 }[ca];
                                    return q.options?.[idx] || ca;
                                  }
                                  return typeof ca === 'number' ? q.options?.[ca] : ca;
                                }).join(', ');
                              } else {
                                correctAnswerText = String(q.correct_answer);
                              }
                            } else {
                              correctAnswerText = String(q.correct_answer || '');
                            }
                            
                            return (
                              <div key={q.question_id} className="p-3 rounded-xl border-2 border-[#E0FBFC] bg-white">
                                <div className="flex items-start justify-between mb-2">
                                  <div className="font-medium text-[#1D3557] text-sm flex-1">
                                    Q{idx + 1}: {q.question_text}
                                  </div>
                                </div>
                                
                                {/* Question Image/PDF if available */}
                                {(q.image_url || q.pdf_url) && (
                                  <div className="flex gap-2 mb-2">
                                    {q.image_url && (
                                      <img 
                                        src={getAssetUrl(q.image_url)} 
                                        alt="Question" 
                                        className="h-16 w-auto rounded border border-[#1D3557]/20 object-cover"
                                      />
                                    )}
                                    {q.pdf_url && (
                                      <a 
                                        href={getAssetUrl(q.pdf_url)} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-xs text-[#3D5A80] hover:text-[#1D3557] bg-[#E0FBFC] px-2 py-1 rounded"
                                      >
                                        <FileText className="w-3 h-3" /> PDF
                                      </a>
                                    )}
                                  </div>
                                )}
                                
                                {/* Answer Distribution based on question type */}
                                {Object.keys(q.answer_distribution || {}).length > 0 && (
                                  <div className="mt-2 space-y-1">
                                    <div className="text-xs text-[#3D5A80] font-medium">Answer Distribution:</div>
                                    
                                    {/* True/False Questions */}
                                    {q.question_type === 'true_false' && (
                                      <>
                                        {['True', 'False'].map((opt) => {
                                          const count = q.answer_distribution[opt] || 0;
                                          const percentage = q.total_attempts > 0 ? (count / q.total_attempts) * 100 : 0;
                                          const isCorrectOption = q.correct_answer === opt || String(q.correct_answer).toLowerCase() === opt.toLowerCase();
                                          
                                          return (
                                            <div key={opt} className="flex items-center gap-2 text-xs">
                                              {isCorrectOption ? (
                                                <CheckCircle className="w-3 h-3 text-[#06D6A0]" />
                                              ) : (
                                                <div className="w-3 h-3 rounded-full bg-[#3D5A80]/20"></div>
                                              )}
                                              <div className={`flex-1 ${isCorrectOption ? 'text-[#06D6A0] font-medium' : ''}`}>{opt}</div>
                                              <div className="text-[#3D5A80]">{count} ({percentage.toFixed(0)}%)</div>
                                            </div>
                                          );
                                        })}
                                      </>
                                    )}
                                    
                                    {/* MCQ Questions */}
                                    {q.question_type === 'mcq' && q.options && (
                                      <>
                                        {q.options.map((opt, optIdx) => {
                                          const count = q.answer_distribution[opt] || 0;
                                          const percentage = q.total_attempts > 0 ? (count / q.total_attempts) * 100 : 0;
                                          
                                          // Check if this option is the correct answer
                                          let isCorrectOption = false;
                                          if (typeof q.correct_answer === 'string' && ['A', 'B', 'C', 'D'].includes(q.correct_answer)) {
                                            const correctIdx = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 }[q.correct_answer];
                                            isCorrectOption = optIdx === correctIdx;
                                          } else if (typeof q.correct_answer === 'number') {
                                            isCorrectOption = optIdx === q.correct_answer;
                                          } else {
                                            isCorrectOption = q.correct_answer === opt;
                                          }
                                          
                                          return (
                                            <div key={optIdx} className="flex items-center gap-2 text-xs">
                                              {isCorrectOption ? (
                                                <CheckCircle className="w-3 h-3 text-[#06D6A0]" />
                                              ) : (
                                                <div className="w-3 h-3 rounded-full bg-[#3D5A80]/20"></div>
                                              )}
                                              <div className={`flex-1 truncate ${isCorrectOption ? 'text-[#06D6A0] font-medium' : ''}`}>{opt}</div>
                                              <div className="text-[#3D5A80]">{count} ({percentage.toFixed(0)}%)</div>
                                            </div>
                                          );
                                        })}
                                      </>
                                    )}
                                    
                                    {/* Multi-select Questions */}
                                    {q.question_type === 'multi_select' && q.options && (
                                      <>
                                        {q.options.map((opt, optIdx) => {
                                          const count = q.answer_distribution[opt] || 0;
                                          const percentage = q.total_attempts > 0 ? (count / q.total_attempts) * 100 : 0;
                                          
                                          // Check if this option is part of correct answers
                                          const correctAnswers = Array.isArray(q.correct_answer) ? q.correct_answer : [q.correct_answer];
                                          const correctIndices = correctAnswers.map(ca => {
                                            if (['A', 'B', 'C', 'D'].includes(ca)) return { 'A': 0, 'B': 1, 'C': 2, 'D': 3 }[ca];
                                            return ca;
                                          });
                                          const isCorrectOption = correctIndices.includes(optIdx) || correctAnswers.includes(opt);
                                          
                                          return (
                                            <div key={optIdx} className="flex items-center gap-2 text-xs">
                                              {isCorrectOption ? (
                                                <CheckCircle className="w-3 h-3 text-[#06D6A0]" />
                                              ) : (
                                                <div className="w-3 h-3 rounded-full bg-[#3D5A80]/20"></div>
                                              )}
                                              <div className={`flex-1 truncate ${isCorrectOption ? 'text-[#06D6A0] font-medium' : ''}`}>{opt}</div>
                                              <div className="text-[#3D5A80]">{count} selected ({percentage.toFixed(0)}%)</div>
                                            </div>
                                          );
                                        })}
                                      </>
                                    )}
                                    
                                    {/* Numeric/Value Questions - Show all submitted answers */}
                                    {(q.question_type === 'numeric' || q.question_type === 'value') && (
                                      <>
                                        {Object.entries(q.answer_distribution).map(([answer, count]) => {
                                          const percentage = q.total_attempts > 0 ? (count / q.total_attempts) * 100 : 0;
                                          const isCorrectAnswer = String(answer) === String(q.correct_answer);
                                          
                                          return (
                                            <div key={answer} className="flex items-center gap-2 text-xs">
                                              {isCorrectAnswer ? (
                                                <CheckCircle className="w-3 h-3 text-[#06D6A0]" />
                                              ) : (
                                                <XCircle className="w-3 h-3 text-[#EE6C4D]" />
                                              )}
                                              <div className={`flex-1 ${isCorrectAnswer ? 'text-[#06D6A0] font-medium' : 'text-[#EE6C4D]'}`}>
                                                {answer}
                                              </div>
                                              <div className="text-[#3D5A80]">{count} ({percentage.toFixed(0)}%)</div>
                                            </div>
                                          );
                                        })}
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-[#3D5A80]">
                No response data available
              </div>
            )}
          </DialogContent>
        </Dialog>
        
        {/* Repository Picker Dialog - Using Portal to render outside Dialog tree */}
        {showRepositoryPicker && createPortal(
          <div 
            className="fixed inset-0 bg-black/60 flex items-center justify-center p-4"
            style={{ zIndex: 9999 }}
            onClick={(e) => {
              // Close if clicking backdrop and re-open quest dialog
              if (e.target === e.currentTarget) {
                setShowRepositoryPicker(false);
                setPickingFor(null);
                setShowCreateQuest(true);
              }
            }}
          >
            <div 
              className="bg-white rounded-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b flex items-center justify-between bg-gradient-to-r from-[#1D3557] to-[#3D5A80]">
                <div>
                  <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Fredoka' }}>
                    <FolderOpen className="w-5 h-5 inline mr-2" />
                    Select {pickingFor === 'image' ? 'Image' : 'PDF'} from Repository
                  </h2>
                  <p className="text-white/70 text-sm">Click on a resource to select it</p>
                </div>
                <button 
                  type="button"
                  onClick={() => { setShowRepositoryPicker(false); setPickingFor(null); setShowCreateQuest(true); }}
                  className="p-2 hover:bg-white/20 rounded-full text-white"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              {/* Filters */}
              <div className="p-4 border-b bg-gray-50 flex flex-wrap gap-3 items-center">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-[#3D5A80]" />
                  <span className="text-sm font-medium text-[#1D3557]">Filter:</span>
                </div>
                <select
                  value={repoFilterTopic}
                  onChange={(e) => {
                    setRepoFilterTopic(e.target.value);
                    setRepoFilterSubtopic('');
                    fetchRepoSubtopics(e.target.value);
                    setTimeout(fetchRepository, 100);
                  }}
                  className="px-3 py-1.5 border rounded-lg text-sm"
                >
                  <option value="">All Topics</option>
                  {repositoryTopics.map(t => (
                    <option key={t.topic_id} value={t.topic_id}>{t.title}</option>
                  ))}
                </select>
                {repoFilterTopic && (
                  <select
                    value={repoFilterSubtopic}
                    onChange={(e) => {
                      setRepoFilterSubtopic(e.target.value);
                      setTimeout(fetchRepository, 100);
                    }}
                    className="px-3 py-1.5 border rounded-lg text-sm"
                  >
                    <option value="">All Subtopics</option>
                    {repositorySubtopics.map(s => (
                      <option key={s.topic_id} value={s.topic_id}>{s.title}</option>
                    ))}
                  </select>
                )}
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      placeholder="Search by title or tags..."
                      value={repoSearch}
                      onChange={(e) => setRepoSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-1.5 border rounded-lg text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Items Grid */}
              <div className="flex-1 overflow-y-auto p-4">
                {filteredRepoItems.length === 0 ? (
                  <div className="text-center py-12">
                    <FolderOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-[#1D3557] mb-2">
                      No {pickingFor === 'image' ? 'Images' : 'PDFs'} Available
                    </h3>
                    <p className="text-[#3D5A80] text-sm">
                      {repoSearch || repoFilterTopic ? 'Try different filters' : 'Admin needs to upload resources first'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filteredRepoItems.map(item => (
                      <button 
                        key={item.item_id}
                        type="button"
                        className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden hover:border-[#06D6A0] hover:shadow-lg transition-all cursor-pointer group text-left"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          selectFromRepository(item);
                        }}
                        data-testid={`repo-item-${item.item_id}`}
                      >
                        <div className="h-32 bg-gray-100 flex items-center justify-center overflow-hidden pointer-events-none">
                          {item.file_type === 'image' ? (
                            <img 
                              src={getAssetUrl(item.file_url)} 
                              alt={item.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <FileText className="w-12 h-12 text-red-500" />
                          )}
                        </div>
                        <div className="p-3 pointer-events-none">
                          <h4 className="font-bold text-[#1D3557] text-sm truncate">{item.title}</h4>
                          <p className="text-xs text-[#3D5A80] truncate">{item.topic_name} &gt; {item.subtopic_name}</p>
                          <p className="text-xs text-[#3D5A80]/60 mt-1">Grade {item.min_grade}-{item.max_grade}</p>
                          {item.tags?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {item.tags.slice(0, 2).map((tag, idx) => (
                                <span key={idx} className="px-1.5 py-0.5 bg-[#E0F7FA] text-[#1D3557] text-xs rounded">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t bg-gray-50 flex items-center justify-between">
                <span className="text-sm text-[#3D5A80]">
                  {filteredRepoItems.length} {pickingFor === 'image' ? 'image(s)' : 'PDF(s)'} available
                </span>
                <button 
                  type="button"
                  onClick={() => { setShowRepositoryPicker(false); setPickingFor(null); setShowCreateQuest(true); }}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-[#1D3557] font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </main>
    </div>
  );
}
