import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { API } from '@/App';
import {
  School, Users, GraduationCap, BookOpen, LogOut, BarChart3, 
  Upload, ChevronDown, ChevronUp, Search, Download, FileText,
  TrendingUp, Wallet, Target, Award, RefreshCw, X, Check, AlertCircle,
  UserPlus, Baby, Trash2, AlertTriangle
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

// Human-friendly "last login" (e.g., "Today", "Yesterday", "3 days ago", "12 Jun 2026")
const formatLastLogin = (iso) => {
  if (!iso) return 'Never';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'Never';
  const now = new Date();
  const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

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
  const [addUserMode, setAddUserMode] = useState('create'); // 'create' | 'existing'
  const [addUserForm, setAddUserForm] = useState({ name: '', email: '', identifier: '', grade: '3', parent_email: '', classroom_code: '', teacher_email: '' });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [assignTarget, setAssignTarget] = useState(null);
  const [assignClassroomId, setAssignClassroomId] = useState('');
  const [assigning, setAssigning] = useState(false);
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
        
        // Unified format: one row per student. Keep any row that has a student name;
        // full validation (required teacher/parent/class) happens server-side and
        // is reported back per row.
        if (row.student_name) {
          data.push(row);
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
      const response = await axios.post(
        `${API}/school/upload/unified`,
        { data: csvData },
        { withCredentials: true }
      );
      
      setUploadResult(response.data);
      const r = response.data;
      toast.success(`Created ${r.students_created || 0} students, ${r.teachers_created || 0} teachers, ${r.parents_created || 0} parents`);
      fetchDashboardData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Upload failed');
      setUploadResult({ errors: [error.response?.data?.detail || 'Upload failed'] });
    } finally {
      setUploadLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await axios.delete(`${API}/school/users/${deleteTarget.user_id}`, { withCredentials: true });
      toast.success(res.data?.message || 'Deleted');
      setDeleteTarget(null);
      fetchDashboardData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  const handleAssignClass = async () => {
    if (!assignTarget || !assignClassroomId) {
      toast.error('Please pick a class');
      return;
    }
    setAssigning(true);
    try {
      const res = await axios.post(`${API}/school/students/${assignTarget.user_id}/assign-class`, { classroom_id: assignClassroomId }, { withCredentials: true });
      toast.success(res.data?.message || 'Student enrolled');
      setAssignTarget(null);
      setAssignClassroomId('');
      fetchDashboardData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to assign class');
    } finally {
      setAssigning(false);
    }
  };

  const downloadSampleCsv = () => {
    const headers = [
      'student_name', 'student_grade', 'student_email', 'student_username',
      'student_password', 'teacher_name', 'teacher_email', 'class_name',
      'parent_name', 'parent_email', 'subscription', 'subscription_duration',
    ];
    const sampleRows = [
      ['Aarav Sharma', '2', '', '', '', 'Priya Nair', 'priya.nair@school.com', 'Grade 2A', 'Rohan Sharma', 'rohan.sharma@gmail.com', 'active', '1_month'],
      ['Diya Patel', '2', 'diya.patel@gmail.com', '', '', 'Priya Nair', 'priya.nair@school.com', 'Grade 2A', 'Meera Patel', 'meera.patel@gmail.com', 'active', '1_month'],
      ['Kabir Singh', '3', '', 'kabir_s', 'Kabir@123', 'Anil Verma', 'anil.verma@school.com', 'Grade 3B', 'Rohan Sharma', 'rohan.sharma@gmail.com', '', '1_month'],
    ];
    const csv = [headers.join(',')].concat(sampleRows.map(r => r.join(','))).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'coinquest_bulk_upload_template.csv';
    a.click();
    URL.revokeObjectURL(url);
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
        if (addUserForm.teacher_email.trim()) {
          payload.teacher_email = addUserForm.teacher_email.trim().toLowerCase();
        }
      }
      
      const response = await axios.post(
        `${API}/school/users/${addUserType}`,
        payload,
        { withCredentials: true }
      );
      
      toast.success(response.data.message);
      showMappingResult(response.data);
      setShowAddUserModal(false);
      setAddUserForm({ name: '', email: '', grade: '3', parent_email: '', classroom_code: '', teacher_email: '' });
      fetchDashboardData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create user');
    } finally {
      setAddUserLoading(false);
    }
  };

  const showMappingResult = (data) => {
    if (typeof data?.students_mapped === 'number' && data.students_mapped > 0) {
      toast.success(`${data.students_mapped} student${data.students_mapped > 1 ? 's' : ''} from this teacher's class auto-added to your school`);
    }
    if (Array.isArray(data?.students_skipped) && data.students_skipped.length > 0) {
      const names = data.students_skipped.map(s => s.name).filter(Boolean).slice(0, 3).join(', ');
      toast.warning(`${data.students_skipped.length} student${data.students_skipped.length > 1 ? 's' : ''} skipped (already in another school)${names ? `: ${names}` : ''}`);
    }
  };

  const handleLinkExisting = async () => {
    if (!addUserForm.identifier.trim()) {
      toast.error('Enter an email or username');
      return;
    }
    setAddUserLoading(true);
    try {
      const payload = {
        identifier: addUserForm.identifier.trim(),
        user_type: addUserType
      };
      if (addUserType === 'child') {
        payload.grade = parseInt(addUserForm.grade);
        if (addUserForm.parent_email.trim()) payload.parent_email = addUserForm.parent_email.trim().toLowerCase();
        if (addUserForm.classroom_code.trim()) payload.classroom_code = addUserForm.classroom_code.trim().toUpperCase();
        if (addUserForm.teacher_email.trim()) payload.teacher_email = addUserForm.teacher_email.trim().toLowerCase();
      }
      const response = await axios.post(
        `${API}/school/users/link-existing`,
        payload,
        { withCredentials: true }
      );
      toast.success(response.data.message);
      showMappingResult(response.data);
      setShowAddUserModal(false);
      setAddUserForm({ name: '', email: '', identifier: '', grade: '3', parent_email: '', classroom_code: '', teacher_email: '' });
      fetchDashboardData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add existing user');
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
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Last login</p>
                      <p className="text-xs font-medium text-gray-600">{formatLastLogin(teacher.last_login_at)}</p>
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
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Class</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Grade</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Class Code</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Last Login</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Actions</th>
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
                      <td className="py-3 px-4 text-gray-600">{teacher.classroom_name || '-'}</td>
                      <td className="py-3 px-4 text-gray-600">{teacher.classroom_grade || '-'}</td>
                      <td className="py-3 px-4">
                        {teacher.join_code ? (
                          <span className="px-2 py-1 bg-[#3D5A80]/10 text-[#3D5A80] text-xs rounded-md font-mono font-bold tracking-wider" data-testid={`teacher-class-code-${teacher.user_id}`}>
                            {teacher.join_code}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">No class</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-600 text-sm" data-testid={`teacher-last-login-${teacher.user_id}`}>
                        {formatLastLogin(teacher.last_login_at)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                          Active
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setDeleteTarget({ ...teacher, role: 'teacher' })}
                          className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50"
                          title="Delete teacher"
                          data-testid={`delete-teacher-${teacher.user_id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Class Code</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Actions</th>
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
                      <td className="py-3 px-4 text-gray-600">{student.email || <span className="text-gray-400 text-xs">username login</span>}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 bg-[#FFD23F]/20 text-[#1D3557] text-xs rounded-full font-medium">
                          {getGradeLabel(student.grade)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600">{student.teacher_name || '-'}</td>
                      <td className="py-3 px-4">
                        {student.join_code ? (
                          <span className="px-2 py-1 bg-[#06D6A0]/10 text-[#048A6A] text-xs rounded-md font-mono font-bold tracking-wider" data-testid={`student-class-code-${student.user_id}`}>
                            {student.join_code}
                          </span>
                        ) : (
                          <button
                            onClick={() => { setAssignTarget(student); setAssignClassroomId(''); }}
                            className="px-2 py-1 bg-[#EE6C4D]/10 text-[#EE6C4D] text-xs rounded-md font-semibold hover:bg-[#EE6C4D]/20 flex items-center gap-1"
                            data-testid={`assign-class-${student.user_id}`}
                          >
                            <School className="w-3 h-3" /> Assign class
                          </button>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setDeleteTarget({ ...student, role: 'child' })}
                          className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50"
                          title="Delete student"
                          data-testid={`delete-student-${student.user_id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
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
            {/* Unified CSV Format Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-blue-800 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  One unified CSV — creates & links everyone
                </h4>
                <button
                  onClick={downloadSampleCsv}
                  className="text-xs font-semibold text-white bg-[#06D6A0] hover:bg-[#05C090] px-3 py-1.5 rounded-lg flex items-center gap-1"
                  data-testid="download-sample-btn"
                >
                  <Download className="w-3.5 h-3.5" /> Download sample
                </button>
              </div>
              <div className="text-sm text-blue-700 space-y-1">
                <p><strong>One row per student.</strong> Each row also carries the student's teacher, class and parent — everything is created and linked in one go.</p>
                <p className="mt-1"><strong>Required:</strong> <code className="bg-blue-100 px-1 rounded">student_name</code>, <code className="bg-blue-100 px-1 rounded">student_grade</code> (0-5), <code className="bg-blue-100 px-1 rounded">teacher_name</code>, <code className="bg-blue-100 px-1 rounded">teacher_email</code>, <code className="bg-blue-100 px-1 rounded">class_name</code>, <code className="bg-blue-100 px-1 rounded">parent_name</code>, <code className="bg-blue-100 px-1 rounded">parent_email</code></p>
                <p className="mt-1"><strong>Optional:</strong> <code className="bg-blue-100 px-1 rounded">student_email</code>, <code className="bg-blue-100 px-1 rounded">student_username</code>, <code className="bg-blue-100 px-1 rounded">student_password</code>, <code className="bg-blue-100 px-1 rounded">subscription</code> (active), <code className="bg-blue-100 px-1 rounded">subscription_duration</code> (1_day / 1_week / 1_month)</p>
                <p className="text-xs text-blue-600 mt-1">Leave student email &amp; username blank to auto-generate a login. Teachers and parents get an auto-generated password if they don&apos;t have one, so they can sign in with email + password (or Google). All generated logins are shown below after upload and downloadable.</p>
              </div>
              <p className="text-xs text-blue-600 mt-2 pt-2 border-t border-blue-200">
                First row must contain the headers (use the sample template). Existing users without a school are added to your school; users in another school are skipped with a note.
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
                    Preview ({csvData.length} rows)
                  </span>
                </div>
                <div className="overflow-x-auto max-h-48">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="text-left py-2 px-3">Student</th>
                        <th className="text-left py-2 px-3">Grade</th>
                        <th className="text-left py-2 px-3">Class</th>
                        <th className="text-left py-2 px-3">Teacher</th>
                        <th className="text-left py-2 px-3">Parent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.map((row, idx) => (
                        <tr key={idx} className="border-t border-gray-100">
                          <td className="py-2 px-3">{row.student_name}</td>
                          <td className="py-2 px-3">{row.student_grade}</td>
                          <td className="py-2 px-3">{row.class_name}</td>
                          <td className="py-2 px-3">{row.teacher_email}</td>
                          <td className="py-2 px-3">{row.parent_email}</td>
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
                uploadResult.errors?.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'
              }`}>
                {(uploadResult.students_created !== undefined) && (
                  <div className="text-green-800 text-sm mb-2" data-testid="upload-summary">
                    <p className="flex items-center gap-2 font-semibold mb-1">
                      <Check className="w-5 h-5" /> Upload complete
                    </p>
                    <ul className="list-disc list-inside">
                      <li>{uploadResult.students_created} students, {uploadResult.teachers_created} teachers, {uploadResult.parents_created} parents created</li>
                      <li>{uploadResult.classrooms_created} classrooms created, {uploadResult.enrollments} enrolments, {uploadResult.parent_links} parent links</li>
                      {uploadResult.subscribed > 0 && <li>{uploadResult.subscribed} subscriptions granted</li>}
                    </ul>
                  </div>
                )}
                {uploadResult.errors?.length > 0 && (
                  <div className="text-amber-700">
                    <p className="flex items-center gap-2 font-medium mb-1">
                      <AlertCircle className="w-5 h-5" />
                      {uploadResult.errors.length} row issue(s):
                    </p>
                    <ul className="list-disc list-inside text-sm max-h-32 overflow-y-auto">
                      {uploadResult.errors.slice(0, 10).map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {uploadResult.credentials?.length > 0 && (
                  <div className="mt-3 border-t border-green-200 pt-3" data-testid="auto-creds-section">
                    <p className="font-semibold text-green-800 mb-2">
                      Login credentials ({uploadResult.credentials.length})
                    </p>
                    <p className="text-xs text-green-700 mb-2">
                      Share these with the respective students, teachers and parents — they won&apos;t be shown again.
                    </p>
                    <div className="max-h-48 overflow-y-auto border border-green-200 rounded bg-white">
                      <table className="w-full text-xs">
                        <thead className="bg-green-100 text-green-800">
                          <tr>
                            <th className="px-2 py-1 text-left">Name</th>
                            <th className="px-2 py-1 text-left">Role</th>
                            <th className="px-2 py-1 text-left">Login</th>
                            <th className="px-2 py-1 text-left">Password</th>
                          </tr>
                        </thead>
                        <tbody className="font-mono text-gray-800">
                          {uploadResult.credentials.map((c, idx) => (
                            <tr key={idx} className="border-t border-green-100">
                              <td className="px-2 py-1 font-sans">{c.name}</td>
                              <td className="px-2 py-1 font-sans capitalize">{c.role}</td>
                              <td className="px-2 py-1">{c.login}</td>
                              <td className="px-2 py-1">{c.password}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button
                      onClick={() => {
                        const text = ['name,role,login,password']
                          .concat(uploadResult.credentials.map(c => `${c.name},${c.role},${c.login},${c.password}`))
                          .join('\n');
                        const blob = new Blob([text], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `coinquest_credentials_${new Date().toISOString().slice(0,10)}.csv`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="mt-2 text-xs font-medium text-green-700 hover:underline"
                      data-testid="download-credentials-btn"
                    >
                      Download all credentials as CSV
                    </button>
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
                    Upload {csvData.length} rows
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
            {/* Mode toggle: Create New vs Add Existing */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-xl">
              <button
                onClick={() => setAddUserMode('create')}
                data-testid="add-user-mode-create"
                className={`py-2 rounded-lg text-sm font-semibold transition-colors ${addUserMode === 'create' ? 'bg-white text-[#1D3557] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Create New
              </button>
              <button
                onClick={() => setAddUserMode('existing')}
                data-testid="add-user-mode-existing"
                className={`py-2 rounded-lg text-sm font-semibold transition-colors ${addUserMode === 'existing' ? 'bg-white text-[#1D3557] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Add Existing
              </button>
            </div>

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

            {addUserMode === 'create' ? (
              <>
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
              </>
            ) : (
              /* Add Existing: map by email or username */
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email or Username *
                </label>
                <Input
                  placeholder="Enter existing account's email or username"
                  value={addUserForm.identifier}
                  onChange={(e) => setAddUserForm({ ...addUserForm, identifier: e.target.value })}
                  data-testid="user-identifier-input"
                />
                <p className="text-xs text-gray-500 mt-1">
                  We&apos;ll find the existing account and add it to your school.
                </p>
              </div>
            )}

            {/* Grade + relationship fields (only for child) */}
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
                    Teacher Email (optional)
                  </label>
                  <Input
                    type="email"
                    placeholder="Link to teacher's classroom"
                    value={addUserForm.teacher_email}
                    onChange={(e) => setAddUserForm({ ...addUserForm, teacher_email: e.target.value })}
                    data-testid="teacher-email-input"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter teacher&apos;s email to enroll in their classroom
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    OR Classroom Code (optional)
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
                  setAddUserForm({ name: '', email: '', identifier: '', grade: '3', parent_email: '', classroom_code: '', teacher_email: '' });
                }}
              >
                Cancel
              </Button>
              {addUserMode === 'create' ? (
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
              ) : (
                <Button
                  onClick={handleLinkExisting}
                  disabled={addUserLoading || !addUserForm.identifier.trim()}
                  className="bg-[#3D5A80] hover:bg-[#2D4A70]"
                  data-testid="confirm-link-existing-btn"
                >
                  {addUserLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Adding...
                    </div>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 mr-2" />
                      Add Existing {addUserType.charAt(0).toUpperCase() + addUserType.slice(1)}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="max-w-md" data-testid="confirm-delete-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" /> Confirm deletion
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm text-gray-700 space-y-2">
            <p>
              Are you sure you want to permanently delete{' '}
              <strong>{deleteTarget?.name}</strong>
              {deleteTarget?.email ? ` (${deleteTarget.email})` : ''}? This cannot be undone.
            </p>
            {deleteTarget?.role === 'teacher' && (
              <p className="text-xs bg-amber-50 border border-amber-200 rounded-lg p-2 text-amber-700">
                Their class(es) will be removed. Enrolled students are <strong>not</strong> deleted — they simply become classless.
              </p>
            )}
            {deleteTarget?.role === 'parent' && (
              <p className="text-xs bg-blue-50 border border-blue-200 rounded-lg p-2 text-blue-700">
                Their linked children are <strong>not</strong> deleted.
              </p>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} data-testid="cancel-delete-btn">Cancel</Button>
            <Button onClick={handleDeleteUser} disabled={deleting} className="bg-red-500 hover:bg-red-600 text-white" data-testid="confirm-delete-btn">
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Class Dialog */}
      <Dialog open={!!assignTarget} onOpenChange={(o) => { if (!o) { setAssignTarget(null); setAssignClassroomId(''); } }}>
        <DialogContent className="max-w-md" data-testid="assign-class-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#1D3557]">
              <School className="w-5 h-5" /> Assign class to {assignTarget?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">Choose a class</label>
            <Select value={assignClassroomId} onValueChange={setAssignClassroomId}>
              <SelectTrigger data-testid="assign-class-select">
                <SelectValue placeholder="Select a class" />
              </SelectTrigger>
              <SelectContent>
                {(dashboardData?.classrooms || []).map((c) => (
                  <SelectItem key={c.classroom_id} value={c.classroom_id}>
                    {c.name} · {c.teacher_name} {c.join_code ? `(${c.join_code})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(dashboardData?.classrooms || []).length === 0 && (
              <p className="text-xs text-amber-600">No classes exist yet. Add a teacher with a class first.</p>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => { setAssignTarget(null); setAssignClassroomId(''); }}>Cancel</Button>
            <Button onClick={handleAssignClass} disabled={assigning || !assignClassroomId} className="bg-[#06D6A0] hover:bg-[#05C090] text-white" data-testid="confirm-assign-class-btn">
              {assigning ? 'Assigning...' : 'Assign'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
