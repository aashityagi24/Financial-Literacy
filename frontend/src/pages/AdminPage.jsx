import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { uploadFile } from '@/utils/chunkedUpload';
import { 
  Shield, ChevronLeft, ChevronRight, Users, BookOpen, BarChart3,
  Trash2, Edit2, Library, Store, TrendingUp, LogOut, User, Target, Plus, School, Video, BookMarked, Eye, EyeOff, CreditCard, Clock, Phone, Calendar as CalendarIcon, Filter, X
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function AdminPage({ user }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showCreateSchool, setShowCreateSchool] = useState(false);
  const [guidebook, setGuidebook] = useState({ child_guide: '', parent_guide: '', child_audio_url: '', parent_audio_url: '' });
  const [guidebookSaving, setGuidebookSaving] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'child',
    grade: 0
  });
  const [showNewUserPassword, setShowNewUserPassword] = useState(false);
  const [newSchoolForm, setNewSchoolForm] = useState({
    name: '',
    username: '',
    password: '',
    address: '',
    contact_email: ''
  });
  const [showNewSchoolPassword, setShowNewSchoolPassword] = useState(false);
  
  // Subscription management state
  const [subDialog, setSubDialog] = useState({ open: false, userId: null, userName: '', currentStatus: '' });
  const [subDuration, setSubDuration] = useState('1_month');
  
  // Multi-select state
  const [selectedUsers, setSelectedUsers] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [enquiries, setEnquiries] = useState([]);
  const [userDateFrom, setUserDateFrom] = useState(null);
  const [userDateTo, setUserDateTo] = useState(null);
  
  // Filters for user management
  const [filters, setFilters] = useState({
    role: 'all',
    grade: 'all',
    school: 'all',
    subscription: 'all'
  });
  
  useEffect(() => {
    if (user?.role !== 'admin') {
      toast.error('Admin access required');
      navigate('/dashboard');
      return;
    }
    fetchData();
  }, [user, navigate]);
  
  useEffect(() => {
    if (activeTab === 'guidebook') {
      axios.get(`${API}/jobs/guidebook`).then(res => {
        setGuidebook({ child_guide: res.data.child_guide || '', parent_guide: res.data.parent_guide || '', child_audio_url: res.data.child_audio_url || '', parent_audio_url: res.data.parent_audio_url || '' });
      }).catch(() => {});
    }
    if (activeTab === 'enquiries') {
      axios.get(`${API}/admin/school-enquiries`).then(res => {
        setEnquiries(res.data);
      }).catch(() => {});
    }
  }, [activeTab]);
  
  const fetchData = async () => {
    try {
      const [statsRes, usersRes, schoolsRes] = await Promise.all([
        axios.get(`${API}/admin/stats`),
        axios.get(`${API}/admin/users`),
        axios.get(`${API}/admin/schools`)
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data);
      setSchools(schoolsRes.data);
    } catch (error) {
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };
  
  const handleLogout = async () => {
    try {
      await axios.post(`${API}/auth/logout`);
      navigate('/');
    } catch (error) {
      console.error('Logout failed:', error);
      navigate('/');
    }
  };
  
  const handleRoleChange = async (userId, newRole) => {
    try {
      await axios.put(`${API}/admin/users/${userId}/role`, { role: newRole });
      toast.success('User role updated');
      fetchData();
    } catch (error) {
      toast.error('Failed to update role');
    }
  };
  
  const handleGradeChange = async (userId, newGrade) => {
    try {
      const gradeValue = newGrade === null ? null : parseInt(newGrade);
      await axios.put(`${API}/admin/users/${userId}/grade`, { grade: gradeValue });
      toast.success('User grade updated');
      fetchData();
    } catch (error) {
      toast.error('Failed to update grade');
    }
  };

  const handleSubscriptionChange = async (status, duration) => {
    try {
      await axios.put(`${API}/admin/users/${subDialog.userId}/subscription`, { status, duration });
      toast.success(status === 'active' ? `Subscription activated for ${subDialog.userName}` : `Subscription deactivated for ${subDialog.userName}`);
      setSubDialog({ open: false, userId: null, userName: '', currentStatus: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update subscription');
    }
  };
  
  // Filter users based on selected filters
  const filteredUsers = users.filter(u => {
    if (filters.role !== 'all' && u.role !== filters.role) return false;
    if (filters.grade !== 'all') {
      if (filters.grade === 'none' && u.grade !== null && u.grade !== undefined) return false;
      if (filters.grade !== 'none' && String(u.grade) !== filters.grade) return false;
    }
    if (filters.school !== 'all') {
      if (filters.school === 'none' && u.school_id) return false;
      if (filters.school !== 'none' && u.school_id !== filters.school) return false;
    }
    if (filters.subscription !== 'all') {
      if (filters.subscription !== u.subscription_status) return false;
    }
    if (userDateFrom) {
      const d = new Date(u.created_at);
      if (d < userDateFrom) return false;
    }
    if (userDateTo) {
      const d = new Date(u.created_at);
      const end = new Date(userDateTo); end.setHours(23, 59, 59, 999);
      if (d > end) return false;
    }
    return true;
  });
  
  const handleDeleteUser = async (userId, userName) => {
    if (!confirm(`Are you sure you want to delete ${userName}? This will delete ALL their data permanently.`)) {
      return;
    }
    
    try {
      await axios.delete(`${API}/admin/users/${userId}`);
      toast.success(`User ${userName} deleted`);
      setSelectedUsers(prev => { const s = new Set(prev); s.delete(userId); return s; });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete user');
    }
  };

  const handleBulkDelete = async () => {
    const count = selectedUsers.size;
    const selfSelected = selectedUsers.has(user?.user_id);
    if (selfSelected) {
      toast.error('Cannot delete your own account. Deselect yourself first.');
      return;
    }
    if (!confirm(`Are you sure you want to delete ${count} user${count > 1 ? 's' : ''}? This will permanently delete ALL their data.`)) {
      return;
    }
    
    setBulkDeleting(true);
    let deleted = 0;
    let failed = 0;
    for (const userId of selectedUsers) {
      try {
        await axios.delete(`${API}/admin/users/${userId}`);
        deleted++;
      } catch {
        failed++;
      }
    }
    setBulkDeleting(false);
    setSelectedUsers(new Set());
    toast.success(`Deleted ${deleted} user${deleted > 1 ? 's' : ''}${failed ? `, ${failed} failed` : ''}`);
    fetchData();
  };

  const toggleSelectUser = (userId) => {
    setSelectedUsers(prev => {
      const s = new Set(prev);
      if (s.has(userId)) s.delete(userId); else s.add(userId);
      return s;
    });
  };

  const toggleSelectAll = () => {
    if (selectedUsers.size === filteredUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredUsers.map(u => u.user_id)));
    }
  };
  
  const handleCreateUser = async () => {
    if (!newUserForm.name || !newUserForm.email) {
      toast.error('Name and email are required');
      return;
    }
    if (!newUserForm.password || newUserForm.password.length < 6) {
      toast.error('Password is required (minimum 6 characters)');
      return;
    }
    
    try {
      // Prepare data - only include grade for child role
      const userData = {
        name: newUserForm.name.trim(),
        email: newUserForm.email.trim().toLowerCase(),
        password: newUserForm.password,
        role: newUserForm.role,
        grade: newUserForm.role === 'child' ? newUserForm.grade : null
      };
      
      await axios.post(`${API}/admin/users`, userData);
      toast.success(`User ${newUserForm.name} created successfully!`);
      setShowCreateUser(false);
      setNewUserForm({ name: '', email: '', password: '', role: 'child', grade: 0 });
      fetchData();
    } catch (error) {
      console.error('Create user error:', error.response?.data);
      toast.error(error.response?.data?.detail || 'Failed to create user');
    }
  };
  
  const handleCreateSchool = async () => {
    if (!newSchoolForm.name || !newSchoolForm.username || !newSchoolForm.password) {
      toast.error('Name, username and password are required');
      return;
    }
    
    try {
      await axios.post(`${API}/admin/schools`, newSchoolForm);
      toast.success(`School ${newSchoolForm.name} created`);
      setShowCreateSchool(false);
      setNewSchoolForm({ name: '', username: '', password: '', address: '', contact_email: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create school');
    }
  };
  
  const handleDeleteSchool = async (schoolId, schoolName) => {
    if (!confirm(`Are you sure you want to delete ${schoolName}? This will unlink all associated users.`)) {
      return;
    }
    
    try {
      await axios.delete(`${API}/admin/schools/${schoolId}`);
      toast.success(`School ${schoolName} deleted`);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete school');
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-[#FFD23F] border-t-transparent rounded-full"></div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-[#1D3557] rounded-xl flex items-center justify-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-xl font-bold text-gray-800">Admin Dashboard</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-xl">
                <User className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">{user?.email || 'Admin'}</span>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-xl border border-gray-300 hover:bg-red-50 hover:border-red-300 transition-colors"
                data-testid="admin-logout-btn"
              >
                <LogOut className="w-5 h-5 text-gray-600 hover:text-red-500" />
              </button>
            </div>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6">
        {/* Management Cards Grid - 4 per row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {/* Content Management Card */}
          <Link 
            to="/admin/content" 
            className="block bg-gradient-to-r from-[#3D5A80] to-[#5A7BA0] rounded-xl p-4 hover:shadow-lg transition-shadow"
            data-testid="content-management-link"
          >
            <div className="flex flex-col items-center text-center gap-2">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Library className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Content</h3>
                <p className="text-white/70 text-xs">Topics & lessons</p>
              </div>
            </div>
          </Link>
          
          {/* Quest Management Card */}
          <Link 
            to="/admin/quests" 
            className="block bg-gradient-to-r from-[#FFD23F] to-[#FFEB99] rounded-xl p-4 hover:shadow-lg transition-shadow"
            data-testid="quest-management-link"
          >
            <div className="flex flex-col items-center text-center gap-2">
              <div className="w-10 h-10 bg-[#1D3557] rounded-xl flex items-center justify-center">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#1D3557]">Quests</h3>
                <p className="text-[#1D3557]/70 text-xs">Q&A challenges</p>
              </div>
            </div>
          </Link>
          
          {/* Store Management Card */}
          <Link 
            to="/admin/store" 
            className="block bg-gradient-to-r from-[#EE6C4D] to-[#FF8A6C] rounded-xl p-4 hover:shadow-lg transition-shadow"
            data-testid="store-management-link"
          >
            <div className="flex flex-col items-center text-center gap-2">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Store className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Store</h3>
                <p className="text-white/70 text-xs">Items & categories</p>
              </div>
            </div>
          </Link>
          
          {/* Garden Plants Management Card */}
          <Link 
            to="/admin/garden" 
            className="block bg-gradient-to-r from-[#228B22] to-[#32CD32] rounded-xl p-4 hover:shadow-lg transition-shadow"
            data-testid="garden-management-link"
          >
            <div className="flex flex-col items-center text-center gap-2">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <span className="text-lg">🌱</span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Garden</h3>
                <p className="text-white/70 text-xs">G1-2 plants</p>
              </div>
            </div>
          </Link>
          
          {/* Stock Market Management Card */}
          <Link 
            to="/admin/stocks" 
            className="block bg-gradient-to-r from-[#1E40AF] to-[#3B82F6] rounded-xl p-4 hover:shadow-lg transition-shadow"
            data-testid="stock-management-link"
          >
            <div className="flex flex-col items-center text-center gap-2">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <span className="text-lg">📈</span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Stocks</h3>
                <p className="text-white/70 text-xs">G3-5 market</p>
              </div>
            </div>
          </Link>
          
          {/* Badge Management Card */}
          <Link 
            to="/admin/badges" 
            className="block bg-gradient-to-r from-[#9B5DE5] to-[#B07FF0] rounded-xl p-4 hover:shadow-lg transition-shadow"
            data-testid="badge-management-link"
          >
            <div className="flex flex-col items-center text-center gap-2">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <span className="text-lg">🏆</span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Badges</h3>
                <p className="text-white/70 text-xs">Achievements</p>
              </div>
            </div>
          </Link>
          
          {/* Investment Management Card */}
          <Link 
            to="/admin/investments" 
            className="block bg-gradient-to-r from-[#06D6A0] to-[#42E8B3] rounded-xl p-4 hover:shadow-lg transition-shadow"
            data-testid="investment-management-link"
          >
            <div className="flex flex-col items-center text-center gap-2">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Investments</h3>
                <p className="text-white/70 text-xs">Plants & stocks</p>
              </div>
            </div>
          </Link>
          
          {/* Video Management Card */}
          <Link 
            to="/admin/video" 
            className="block bg-gradient-to-r from-[#EE6C4D] to-[#F4A261] rounded-xl p-4 hover:shadow-lg transition-shadow"
            data-testid="video-management-link"
          >
            <div className="flex flex-col items-center text-center gap-2">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Video className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Video</h3>
                <p className="text-white/70 text-xs">Walkthrough</p>
              </div>
            </div>
          </Link>
          
          {/* Word Bank/Glossary Management Card */}
          <Link 
            to="/admin/glossary" 
            className="block bg-gradient-to-r from-[#4A90A4] to-[#6BB5C9] rounded-xl p-4 hover:shadow-lg transition-shadow"
            data-testid="glossary-management-link"
          >
            <div className="flex flex-col items-center text-center gap-2">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <BookMarked className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Word Bank</h3>
                <p className="text-white/70 text-xs">Glossary terms</p>
              </div>
            </div>
          </Link>
          
          {/* Teacher Repository Card */}
          <Link 
            to="/admin/repository" 
            className="block bg-gradient-to-r from-[#F59E0B] to-[#FBBF24] rounded-xl p-4 hover:shadow-lg transition-shadow"
            data-testid="repository-management-link"
          >
            <div className="flex flex-col items-center text-center gap-2">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <span className="text-lg">📁</span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Repository</h3>
                <p className="text-white/70 text-xs">Teacher resources</p>
              </div>
            </div>
          </Link>
          
          {/* Jobs Guidebook Card */}
          <button 
            onClick={() => setActiveTab('guidebook')}
            className="block w-full bg-gradient-to-r from-[#3D5A80] to-[#5A7BA0] rounded-xl p-4 hover:shadow-lg transition-shadow"
            data-testid="guidebook-management-link"
          >
            <div className="flex flex-col items-center text-center gap-2">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <span className="text-lg">📋</span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Jobs Guide</h3>
                <p className="text-white/70 text-xs">Child & Parent</p>
              </div>
            </div>
          </button>
          
          {/* Subscription Management Card */}
          <Link 
            to="/admin/subscriptions" 
            className="block bg-gradient-to-r from-[#06D6A0] to-[#34D399] rounded-xl p-4 hover:shadow-lg transition-shadow"
            data-testid="subscription-management-link"
          >
            <div className="flex flex-col items-center text-center gap-2">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <span className="text-lg">💳</span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Subscriptions</h3>
                <p className="text-white/70 text-xs">Plans & Payments</p>
              </div>
            </div>
          </Link>
        </div>
        
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
            { id: 'users', label: 'Users', icon: Users },
            { id: 'schools', label: 'Schools', icon: School },
            { id: 'enquiries', label: 'Enquiries', icon: Phone },
            { id: 'guidebook', label: 'Jobs Guide', icon: BookOpen },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
                activeTab === tab.id 
                  ? 'bg-[#1D3557] text-white' 
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
        
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* User Stats */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <Users className="w-8 h-8 text-[#3D5A80] mb-2" />
              <p className="text-3xl font-bold text-gray-800">{stats?.users?.total || 0}</p>
              <p className="text-sm text-gray-500">Total Users</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <span className="text-3xl block mb-2">🧒</span>
              <p className="text-3xl font-bold text-gray-800">{stats?.users?.children || 0}</p>
              <p className="text-sm text-gray-500">Children</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <span className="text-3xl block mb-2">👨‍👩‍👧</span>
              <p className="text-3xl font-bold text-gray-800">{stats?.users?.parents || 0}</p>
              <p className="text-sm text-gray-500">Parents</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <span className="text-3xl block mb-2">👩‍🏫</span>
              <p className="text-3xl font-bold text-gray-800">{stats?.users?.teachers || 0}</p>
              <p className="text-sm text-gray-500">Teachers</p>
            </div>
            
            {/* Content Stats */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <BookOpen className="w-8 h-8 text-[#06D6A0] mb-2" />
              <p className="text-3xl font-bold text-gray-800">{stats?.content?.topics || 0}</p>
              <p className="text-sm text-gray-500">Topics</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <span className="text-3xl block mb-2">📂</span>
              <p className="text-3xl font-bold text-gray-800">{stats?.content?.subtopics || 0}</p>
              <p className="text-sm text-gray-500">Subtopics</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <span className="text-3xl block mb-2">📄</span>
              <p className="text-3xl font-bold text-gray-800">{stats?.content?.total_content || 0}</p>
              <p className="text-sm text-gray-500">Content Items</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <span className="text-3xl block mb-2">✅</span>
              <p className="text-3xl font-bold text-gray-800">{stats?.engagement?.content_completed || 0}</p>
              <p className="text-sm text-gray-500">Completions</p>
            </div>
          </div>
        )}
        
        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">User Management</h2>
              <div className="flex items-center gap-3">
                {selectedUsers.size > 0 && (
                  <button
                    onClick={handleBulkDelete}
                    disabled={bulkDeleting}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                    data-testid="bulk-delete-btn"
                  >
                    <Trash2 className="w-4 h-4" />
                    {bulkDeleting ? 'Deleting...' : `Delete ${selectedUsers.size} Selected`}
                  </button>
                )}
                <Dialog open={showCreateUser} onOpenChange={setShowCreateUser}>
                <DialogTrigger asChild>
                  <button className="flex items-center gap-2 px-4 py-2 bg-[#06D6A0] text-white rounded-lg hover:bg-[#05C090] transition-colors">
                    <Plus className="w-4 h-4" />
                    Add User
                  </button>
                </DialogTrigger>
                <DialogContent className="bg-white border-2 border-gray-200 rounded-xl">
                  <DialogHeader>
                    <DialogTitle className="text-lg font-bold text-gray-800">Create New User</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                      <Input 
                        placeholder="Full name" 
                        value={newUserForm.name}
                        onChange={(e) => setNewUserForm({...newUserForm, name: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                      <Input 
                        type="email"
                        placeholder="email@example.com" 
                        value={newUserForm.email}
                        onChange={(e) => setNewUserForm({...newUserForm, email: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                      <div className="relative">
                        <Input 
                          type={showNewUserPassword ? "text" : "password"}
                          placeholder="Minimum 6 characters" 
                          value={newUserForm.password}
                          onChange={(e) => setNewUserForm({...newUserForm, password: e.target.value})}
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewUserPassword(!showNewUserPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        >
                          {showNewUserPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">User will use this password to login</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                      <Select 
                        value={newUserForm.role} 
                        onValueChange={(v) => setNewUserForm({...newUserForm, role: v})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="child">Child</SelectItem>
                          <SelectItem value="parent">Parent</SelectItem>
                          <SelectItem value="teacher">Teacher</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {newUserForm.role === 'child' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Grade</label>
                        <Select 
                          value={String(newUserForm.grade)} 
                          onValueChange={(v) => setNewUserForm({...newUserForm, grade: parseInt(v)})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">Kindergarten</SelectItem>
                            <SelectItem value="1">1st Grade</SelectItem>
                            <SelectItem value="2">2nd Grade</SelectItem>
                            <SelectItem value="3">3rd Grade</SelectItem>
                            <SelectItem value="4">4th Grade</SelectItem>
                            <SelectItem value="5">5th Grade</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <button
                      onClick={handleCreateUser}
                      className="w-full py-2 bg-[#06D6A0] text-white rounded-lg hover:bg-[#05C090] font-medium"
                    >
                      Create User
                    </button>
                  </div>
                </DialogContent>
              </Dialog>
              </div>
            </div>
            
            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 font-medium">Filters:</span>
              </div>
              <Select value={filters.role} onValueChange={(v) => setFilters({...filters, role: v})}>
                <SelectTrigger className="w-36 bg-white">
                  <SelectValue placeholder="User Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="child">Child</SelectItem>
                  <SelectItem value="parent">Parent</SelectItem>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="school">School</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.grade} onValueChange={(v) => setFilters({...filters, grade: v})}>
                <SelectTrigger className="w-36 bg-white">
                  <SelectValue placeholder="Grade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Grades</SelectItem>
                  <SelectItem value="none">No Grade</SelectItem>
                  <SelectItem value="0">K</SelectItem>
                  <SelectItem value="1">Grade 1</SelectItem>
                  <SelectItem value="2">Grade 2</SelectItem>
                  <SelectItem value="3">Grade 3</SelectItem>
                  <SelectItem value="4">Grade 4</SelectItem>
                  <SelectItem value="5">Grade 5</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.school} onValueChange={(v) => setFilters({...filters, school: v})}>
                <SelectTrigger className="w-44 bg-white">
                  <SelectValue placeholder="School" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Schools</SelectItem>
                  <SelectItem value="none">No School</SelectItem>
                  {schools.map(s => (
                    <SelectItem key={s.school_id} value={s.school_id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filters.subscription} onValueChange={(v) => setFilters({...filters, subscription: v})}>
                <SelectTrigger className="w-40 bg-white" data-testid="user-sub-filter">
                  <SelectValue placeholder="Subscription" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subscriptions</SelectItem>
                  <SelectItem value="active">Active Sub</SelectItem>
                  <SelectItem value="expired">Expired Sub</SelectItem>
                  <SelectItem value="inactive">No Subscription</SelectItem>
                </SelectContent>
              </Select>
              {(filters.role !== 'all' || filters.grade !== 'all' || filters.school !== 'all' || filters.subscription !== 'all' || userDateFrom || userDateTo) && (
                <button 
                  onClick={() => { setFilters({ role: 'all', grade: 'all', school: 'all', subscription: 'all' }); setUserDateFrom(null); setUserDateTo(null); }}
                  className="px-3 py-1 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 rounded flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" /> Clear
                </button>
              )}
              <Popover>
                <PopoverTrigger asChild>
                  <button className="h-8 px-3 text-xs border rounded-md flex items-center gap-1.5 hover:bg-gray-50" data-testid="user-date-from">
                    <CalendarIcon className="w-3.5 h-3.5 text-gray-400" />
                    {userDateFrom ? userDateFrom.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'From'}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={userDateFrom} onSelect={setUserDateFrom} />
                </PopoverContent>
              </Popover>
              <span className="text-gray-400 text-xs">to</span>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="h-8 px-3 text-xs border rounded-md flex items-center gap-1.5 hover:bg-gray-50" data-testid="user-date-to">
                    <CalendarIcon className="w-3.5 h-3.5 text-gray-400" />
                    {userDateTo ? userDateTo.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'To'}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={userDateTo} onSelect={setUserDateTo} />
                </PopoverContent>
              </Popover>
              <span className="ml-auto text-sm text-gray-500">
                Showing {filteredUsers.length} of {users.length} users
              </span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="py-3 px-3 w-10">
                      <input
                        type="checkbox"
                        checked={filteredUsers.length > 0 && selectedUsers.size === filteredUsers.length}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-gray-300 text-[#1D3557] focus:ring-[#1D3557] cursor-pointer"
                        data-testid="select-all-checkbox"
                      />
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">User</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Email</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Role</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Grade</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Subscription</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">School</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Sign Up</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Last Login</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.user_id} className={`border-b border-gray-100 hover:bg-gray-50 ${selectedUsers.has(u.user_id) ? 'bg-blue-50' : ''}`}>
                      <td className="py-3 px-3">
                        <input
                          type="checkbox"
                          checked={selectedUsers.has(u.user_id)}
                          onChange={() => toggleSelectUser(u.user_id)}
                          className="w-4 h-4 rounded border-gray-300 text-[#1D3557] focus:ring-[#1D3557] cursor-pointer"
                          data-testid={`select-user-${u.user_id}`}
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {u.picture ? (
                            <img src={u.picture} alt="" className="w-8 h-8 rounded-full" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-[#3D5A80] text-white flex items-center justify-center text-sm font-bold">
                              {u.name?.charAt(0) || '?'}
                            </div>
                          )}
                          <span className="font-medium text-gray-800">{u.name || 'Unknown'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-600">{u.email}</td>
                      <td className="py-3 px-4">
                        <Select 
                          value={u.role || 'child'} 
                          onValueChange={(value) => handleRoleChange(u.user_id, value)}
                        >
                          <SelectTrigger className="w-32">
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
                      <td className="py-3 px-4">
                        <Select 
                          value={u.grade !== null && u.grade !== undefined ? String(u.grade) : 'none'} 
                          onValueChange={(value) => handleGradeChange(u.user_id, value === 'none' ? null : value)}
                        >
                          <SelectTrigger className="w-28">
                            <SelectValue placeholder="-" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">-</SelectItem>
                            <SelectItem value="0">K</SelectItem>
                            <SelectItem value="1">Grade 1</SelectItem>
                            <SelectItem value="2">Grade 2</SelectItem>
                            <SelectItem value="3">Grade 3</SelectItem>
                            <SelectItem value="4">Grade 4</SelectItem>
                            <SelectItem value="5">Grade 5</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-3 px-4">
                        {(u.role === 'parent' || u.role === 'child') ? (
                          <button
                            onClick={() => {
                              setSubDialog({ open: true, userId: u.user_id, userName: u.name, currentStatus: u.subscription_status });
                              setSubDuration('1_month');
                            }}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                              u.subscription_status === 'active'
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : u.subscription_status === 'expired'
                                ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                                : 'bg-red-100 text-red-700 hover:bg-red-200'
                            }`}
                            data-testid={`sub-status-${u.user_id}`}
                          >
                            <CreditCard className="w-3 h-3" />
                            {u.subscription_status === 'active' ? 'Active' : u.subscription_status === 'expired' ? 'Expired' : 'Inactive'}
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs">N/A</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {u.school_name ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-sm">
                            <School className="w-3 h-3" />
                            {u.school_name}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-600 text-sm">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        }) : '-'}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {u.last_login_at ? (
                          <div>
                            <span className={`${
                              // Highlight if logged in within last 24 hours
                              (new Date() - new Date(u.last_login_at)) < 24 * 60 * 60 * 1000
                                ? 'text-green-600 font-medium'
                                : (new Date() - new Date(u.last_login_at)) < 7 * 24 * 60 * 60 * 1000
                                  ? 'text-gray-600'
                                  : 'text-orange-500'
                            }`}>
                              {new Date(u.last_login_at).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </span>
                            <span className="block text-xs text-gray-400">
                              {new Date(u.last_login_at).toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400">Never</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleDeleteUser(u.user_id, u.name)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete user"
                          disabled={u.user_id === user?.user_id}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {/* Schools Tab */}
        {activeTab === 'schools' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">School Management</h2>
              <Dialog open={showCreateSchool} onOpenChange={setShowCreateSchool}>
                <DialogTrigger asChild>
                  <button 
                    className="flex items-center gap-2 px-4 py-2 bg-[#1D3557] text-white rounded-lg hover:bg-[#2A4A6B] transition-colors"
                    data-testid="add-school-btn"
                  >
                    <Plus className="w-4 h-4" />
                    Add School
                  </button>
                </DialogTrigger>
                <DialogContent className="bg-white border-2 border-gray-200 rounded-xl">
                  <DialogHeader>
                    <DialogTitle className="text-lg font-bold text-gray-800">Create New School</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">School Name *</label>
                      <Input 
                        placeholder="e.g., Springfield Elementary" 
                        value={newSchoolForm.name}
                        onChange={(e) => setNewSchoolForm({...newSchoolForm, name: e.target.value})}
                        data-testid="school-name-input"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
                      <Input 
                        placeholder="Login username" 
                        value={newSchoolForm.username}
                        onChange={(e) => setNewSchoolForm({...newSchoolForm, username: e.target.value})}
                        data-testid="school-username-input"
                      />
                      <p className="text-xs text-gray-500 mt-1">This will be used to login to the school portal</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                      <div className="relative">
                        <Input 
                          type={showNewSchoolPassword ? "text" : "password"}
                          placeholder="Set a secure password" 
                          value={newSchoolForm.password}
                          onChange={(e) => setNewSchoolForm({...newSchoolForm, password: e.target.value})}
                          data-testid="school-password-input"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewSchoolPassword(!showNewSchoolPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        >
                          {showNewSchoolPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                      <Input 
                        placeholder="School address (optional)" 
                        value={newSchoolForm.address}
                        onChange={(e) => setNewSchoolForm({...newSchoolForm, address: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
                      <Input 
                        type="email"
                        placeholder="admin@school.edu (optional)" 
                        value={newSchoolForm.contact_email}
                        onChange={(e) => setNewSchoolForm({...newSchoolForm, contact_email: e.target.value})}
                      />
                    </div>
                    <button
                      onClick={handleCreateSchool}
                      className="w-full py-2 bg-[#1D3557] text-white rounded-lg hover:bg-[#2A4A6B] font-medium"
                      data-testid="create-school-submit"
                    >
                      Create School
                    </button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            
            {schools.length === 0 ? (
              <div className="text-center py-12">
                <School className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">No Schools Yet</h3>
                <p className="text-gray-500 mb-4">Create your first school to start managing educational institutions</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {schools.map((school) => (
                  <div 
                    key={school.school_id} 
                    className="bg-gradient-to-br from-[#1D3557] to-[#3D5A80] rounded-xl p-5 text-white relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-12 -mt-12"></div>
                    <div className="relative z-10">
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                          <School className="w-6 h-6" />
                        </div>
                        <button
                          onClick={() => handleDeleteSchool(school.school_id, school.name)}
                          className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                          title="Delete school"
                          data-testid={`delete-school-${school.school_id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <h3 className="text-lg font-bold mb-1">{school.name}</h3>
                      <p className="text-white/70 text-sm mb-3">@{school.username}</p>
                      <div className="flex gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4 text-white/70" />
                          <span>{school.teacher_count || 0} Teachers</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4 text-white/70" />
                          <span>{school.student_count || 0} Students</span>
                        </div>
                      </div>
                      {school.contact_email && (
                        <p className="text-white/60 text-xs mt-2 truncate">{school.contact_email}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Enquiries Tab */}
        {activeTab === 'enquiries' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Phone className="w-5 h-5 text-[#EE6C4D]" />
              School Subscription Enquiries
              {enquiries.length > 0 && (
                <span className="text-xs bg-[#EE6C4D] text-white px-2 py-0.5 rounded-full">{enquiries.length}</span>
              )}
            </h2>
            {enquiries.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No enquiries yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="enquiries-table">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-3 font-medium text-gray-600">Date</th>
                      <th className="text-left py-3 px-3 font-medium text-gray-600">School</th>
                      <th className="text-left py-3 px-3 font-medium text-gray-600">Contact Person</th>
                      <th className="text-left py-3 px-3 font-medium text-gray-600">Phone</th>
                      <th className="text-left py-3 px-3 font-medium text-gray-600">Email</th>
                      <th className="text-left py-3 px-3 font-medium text-gray-600">City</th>
                      <th className="text-left py-3 px-3 font-medium text-gray-600">Grades</th>
                      <th className="text-left py-3 px-3 font-medium text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enquiries.map((enq) => (
                      <tr key={enq.enquiry_id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-3 text-gray-500 whitespace-nowrap">
                          {new Date(enq.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="py-3 px-3 font-medium text-gray-800">{enq.school_name}</td>
                        <td className="py-3 px-3">
                          <div>{enq.person_name}</div>
                          {enq.designation && <div className="text-xs text-gray-400">{enq.designation}</div>}
                        </td>
                        <td className="py-3 px-3">{enq.contact_number}</td>
                        <td className="py-3 px-3 text-blue-600">{enq.email}</td>
                        <td className="py-3 px-3 text-gray-500">{enq.city || '-'}</td>
                        <td className="py-3 px-3">
                          {enq.grades?.length > 0 ? enq.grades.map(g => (
                            <span key={g} className="inline-block bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full mr-1 mb-1">
                              {g.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                            </span>
                          )) : <span className="text-gray-400">-</span>}
                        </td>
                        <td className="py-3 px-3">
                          <Select
                            value={enq.status}
                            onValueChange={async (val) => {
                              try {
                                await axios.put(`${API}/admin/school-enquiries/${enq.enquiry_id}/status`, { status: val });
                                setEnquiries(prev => prev.map(e => e.enquiry_id === enq.enquiry_id ? { ...e, status: val } : e));
                                toast.success('Status updated');
                              } catch { toast.error('Failed to update'); }
                            }}
                          >
                            <SelectTrigger className="w-28 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="new"><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />New</span></SelectItem>
                              <SelectItem value="contacted"><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />Contacted</span></SelectItem>
                              <SelectItem value="converted"><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" />Converted</span></SelectItem>
                              <SelectItem value="closed"><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />Closed</span></SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Guidebook Tab */}
        {activeTab === 'guidebook' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">Jobs Guidebook Management</h2>
              <Button
                disabled={guidebookSaving}
                onClick={async () => {
                  setGuidebookSaving(true);
                  try {
                    await axios.put(`${API}/admin/jobs/guidebook`, guidebook);
                    toast.success('Guidebook updated!');
                  } catch (err) {
                    toast.error('Failed to save');
                  } finally {
                    setGuidebookSaving(false);
                  }
                }}
                className="bg-[#06D6A0] hover:bg-[#05C493] text-white"
                data-testid="save-guidebook-btn"
              >
                {guidebookSaving ? 'Saving...' : 'Save Guidebook'}
              </Button>
            </div>
            <p className="text-sm text-gray-500">Edit the guidebook content shown to children and parents on the "My Jobs" page. Supports Markdown-style formatting (### for headings, **bold**).</p>
            
            <div className="bg-white rounded-xl border-2 border-gray-200 p-5">
              <h3 className="font-bold text-[#1D3557] mb-2">Child's Guide</h3>
              <p className="text-xs text-gray-400 mb-2">This is shown to children when they click "Guide" on My Jobs.</p>
              <textarea
                className="w-full h-48 border-2 border-gray-300 rounded-lg p-3 text-sm font-mono resize-y focus:border-[#3D5A80] focus:outline-none"
                value={guidebook.child_guide}
                onChange={(e) => setGuidebook(g => ({ ...g, child_guide: e.target.value }))}
                placeholder="### My Jobs Guide..."
                data-testid="child-guide-textarea"
              />
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <label className="text-xs font-bold text-[#1D3557] block mb-1">Voice Guide (Audio) for Children</label>
                <p className="text-xs text-gray-400 mb-2">Upload an audio file so children can listen instead of reading.</p>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="audio/*"
                    data-testid="child-audio-upload"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        toast.info('Uploading audio...');
                        const url = await uploadFile(file, 'audio');
                        setGuidebook(g => ({ ...g, child_audio_url: url }));
                        toast.success('Audio uploaded! Remember to Save.');
                      } catch (err) {
                        toast.error('Failed to upload audio');
                      }
                    }}
                    className="text-xs"
                  />
                  {guidebook.child_audio_url && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#06D6A0] font-medium">Audio uploaded</span>
                      <button
                        type="button"
                        onClick={() => setGuidebook(g => ({ ...g, child_audio_url: '' }))}
                        className="text-xs text-red-500 hover:underline"
                      >Remove</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl border-2 border-gray-200 p-5">
              <h3 className="font-bold text-[#1D3557] mb-2">Parent's Guide</h3>
              <p className="text-xs text-gray-400 mb-2">This is shown to parents to help them manage their child's jobs.</p>
              <textarea
                className="w-full h-48 border-2 border-gray-300 rounded-lg p-3 text-sm font-mono resize-y focus:border-[#3D5A80] focus:outline-none"
                value={guidebook.parent_guide}
                onChange={(e) => setGuidebook(g => ({ ...g, parent_guide: e.target.value }))}
                placeholder="### Parent's Guide to My Jobs..."
                data-testid="parent-guide-textarea"
              />
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <label className="text-xs font-bold text-[#1D3557] block mb-1">Voice Guide (Audio) for Parents</label>
                <p className="text-xs text-gray-400 mb-2">Upload an audio file for parents to listen to.</p>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="audio/*"
                    data-testid="parent-audio-upload"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        toast.info('Uploading audio...');
                        const url = await uploadFile(file, 'audio');
                        setGuidebook(g => ({ ...g, parent_audio_url: url }));
                        toast.success('Audio uploaded! Remember to Save.');
                      } catch (err) {
                        toast.error('Failed to upload audio');
                      }
                    }}
                    className="text-xs"
                  />
                  {guidebook.parent_audio_url && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#06D6A0] font-medium">Audio uploaded</span>
                      <button
                        type="button"
                        onClick={() => setGuidebook(g => ({ ...g, parent_audio_url: '' }))}
                        className="text-xs text-red-500 hover:underline"
                      >Remove</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Subscription Management Dialog */}
      <Dialog open={subDialog.open} onOpenChange={(open) => !open && setSubDialog({ ...subDialog, open: false })}>
        <DialogContent className="bg-white border-2 border-gray-200 rounded-xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#06D6A0]" />
              Manage Subscription
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-gray-600">
              User: <span className="font-semibold">{subDialog.userName}</span>
            </p>
            <p className="text-sm text-gray-600">
              Current Status: {' '}
              <span className={`font-semibold ${subDialog.currentStatus === 'active' ? 'text-green-600' : subDialog.currentStatus === 'expired' ? 'text-orange-600' : 'text-red-600'}`}>
                {subDialog.currentStatus === 'active' ? 'Active' : subDialog.currentStatus === 'expired' ? 'Expired' : 'Inactive'}
              </span>
            </p>

            {subDialog.currentStatus !== 'active' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Clock className="w-3.5 h-3.5 inline mr-1" />
                    Subscription Duration
                  </label>
                  <Select value={subDuration} onValueChange={setSubDuration}>
                    <SelectTrigger data-testid="sub-duration-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1_day">1 Day</SelectItem>
                      <SelectItem value="1_week">1 Week</SelectItem>
                      <SelectItem value="1_month">1 Month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <button
                  onClick={() => handleSubscriptionChange('active', subDuration)}
                  className="w-full py-2 bg-[#06D6A0] text-white rounded-lg hover:bg-[#05C090] font-medium"
                  data-testid="activate-sub-btn"
                >
                  Activate Subscription
                </button>
              </>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Clock className="w-3.5 h-3.5 inline mr-1" />
                    Extend / Change Duration
                  </label>
                  <Select value={subDuration} onValueChange={setSubDuration}>
                    <SelectTrigger data-testid="sub-duration-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1_day">1 Day</SelectItem>
                      <SelectItem value="1_week">1 Week</SelectItem>
                      <SelectItem value="1_month">1 Month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <button
                  onClick={() => handleSubscriptionChange('active', subDuration)}
                  className="w-full py-2 bg-[#3D5A80] text-white rounded-lg hover:bg-[#2A4A6B] font-medium"
                  data-testid="extend-sub-btn"
                >
                  Renew Subscription
                </button>
                <button
                  onClick={() => handleSubscriptionChange('inactive')}
                  className="w-full py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 font-medium"
                  data-testid="deactivate-sub-btn"
                >
                  Deactivate Subscription
                </button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
