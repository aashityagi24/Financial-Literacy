import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { API } from '@/App';
import {
  School, Users, GraduationCap, BookOpen, LogOut, BarChart3, 
  Upload, ChevronDown, ChevronUp, Search, Download, FileText,
  TrendingUp, Wallet, Target, Award, RefreshCw, X, Check, AlertCircle,
  UserPlus, Baby
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function SchoolDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [school, setSchool] = useState(location.state?.school || null);
  const [dashboardData, setDashboardData] = useState(null);
  const [comparisonData, setComparisonData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  
  // CSV Upload State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadType, setUploadType] = useState('teachers');
  const [csvData, setCsvData] = useState([]);
  const [csvPreview, setCsvPreview] = useState([]);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  
  // Individual User Creation State
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [addUserType, setAddUserType] = useState('teacher');
  const [addUserForm, setAddUserForm] = useState({ name: '', email: '', grade: '3', parent_email: '', classroom_code: '' });
  const [addUserLoading, setAddUserLoading] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [dashRes, compRes] = await Promise.all([
        axios.get(`${API}/school/dashboard`, { withCredentials: true }),
        axios.get(`${API}/school/students/comparison`, { withCredentials: true })
      ]);
      
      setDashboardData(dashRes.data);
      setComparisonData(compRes.data);
      
      if (dashRes.data.school) {
        setSchool(dashRes.data.school);
      }
    } catch (error) {
      if (error.response?.status === 401) {
        toast.error('Session expired. Please login again.');
        navigate('/school-login');
      } else {
        toast.error('Failed to load dashboard data');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
      toast.success('Logged out successfully');
      navigate('/');
    } catch (error) {
      navigate('/');
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        toast.error('CSV file must have a header row and at least one data row');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const data = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const row = {};
        
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        
        // Validate required fields based on upload type
        if (uploadType === 'students') {
          if (row.name && row.email && row.grade !== undefined) {
            row.grade = parseInt(row.grade) || 0;
            data.push(row);
          }
        } else {
          if (row.name && row.email) {
            data.push(row);
          }
        }
      }
      
      setCsvData(data);
      setCsvPreview(data.slice(0, 5));
    };
    
    reader.readAsText(file);
  };

  const handleBulkUpload = async () => {
    if (csvData.length === 0) {
      toast.error('No valid data to upload');
      return;
    }

    setUploadLoading(true);
    setUploadResult(null);

    try {
      const endpoint = `/school/upload/${uploadType}`;
      const response = await axios.post(
        `${API}${endpoint}`,
        { data: csvData },
        { withCredentials: true }
      );
      
      setUploadResult(response.data);
      toast.success(`Successfully processed ${response.data.created || 0} ${uploadType}`);
      fetchDashboardData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Upload failed');
      setUploadResult({ errors: [error.response?.data?.detail || 'Upload failed'] });
    } finally {
      setUploadLoading(false);
    }
  };

  const resetUploadModal = () => {
    setCsvData([]);
    setCsvPreview([]);
    setUploadResult(null);
    setShowUploadModal(false);
  };

  const handleAddUser = async () => {
    if (!addUserForm.name.trim() || !addUserForm.email.trim()) {
      toast.error('Name and email are required');
      return;
    }
    
    setAddUserLoading(true);
    try {
      const payload = { 
        name: addUserForm.name.trim(), 
        email: addUserForm.email.trim().toLowerCase() 
      };
      
      if (addUserType === 'child') {
        payload.grade = parseInt(addUserForm.grade);
        if (addUserForm.parent_email.trim()) {
          payload.parent_email = addUserForm.parent_email.trim().toLowerCase();
        }
        if (addUserForm.classroom_code.trim()) {
          payload.classroom_code = addUserForm.classroom_code.trim().toUpperCase();
        }
      }
      
      const response = await axios.post(
        `${API}/school/users/${addUserType}`,
        payload,
        { withCredentials: true }
      );
      
      toast.success(response.data.message);
      setShowAddUserModal(false);
      setAddUserForm({ name: '', email: '', grade: '3', parent_email: '', classroom_code: '' });
      fetchDashboardData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create user');
    } finally {
      setAddUserLoading(false);
    }
  };

  const getGradeLabel = (grade) => {
    if (grade === 0) return 'K';
    return `G${grade}`;
  };

  // Filter and sort students
  const getFilteredStudents = () => {
    if (!comparisonData?.students) return [];
    
    let filtered = comparisonData.students.filter(student => {
      const query = searchQuery.toLowerCase();
      return (
        student.name?.toLowerCase().includes(query) ||
        student.email?.toLowerCase().includes(query) ||
        student.teacher_name?.toLowerCase().includes(query) ||
        student.classroom_name?.toLowerCase().includes(query)
      );
    });
    
    filtered.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal?.toLowerCase() || '';
      }
      
      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
    
    return filtered;
  };

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (field) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? 
      <ChevronUp className="w-4 h-4 inline ml-1" /> : 
      <ChevronDown className="w-4 h-4 inline ml-1" />;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 border-4 border-[#1D3557] border-t-[#FFD23F] rounded-full animate-spin"></div>
          <p className="text-lg font-semibold text-[#1D3557]">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#1D3557] to-[#3D5A80] text-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <School className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">{school?.name || 'School Dashboard'}</h1>
                <p className="text-white/70 text-sm">School Administration Portal</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={fetchDashboardData}
                variant="ghost"
                className="text-white hover:bg-white/10"
                data-testid="refresh-dashboard-btn"
              >
                <RefreshCw className="w-5 h-5" />
              </Button>
              <Button
                onClick={handleLogout}
                variant="ghost"
                className="text-white hover:bg-white/10"
                data-testid="school-logout-btn"
              >
                <LogOut className="w-5 h-5 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#3D5A80]/10 rounded-xl flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-[#3D5A80]" />
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-800">{dashboardData?.stats?.total_teachers || 0}</p>
                <p className="text-sm text-gray-500">Total Teachers</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#06D6A0]/10 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-[#06D6A0]" />
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-800">{dashboardData?.stats?.total_students || 0}</p>
                <p className="text-sm text-gray-500">Total Students</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#FFD23F]/10 rounded-xl flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-[#FFD23F]" />
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-800">{dashboardData?.stats?.total_classrooms || 0}</p>
                <p className="text-sm text-gray-500">Total Classrooms</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'teachers', label: 'Teachers', icon: GraduationCap },
            { id: 'students', label: 'Students', icon: Users },
            { id: 'comparison', label: 'Performance', icon: TrendingUp },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
                activeTab === tab.id
                  ? 'bg-[#1D3557] text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
              data-testid={`tab-${tab.id}`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
          
          {/* Add User Button */}
          <button
            onClick={() => setShowAddUserModal(true)}
            className="px-4 py-2 rounded-lg font-medium flex items-center gap-2 bg-[#3D5A80] text-white hover:bg-[#2D4A70] transition-colors ml-auto"
            data-testid="add-user-btn"
          >
            <UserPlus className="w-4 h-4" />
            Add User
          </button>
          
          {/* Bulk Upload Button */}
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-4 py-2 rounded-lg font-medium flex items-center gap-2 bg-[#06D6A0] text-white hover:bg-[#05C090] transition-colors"
            data-testid="bulk-upload-btn"
          >
            <Upload className="w-4 h-4" />
            Bulk Upload
          </button>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Recent Teachers */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-[#3D5A80]" />
                Teachers ({dashboardData?.teachers?.length || 0})
              </h3>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {dashboardData?.teachers?.slice(0, 10).map((teacher) => (
                  <div key={teacher.user_id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-10 h-10 bg-[#3D5A80] rounded-full flex items-center justify-center text-white font-bold">
                      {teacher.name?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 truncate">{teacher.name}</p>
                      <p className="text-sm text-gray-500 truncate">{teacher.email}</p>
                    </div>
                  </div>
                ))}
                {(!dashboardData?.teachers || dashboardData.teachers.length === 0) && (
                  <p className="text-gray-500 text-center py-4">No teachers assigned yet</p>
                )}
              </div>
            </div>

            {/* Recent Students */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-[#06D6A0]" />
                Students ({dashboardData?.students?.length || 0})
              </h3>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {dashboardData?.students?.slice(0, 10).map((student) => (
                  <div key={student.user_id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-10 h-10 bg-[#06D6A0] rounded-full flex items-center justify-center text-white font-bold">
                      {student.name?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 truncate">{student.name}</p>
                      <p className="text-sm text-gray-500 truncate">
                        {student.email} • {getGradeLabel(student.grade)}
                      </p>
                    </div>
                    {student.teacher_name && (
                      <span className="text-xs bg-[#3D5A80]/10 text-[#3D5A80] px-2 py-1 rounded">
                        {student.teacher_name}
                      </span>
                    )}
                  </div>
                ))}
                {(!dashboardData?.students || dashboardData.students.length === 0) && (
                  <p className="text-gray-500 text-center py-4">No students enrolled yet</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Teachers Tab */}
        {activeTab === 'teachers' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    placeholder="Search teachers..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-testid="search-teachers-input"
                  />
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Name</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Email</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardData?.teachers?.filter(t => 
                    t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    t.email?.toLowerCase().includes(searchQuery.toLowerCase())
                  ).map((teacher) => (
                    <tr key={teacher.user_id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-[#3D5A80] rounded-full flex items-center justify-center text-white text-sm font-bold">
                            {teacher.name?.charAt(0) || '?'}
                          </div>
                          <span className="font-medium text-gray-800">{teacher.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-600">{teacher.email}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                          Active
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!dashboardData?.teachers || dashboardData.teachers.length === 0) && (
                <div className="p-8 text-center text-gray-500">
                  No teachers found. Use bulk upload to add teachers.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Students Tab */}
        {activeTab === 'students' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    placeholder="Search students..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-testid="search-students-input"
                  />
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Name</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Email</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Grade</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Teacher</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardData?.students?.filter(s => 
                    s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    s.email?.toLowerCase().includes(searchQuery.toLowerCase())
                  ).map((student) => (
                    <tr key={student.user_id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-[#06D6A0] rounded-full flex items-center justify-center text-white text-sm font-bold">
                            {student.name?.charAt(0) || '?'}
                          </div>
                          <span className="font-medium text-gray-800">{student.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-600">{student.email}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 bg-[#FFD23F]/20 text-[#1D3557] text-xs rounded-full font-medium">
                          {getGradeLabel(student.grade)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600">{student.teacher_name || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!dashboardData?.students || dashboardData.students.length === 0) && (
                <div className="p-8 text-center text-gray-500">
                  No students found. Use bulk upload to add students.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Performance Comparison Tab */}
        {activeTab === 'comparison' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-800">Student Performance Comparison</h3>
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    placeholder="Search..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-testid="search-comparison-input"
                  />
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th 
                      className="text-left py-3 px-4 font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                      onClick={() => toggleSort('name')}
                    >
                      Student {renderSortIcon("name")}
                    </th>
                    <th 
                      className="text-left py-3 px-4 font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                      onClick={() => toggleSort('grade')}
                    >
                      Grade {renderSortIcon("grade")}
                    </th>
                    <th 
                      className="text-left py-3 px-4 font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                      onClick={() => toggleSort('teacher_name')}
                    >
                      Teacher {renderSortIcon("teacher_name")}
                    </th>
                    <th 
                      className="text-left py-3 px-4 font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                      onClick={() => toggleSort('total_balance')}
                    >
                      Balance {renderSortIcon("total_balance")}
                    </th>
                    <th 
                      className="text-left py-3 px-4 font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                      onClick={() => toggleSort('lessons_completed')}
                    >
                      Lessons {renderSortIcon("lessons_completed")}
                    </th>
                    <th 
                      className="text-left py-3 px-4 font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                      onClick={() => toggleSort('quests_completed')}
                    >
                      Quests {renderSortIcon("quests_completed")}
                    </th>
                    <th 
                      className="text-left py-3 px-4 font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                      onClick={() => toggleSort('streak')}
                    >
                      Streak {renderSortIcon("streak")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {getFilteredStudents().map((student, idx) => (
                    <tr key={student.student_id} className={`border-b border-gray-100 hover:bg-gray-50 ${idx < 3 ? 'bg-yellow-50/30' : ''}`}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {idx < 3 && (
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              idx === 0 ? 'bg-yellow-400 text-yellow-900' :
                              idx === 1 ? 'bg-gray-300 text-gray-700' :
                              'bg-orange-300 text-orange-800'
                            }`}>
                              {idx + 1}
                            </span>
                          )}
                          <span className="font-medium text-gray-800">{student.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 bg-[#FFD23F]/20 text-[#1D3557] text-xs rounded-full font-medium">
                          {getGradeLabel(student.grade)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600">{student.teacher_name}</td>
                      <td className="py-3 px-4">
                        <span className="flex items-center gap-1 text-[#06D6A0] font-medium">
                          <Wallet className="w-4 h-4" />
                          ₹{student.total_balance}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="flex items-center gap-1 text-[#3D5A80]">
                          <BookOpen className="w-4 h-4" />
                          {student.lessons_completed}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="flex items-center gap-1 text-[#EE6C4D]">
                          <Target className="w-4 h-4" />
                          {student.quests_completed}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="flex items-center gap-1 text-[#FFD23F]">
                          <Award className="w-4 h-4" />
                          {student.streak}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {getFilteredStudents().length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  No student data available
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* CSV Upload Modal */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="bg-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-[#06D6A0]" />
              Bulk Upload Users
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            {/* Upload Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Type
              </label>
              <Select value={uploadType} onValueChange={setUploadType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="teachers">Teachers</SelectItem>
                  <SelectItem value="students">Students</SelectItem>
                  <SelectItem value="parents">Parents</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* CSV Format Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-800 mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                CSV Format
              </h4>
              <p className="text-sm text-blue-700">
                {uploadType === 'students' ? (
                  <>Required columns: <code className="bg-blue-100 px-1 rounded">name</code>, <code className="bg-blue-100 px-1 rounded">email</code>, <code className="bg-blue-100 px-1 rounded">grade</code> (0-5)</>
                ) : (
                  <>Required columns: <code className="bg-blue-100 px-1 rounded">name</code>, <code className="bg-blue-100 px-1 rounded">email</code></>
                )}
              </p>
              <p className="text-xs text-blue-600 mt-1">
                First row should contain headers
              </p>
            </div>

            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload CSV File
              </label>
              <Input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="cursor-pointer"
                data-testid="csv-file-input"
              />
            </div>

            {/* Preview */}
            {csvPreview.length > 0 && (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                  <span className="font-medium text-gray-700">
                    Preview ({csvData.length} valid rows)
                  </span>
                </div>
                <div className="overflow-x-auto max-h-48">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="text-left py-2 px-3">Name</th>
                        <th className="text-left py-2 px-3">Email</th>
                        {uploadType === 'students' && (
                          <th className="text-left py-2 px-3">Grade</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.map((row, idx) => (
                        <tr key={idx} className="border-t border-gray-100">
                          <td className="py-2 px-3">{row.name}</td>
                          <td className="py-2 px-3">{row.email}</td>
                          {uploadType === 'students' && (
                            <td className="py-2 px-3">{row.grade}</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Upload Result */}
            {uploadResult && (
              <div className={`border rounded-lg p-4 ${
                uploadResult.errors?.length > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
              }`}>
                {uploadResult.created !== undefined && (
                  <p className="flex items-center gap-2 text-green-700 mb-2">
                    <Check className="w-5 h-5" />
                    Successfully created: {uploadResult.created}
                  </p>
                )}
                {uploadResult.errors?.length > 0 && (
                  <div className="text-red-700">
                    <p className="flex items-center gap-2 font-medium mb-1">
                      <AlertCircle className="w-5 h-5" />
                      Errors:
                    </p>
                    <ul className="list-disc list-inside text-sm">
                      {uploadResult.errors.slice(0, 5).map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <Button
                variant="outline"
                onClick={resetUploadModal}
              >
                Cancel
              </Button>
              <Button
                onClick={handleBulkUpload}
                disabled={csvData.length === 0 || uploadLoading}
                className="bg-[#06D6A0] hover:bg-[#05C090]"
                data-testid="confirm-upload-btn"
              >
                {uploadLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Uploading...
                  </div>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload {csvData.length} {uploadType}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add User Modal */}
      <Dialog open={showAddUserModal} onOpenChange={setShowAddUserModal}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-[#3D5A80]" />
              Add New User
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            {/* User Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                User Type
              </label>
              <Select value={addUserType} onValueChange={setAddUserType}>
                <SelectTrigger data-testid="user-type-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="teacher">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="w-4 h-4" />
                      Teacher
                    </div>
                  </SelectItem>
                  <SelectItem value="parent">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Parent
                    </div>
                  </SelectItem>
                  <SelectItem value="child">
                    <div className="flex items-center gap-2">
                      <Baby className="w-4 h-4" />
                      Child/Student
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name *
              </label>
              <Input
                placeholder="Enter full name"
                value={addUserForm.name}
                onChange={(e) => setAddUserForm({ ...addUserForm, name: e.target.value })}
                data-testid="user-name-input"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address *
              </label>
              <Input
                type="email"
                placeholder="Enter email address"
                value={addUserForm.email}
                onChange={(e) => setAddUserForm({ ...addUserForm, email: e.target.value })}
                data-testid="user-email-input"
              />
            </div>

            {/* Grade (only for child) */}
            {addUserType === 'child' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Grade Level *
                  </label>
                  <Select 
                    value={addUserForm.grade} 
                    onValueChange={(val) => setAddUserForm({ ...addUserForm, grade: val })}
                  >
                    <SelectTrigger data-testid="grade-select">
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Parent Email (optional)
                  </label>
                  <Input
                    type="email"
                    placeholder="Link to existing parent"
                    value={addUserForm.parent_email}
                    onChange={(e) => setAddUserForm({ ...addUserForm, parent_email: e.target.value })}
                    data-testid="parent-email-input"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter parent&apos;s email to link accounts automatically
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Classroom Code (optional)
                  </label>
                  <Input
                    placeholder="Enter classroom join code"
                    value={addUserForm.classroom_code}
                    onChange={(e) => setAddUserForm({ ...addUserForm, classroom_code: e.target.value })}
                    data-testid="classroom-code-input"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter classroom code to enroll student automatically
                  </p>
                </div>
              </>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddUserModal(false);
                  setAddUserForm({ name: '', email: '', grade: '3', parent_email: '', classroom_code: '' });
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddUser}
                disabled={addUserLoading || !addUserForm.name.trim() || !addUserForm.email.trim()}
                className="bg-[#3D5A80] hover:bg-[#2D4A70]"
                data-testid="confirm-add-user-btn"
              >
                {addUserLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Creating...
                  </div>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Create {addUserType.charAt(0).toUpperCase() + addUserType.slice(1)}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
