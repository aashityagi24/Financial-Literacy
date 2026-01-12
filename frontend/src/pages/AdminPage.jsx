import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { 
  Shield, ChevronLeft, Users, BookOpen, FileText, Gamepad2,
  Plus, Trash2, Edit2, Save, X, BarChart3
} from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminPage({ user }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Form states
  const [topicForm, setTopicForm] = useState({ title: '', description: '', category: 'concepts', icon: '📚', min_grade: 0, max_grade: 5 });
  const [lessonForm, setLessonForm] = useState({ topic_id: '', title: '', content: '', lesson_type: 'story', duration_minutes: 5, reward_coins: 5, min_grade: 0, max_grade: 5 });
  const [bookForm, setBookForm] = useState({ title: '', author: '', description: '', category: 'story', min_grade: 0, max_grade: 5 });
  const [activityForm, setActivityForm] = useState({ title: '', description: '', instructions: '', activity_type: 'real_world', reward_coins: 10, min_grade: 0, max_grade: 5 });
  
  const [showTopicDialog, setShowTopicDialog] = useState(false);
  const [showLessonDialog, setShowLessonDialog] = useState(false);
  const [showBookDialog, setShowBookDialog] = useState(false);
  const [showActivityDialog, setShowActivityDialog] = useState(false);
  
  useEffect(() => {
    if (user?.role !== 'admin') {
      toast.error('Admin access required');
      navigate('/dashboard');
      return;
    }
    fetchData();
  }, [user, navigate]);
  
  const fetchData = async () => {
    try {
      const [statsRes, usersRes, topicsRes] = await Promise.all([
        axios.get(`${API}/admin/stats`),
        axios.get(`${API}/admin/users`),
        axios.get(`${API}/learn/topics`)
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data);
      setTopics(topicsRes.data);
    } catch (error) {
      if (error.response?.status === 403) {
        toast.error('Admin access required');
        navigate('/dashboard');
      } else {
        toast.error('Failed to load admin data');
      }
    } finally {
      setLoading(false);
    }
  };
  
  const handleCreateTopic = async () => {
    try {
      await axios.post(`${API}/admin/topics`, topicForm);
      toast.success('Topic created!');
      setShowTopicDialog(false);
      setTopicForm({ title: '', description: '', category: 'concepts', icon: '📚', min_grade: 0, max_grade: 5 });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create topic');
    }
  };
  
  const handleCreateLesson = async () => {
    try {
      await axios.post(`${API}/admin/lessons`, lessonForm);
      toast.success('Lesson created!');
      setShowLessonDialog(false);
      setLessonForm({ topic_id: '', title: '', content: '', lesson_type: 'story', duration_minutes: 5, reward_coins: 5, min_grade: 0, max_grade: 5 });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create lesson');
    }
  };
  
  const handleCreateBook = async () => {
    try {
      await axios.post(`${API}/admin/books`, bookForm);
      toast.success('Book created!');
      setShowBookDialog(false);
      setBookForm({ title: '', author: '', description: '', category: 'story', min_grade: 0, max_grade: 5 });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create book');
    }
  };
  
  const handleCreateActivity = async () => {
    try {
      await axios.post(`${API}/admin/activities`, activityForm);
      toast.success('Activity created!');
      setShowActivityDialog(false);
      setActivityForm({ title: '', description: '', instructions: '', activity_type: 'real_world', reward_coins: 10, min_grade: 0, max_grade: 5 });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create activity');
    }
  };
  
  const handleUpdateUserRole = async (userId, newRole) => {
    try {
      await axios.put(`${API}/admin/users/${userId}/role`, { role: newRole });
      toast.success('User role updated');
      fetchData();
    } catch (error) {
      toast.error('Failed to update role');
    }
  };
  
  const handleDeleteTopic = async (topicId) => {
    if (!window.confirm('Delete this topic and all its lessons?')) return;
    try {
      await axios.delete(`${API}/admin/topics/${topicId}`);
      toast.success('Topic deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete topic');
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
    <div className="min-h-screen bg-[#E0FBFC]" data-testid="admin-page">
      {/* Header */}
      <header className="bg-[#1D3557] border-b-3 border-[#FFD23F]">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="p-2 rounded-xl border-2 border-[#FFD23F] hover:bg-[#FFD23F]/20">
              <ChevronLeft className="w-5 h-5 text-white" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#FFD23F] rounded-xl border-3 border-white flex items-center justify-center">
                <Shield className="w-6 h-6 text-[#1D3557]" />
              </div>
              <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Fredoka' }}>Admin Dashboard</h1>
            </div>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6">
        {/* Quick Action - Content Management */}
        <Link 
          to="/admin/content" 
          className="mb-6 block card-playful p-4 bg-gradient-to-r from-[#FFD23F] to-[#EE6C4D] hover:scale-[1.01] transition-transform"
          data-testid="content-management-link"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BookOpen className="w-8 h-8 text-white" />
              <div>
                <h3 className="text-lg font-bold text-white" style={{ fontFamily: 'Fredoka' }}>Content Management</h3>
                <p className="text-white/80 text-sm">Manage topics, subtopics, lessons, worksheets, and activities</p>
              </div>
            </div>
            <ChevronLeft className="w-6 h-6 text-white rotate-180" />
          </div>
        </Link>
        
        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
            { id: 'users', label: 'Users', icon: Users },
            { id: 'content', label: 'Legacy Content', icon: BookOpen },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3 rounded-xl border-3 border-[#1D3557] font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                activeTab === tab.id 
                  ? 'bg-[#FFD23F] text-[#1D3557] shadow-[3px_3px_0px_0px_#1D3557]' 
                  : 'bg-white text-[#3D5A80] hover:bg-[#E0FBFC]'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </div>
        
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* User Stats */}
            <div className="card-playful p-5">
              <Users className="w-8 h-8 text-[#3D5A80] mb-2" />
              <p className="text-3xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>{stats?.users?.total || 0}</p>
              <p className="text-sm text-[#3D5A80]">Total Users</p>
            </div>
            <div className="card-playful p-5">
              <span className="text-3xl block mb-2">🧒</span>
              <p className="text-3xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>{stats?.users?.children || 0}</p>
              <p className="text-sm text-[#3D5A80]">Children</p>
            </div>
            <div className="card-playful p-5">
              <span className="text-3xl block mb-2">👨‍👩‍👧</span>
              <p className="text-3xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>{stats?.users?.parents || 0}</p>
              <p className="text-sm text-[#3D5A80]">Parents</p>
            </div>
            <div className="card-playful p-5">
              <span className="text-3xl block mb-2">👩‍🏫</span>
              <p className="text-3xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>{stats?.users?.teachers || 0}</p>
              <p className="text-sm text-[#3D5A80]">Teachers</p>
            </div>
            
            {/* Content Stats */}
            <div className="card-playful p-5">
              <BookOpen className="w-8 h-8 text-[#06D6A0] mb-2" />
              <p className="text-3xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>{stats?.content?.topics || 0}</p>
              <p className="text-sm text-[#3D5A80]">Topics</p>
            </div>
            <div className="card-playful p-5">
              <FileText className="w-8 h-8 text-[#FFD23F] mb-2" />
              <p className="text-3xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>{stats?.content?.lessons || 0}</p>
              <p className="text-sm text-[#3D5A80]">Lessons</p>
            </div>
            <div className="card-playful p-5">
              <span className="text-3xl block mb-2">📚</span>
              <p className="text-3xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>{stats?.content?.books || 0}</p>
              <p className="text-sm text-[#3D5A80]">Books</p>
            </div>
            <div className="card-playful p-5">
              <Gamepad2 className="w-8 h-8 text-[#EE6C4D] mb-2" />
              <p className="text-3xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>{stats?.content?.activities || 0}</p>
              <p className="text-sm text-[#3D5A80]">Activities</p>
            </div>
            
            {/* Engagement Stats */}
            <div className="col-span-2 md:col-span-4 card-playful p-5">
              <h3 className="font-bold text-[#1D3557] mb-4" style={{ fontFamily: 'Fredoka' }}>Engagement</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-[#06D6A0]">{stats?.engagement?.lessons_completed || 0}</p>
                  <p className="text-sm text-[#3D5A80]">Lessons Completed</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-[#FFD23F]">{stats?.engagement?.activities_completed || 0}</p>
                  <p className="text-sm text-[#3D5A80]">Activities Done</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-[#EE6C4D]">{stats?.engagement?.quests_completed || 0}</p>
                  <p className="text-sm text-[#3D5A80]">Quests Finished</p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="card-playful p-6">
            <h2 className="text-xl font-bold text-[#1D3557] mb-4" style={{ fontFamily: 'Fredoka' }}>User Management</h2>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-[#1D3557]">
                    <th className="text-left p-3 text-[#3D5A80]">Name</th>
                    <th className="text-left p-3 text-[#3D5A80]">Email</th>
                    <th className="text-left p-3 text-[#3D5A80]">Role</th>
                    <th className="text-left p-3 text-[#3D5A80]">Grade</th>
                    <th className="text-left p-3 text-[#3D5A80]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.user_id} className="border-b border-[#1D3557]/20 hover:bg-[#E0FBFC]">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <img src={u.picture || 'https://via.placeholder.com/32'} alt="" className="w-8 h-8 rounded-full border border-[#1D3557]" />
                          <span className="font-medium text-[#1D3557]">{u.name}</span>
                        </div>
                      </td>
                      <td className="p-3 text-[#3D5A80]">{u.email}</td>
                      <td className="p-3">
                        <Select 
                          value={u.role || 'none'} 
                          onValueChange={(v) => handleUpdateUserRole(u.user_id, v)}
                        >
                          <SelectTrigger className="w-32 border-2 border-[#1D3557]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="child">Child</SelectItem>
                            <SelectItem value="parent">Parent</SelectItem>
                            <SelectItem value="teacher">Teacher</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3 text-[#3D5A80]">{u.grade !== null ? `Grade ${u.grade}` : '-'}</td>
                      <td className="p-3">
                        <span className="text-xs text-[#98C1D9]">{u.user_id.slice(0, 12)}...</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {/* Content Tab */}
        {activeTab === 'content' && (
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="flex flex-wrap gap-3">
              <Dialog open={showTopicDialog} onOpenChange={setShowTopicDialog}>
                <DialogTrigger asChild>
                  <button className="btn-primary px-4 py-2 flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Add Topic
                  </button>
                </DialogTrigger>
                <DialogContent className="bg-white border-3 border-[#1D3557] rounded-3xl max-w-lg">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>Create New Topic</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <Input placeholder="Title" value={topicForm.title} onChange={(e) => setTopicForm({...topicForm, title: e.target.value})} className="border-2 border-[#1D3557]" />
                    <Textarea placeholder="Description" value={topicForm.description} onChange={(e) => setTopicForm({...topicForm, description: e.target.value})} className="border-2 border-[#1D3557]" />
                    <div className="grid grid-cols-2 gap-4">
                      <Select value={topicForm.category} onValueChange={(v) => setTopicForm({...topicForm, category: v})}>
                        <SelectTrigger className="border-2 border-[#1D3557]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="history">History</SelectItem>
                          <SelectItem value="concepts">Concepts</SelectItem>
                          <SelectItem value="skills">Skills</SelectItem>
                          <SelectItem value="activities">Activities</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input placeholder="Icon (emoji)" value={topicForm.icon} onChange={(e) => setTopicForm({...topicForm, icon: e.target.value})} className="border-2 border-[#1D3557]" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-[#3D5A80]">Min Grade</label>
                        <Input type="number" min="0" max="5" value={topicForm.min_grade} onChange={(e) => setTopicForm({...topicForm, min_grade: parseInt(e.target.value)})} className="border-2 border-[#1D3557]" />
                      </div>
                      <div>
                        <label className="text-sm text-[#3D5A80]">Max Grade</label>
                        <Input type="number" min="0" max="5" value={topicForm.max_grade} onChange={(e) => setTopicForm({...topicForm, max_grade: parseInt(e.target.value)})} className="border-2 border-[#1D3557]" />
                      </div>
                    </div>
                    <button onClick={handleCreateTopic} className="btn-primary w-full py-3">Create Topic</button>
                  </div>
                </DialogContent>
              </Dialog>
              
              <Dialog open={showLessonDialog} onOpenChange={setShowLessonDialog}>
                <DialogTrigger asChild>
                  <button className="btn-secondary px-4 py-2 flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Add Lesson
                  </button>
                </DialogTrigger>
                <DialogContent className="bg-white border-3 border-[#1D3557] rounded-3xl max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>Create New Lesson</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <Select value={lessonForm.topic_id} onValueChange={(v) => setLessonForm({...lessonForm, topic_id: v})}>
                      <SelectTrigger className="border-2 border-[#1D3557]"><SelectValue placeholder="Select Topic" /></SelectTrigger>
                      <SelectContent>
                        {topics.map((t) => (
                          <SelectItem key={t.topic_id} value={t.topic_id}>{t.icon} {t.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input placeholder="Title" value={lessonForm.title} onChange={(e) => setLessonForm({...lessonForm, title: e.target.value})} className="border-2 border-[#1D3557]" />
                    <Textarea placeholder="Content (Markdown supported)" value={lessonForm.content} onChange={(e) => setLessonForm({...lessonForm, content: e.target.value})} className="border-2 border-[#1D3557] min-h-[200px]" />
                    <div className="grid grid-cols-3 gap-4">
                      <Select value={lessonForm.lesson_type} onValueChange={(v) => setLessonForm({...lessonForm, lesson_type: v})}>
                        <SelectTrigger className="border-2 border-[#1D3557]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="story">Story</SelectItem>
                          <SelectItem value="video">Video</SelectItem>
                          <SelectItem value="interactive">Interactive</SelectItem>
                          <SelectItem value="quiz">Quiz</SelectItem>
                          <SelectItem value="activity">Activity</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input type="number" placeholder="Duration (min)" value={lessonForm.duration_minutes} onChange={(e) => setLessonForm({...lessonForm, duration_minutes: parseInt(e.target.value)})} className="border-2 border-[#1D3557]" />
                      <Input type="number" placeholder="Reward coins" value={lessonForm.reward_coins} onChange={(e) => setLessonForm({...lessonForm, reward_coins: parseInt(e.target.value)})} className="border-2 border-[#1D3557]" />
                    </div>
                    <button onClick={handleCreateLesson} className="btn-primary w-full py-3">Create Lesson</button>
                  </div>
                </DialogContent>
              </Dialog>
              
              <Dialog open={showBookDialog} onOpenChange={setShowBookDialog}>
                <DialogTrigger asChild>
                  <button className="btn-accent px-4 py-2 flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Add Book
                  </button>
                </DialogTrigger>
                <DialogContent className="bg-white border-3 border-[#1D3557] rounded-3xl max-w-lg">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>Add New Book</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <Input placeholder="Title" value={bookForm.title} onChange={(e) => setBookForm({...bookForm, title: e.target.value})} className="border-2 border-[#1D3557]" />
                    <Input placeholder="Author" value={bookForm.author} onChange={(e) => setBookForm({...bookForm, author: e.target.value})} className="border-2 border-[#1D3557]" />
                    <Textarea placeholder="Description" value={bookForm.description} onChange={(e) => setBookForm({...bookForm, description: e.target.value})} className="border-2 border-[#1D3557]" />
                    <Select value={bookForm.category} onValueChange={(v) => setBookForm({...bookForm, category: v})}>
                      <SelectTrigger className="border-2 border-[#1D3557]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="story">Story</SelectItem>
                        <SelectItem value="workbook">Workbook</SelectItem>
                        <SelectItem value="guide">Guide</SelectItem>
                      </SelectContent>
                    </Select>
                    <button onClick={handleCreateBook} className="btn-primary w-full py-3">Add Book</button>
                  </div>
                </DialogContent>
              </Dialog>
              
              <Dialog open={showActivityDialog} onOpenChange={setShowActivityDialog}>
                <DialogTrigger asChild>
                  <button className="bg-[#9B5DE5] text-white font-bold px-4 py-2 rounded-full border-3 border-[#1D3557] shadow-[3px_3px_0px_0px_#1D3557] flex items-center gap-2 hover:-translate-y-0.5 transition-transform">
                    <Plus className="w-4 h-4" /> Add Activity
                  </button>
                </DialogTrigger>
                <DialogContent className="bg-white border-3 border-[#1D3557] rounded-3xl max-w-lg">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>Create New Activity</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <Input placeholder="Title" value={activityForm.title} onChange={(e) => setActivityForm({...activityForm, title: e.target.value})} className="border-2 border-[#1D3557]" />
                    <Textarea placeholder="Description" value={activityForm.description} onChange={(e) => setActivityForm({...activityForm, description: e.target.value})} className="border-2 border-[#1D3557]" />
                    <Textarea placeholder="Instructions (use \n for new lines)" value={activityForm.instructions} onChange={(e) => setActivityForm({...activityForm, instructions: e.target.value})} className="border-2 border-[#1D3557]" />
                    <div className="grid grid-cols-2 gap-4">
                      <Select value={activityForm.activity_type} onValueChange={(v) => setActivityForm({...activityForm, activity_type: v})}>
                        <SelectTrigger className="border-2 border-[#1D3557]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="printable">Printable</SelectItem>
                          <SelectItem value="interactive">Interactive</SelectItem>
                          <SelectItem value="real_world">Real World</SelectItem>
                          <SelectItem value="game">Game</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input type="number" placeholder="Reward coins" value={activityForm.reward_coins} onChange={(e) => setActivityForm({...activityForm, reward_coins: parseInt(e.target.value)})} className="border-2 border-[#1D3557]" />
                    </div>
                    <button onClick={handleCreateActivity} className="btn-primary w-full py-3">Create Activity</button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            
            {/* Topics List */}
            <div className="card-playful p-6">
              <h2 className="text-xl font-bold text-[#1D3557] mb-4" style={{ fontFamily: 'Fredoka' }}>Learning Topics</h2>
              
              {topics.length === 0 ? (
                <p className="text-[#3D5A80] text-center py-8">No topics yet. Create one to get started!</p>
              ) : (
                <div className="space-y-3">
                  {topics.map((topic) => (
                    <div key={topic.topic_id} className="flex items-center gap-4 p-4 bg-[#E0FBFC] rounded-xl border-2 border-[#1D3557]">
                      <span className="text-2xl">{topic.icon}</span>
                      <div className="flex-1">
                        <h3 className="font-bold text-[#1D3557]">{topic.title}</h3>
                        <p className="text-sm text-[#3D5A80]">{topic.total_lessons || 0} lessons • Grade {topic.min_grade}-{topic.max_grade}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteTopic(topic.topic_id)}
                        className="p-2 rounded-lg hover:bg-[#EE6C4D]/20 text-[#EE6C4D]"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
