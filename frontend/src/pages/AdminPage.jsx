import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { 
  Shield, ChevronLeft, ChevronRight, Users, BookOpen, BarChart3,
  Trash2, Edit2, Library, Store, TrendingUp, LogOut, User
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function AdminPage({ user }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  
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
      const [statsRes, usersRes] = await Promise.all([
        axios.get(`${API}/admin/stats`),
        axios.get(`${API}/admin/users`)
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data);
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
        {/* Content Management Card */}
        <Link 
          to="/admin/content" 
          className="mb-6 block bg-gradient-to-r from-[#3D5A80] to-[#5A7BA0] rounded-xl p-5 hover:shadow-lg transition-shadow"
          data-testid="content-management-link"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Library className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Content Management</h3>
                <p className="text-white/80 text-sm">Manage topics, subtopics, and learning content</p>
              </div>
            </div>
            <ChevronRight className="w-6 h-6 text-white" />
          </div>
        </Link>
        
        {/* Store & Investment Management Grid */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
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
                  <p className="text-white/80 text-sm">Manage store categories and items</p>
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
                  <p className="text-white/80 text-sm">Manage plants (K-2) and stocks (3-5)</p>
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
            <h2 className="text-lg font-bold text-gray-800 mb-4">User Management</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-600">User</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Email</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Role</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Grade</th>
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
