import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { 
  Shield, ChevronLeft, ChevronRight, Users, BookOpen, BarChart3,
  Trash2, Edit2, Library, Store, TrendingUp, LogOut, User, Target, Plus, School
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [newUserForm, setNewUserForm] = useState({
    name: '',
    email: '',
    role: 'child',
    grade: 0
  });
  const [newSchoolForm, setNewSchoolForm] = useState({
    name: '',
    username: '',
    password: '',
    address: '',
    contact_email: ''
  });
  
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
  
  const handleDeleteUser = async (userId, userName) => {
    if (!confirm(`Are you sure you want to delete ${userName}? This will delete ALL their data permanently.`)) {
      return;
    }
    
    try {
      await axios.delete(`${API}/admin/users/${userId}`);
      toast.success(`User ${userName} deleted`);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete user');
    }
  };
  
  const handleCreateUser = async () => {
    if (!newUserForm.name || !newUserForm.email) {
      toast.error('Name and email are required');
      return;
    }
    
    try {
      await axios.post(`${API}/admin/users`, newUserForm);
      toast.success(`User ${newUserForm.name} created`);
      setShowCreateUser(false);
      setNewUserForm({ name: '', email: '', role: 'child', grade: 0 });
      fetchData();
    } catch (error) {
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
        {/* Management Cards Grid - 2x2 Layout */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          {/* Content Management Card */}
          <Link 
            to="/admin/content" 
            className="block bg-gradient-to-r from-[#3D5A80] to-[#5A7BA0] rounded-xl p-5 hover:shadow-lg transition-shadow"
            data-testid="content-management-link"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Library className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Content Management</h3>
                  <p className="text-white/80 text-sm">Manage topics, subtopics & content</p>
                </div>
              </div>
              <ChevronRight className="w-6 h-6 text-white" />
            </div>
          </Link>
          
          {/* Quest Management Card */}
          <Link 
            to="/admin/quests" 
            className="block bg-gradient-to-r from-[#FFD23F] to-[#FFEB99] rounded-xl p-5 hover:shadow-lg transition-shadow"
            data-testid="quest-management-link"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#1D3557] rounded-xl flex items-center justify-center">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#1D3557]">Quest Management</h3>
                  <p className="text-[#1D3557]/80 text-sm">Create Q&A quests with rewards</p>
                </div>
              </div>
              <ChevronRight className="w-6 h-6 text-[#1D3557]" />
            </div>
          </Link>
          
          {/* Store Management Card */}
          <Link 
            to="/admin/store" 
            className="block bg-gradient-to-r from-[#EE6C4D] to-[#FF8A6C] rounded-xl p-5 hover:shadow-lg transition-shadow"
            data-testid="store-management-link"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Store className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Store Management</h3>
                  <p className="text-white/80 text-sm">Manage store categories & items</p>
                </div>
              </div>
              <ChevronRight className="w-6 h-6 text-white" />
            </div>
          </Link>
          
          {/* Garden Plants Management Card */}
          <Link 
            to="/admin/garden" 
            className="block bg-gradient-to-r from-[#228B22] to-[#32CD32] rounded-xl p-5 hover:shadow-lg transition-shadow"
            data-testid="garden-management-link"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">🌱</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Garden Plants (G1-2)</h3>
                  <p className="text-white/80 text-sm">Manage seeds & plant types</p>
                </div>
              </div>
              <ChevronRight className="w-6 h-6 text-white" />
            </div>
          </Link>
          
          {/* Stock Market Management Card */}
          <Link 
            to="/admin/stocks" 
            className="block bg-gradient-to-r from-[#1E40AF] to-[#3B82F6] rounded-xl p-5 hover:shadow-lg transition-shadow"
            data-testid="stock-management-link"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">📈</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Stock Market (G3-5)</h3>
                  <p className="text-white/80 text-sm">Manage stocks, news & categories</p>
                </div>
              </div>
              <ChevronRight className="w-6 h-6 text-white" />
            </div>
          </Link>
          
          {/* Investment Management Card */}
          <Link 
            to="/admin/investments" 
            className="block bg-gradient-to-r from-[#06D6A0] to-[#42E8B3] rounded-xl p-5 hover:shadow-lg transition-shadow"
            data-testid="investment-management-link"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Investment Management</h3>
                  <p className="text-white/80 text-sm">Manage plants (K-2) & stocks (3-5)</p>
                </div>
              </div>
              <ChevronRight className="w-6 h-6 text-white" />
            </div>
          </Link>
        </div>
        
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
            { id: 'users', label: 'Users', icon: Users },
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
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-600">User</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Email</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Role</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Grade</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.user_id} className="border-b border-gray-100 hover:bg-gray-50">
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
                      <td className="py-3 px-4 text-gray-600">
                        {u.grade !== null && u.grade !== undefined 
                          ? (u.grade === 0 ? 'K' : `Grade ${u.grade}`)
                          : '-'
                        }
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
      </main>
    </div>
  );
}
