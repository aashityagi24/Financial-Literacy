import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { User, ChevronLeft, LogOut, GraduationCap, Edit2, Save, Users, School, UserPlus, Megaphone, X } from 'lucide-react';
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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export default function ProfilePage({ user, setUser }) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [grade, setGrade] = useState(user?.grade?.toString() || '3');
  const [saving, setSaving] = useState(false);
  
  // Connection states
  const [parents, setParents] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [showAddParent, setShowAddParent] = useState(false);
  const [showJoinClass, setShowJoinClass] = useState(false);
  const [parentEmail, setParentEmail] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  const grades = [
    { value: '0', label: 'Kindergarten' },
    { value: '1', label: '1st Grade' },
    { value: '2', label: '2nd Grade' },
    { value: '3', label: '3rd Grade' },
    { value: '4', label: '4th Grade' },
    { value: '5', label: '5th Grade' },
  ];
  
  const gradeNames = ['Kindergarten', '1st Grade', '2nd Grade', '3rd Grade', '4th Grade', '5th Grade'];
  
  useEffect(() => {
    if (user?.role === 'child') {
      fetchConnections();
    }
  }, [user]);
  
  const fetchConnections = async () => {
    try {
      const [parentsRes, classroomsRes, announcementsRes] = await Promise.all([
        axios.get(`${API}/child/parents`),
        axios.get(`${API}/student/classrooms`),
        axios.get(`${API}/child/announcements`)
      ]);
      setParents(parentsRes.data || []);
      setClassrooms(classroomsRes.data || []);
      setAnnouncements(announcementsRes.data || []);
    } catch (error) {
      console.error('Failed to fetch connections:', error);
    }
  };
  
  const handleAddParent = async () => {
    if (!parentEmail.trim()) {
      toast.error('Please enter parent\'s email');
      return;
    }
    
    setSubmitting(true);
    try {
      const res = await axios.post(`${API}/child/add-parent`, {
        parent_email: parentEmail.trim()
      });
      toast.success(res.data.message);
      setShowAddParent(false);
      setParentEmail('');
      fetchConnections();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add parent');
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleJoinClassroom = async () => {
    if (!inviteCode.trim()) {
      toast.error('Please enter invite code');
      return;
    }
    
    setSubmitting(true);
    try {
      const res = await axios.post(`${API}/student/join-classroom`, {
        code: inviteCode.trim().toUpperCase()
      });
      toast.success(res.data.message);
      setShowJoinClass(false);
      setInviteCode('');
      fetchConnections();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to join classroom');
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await axios.put(`${API}/auth/profile`, {
        grade: parseInt(grade)
      });
      setUser(response.data);
      toast.success('Profile updated!');
      setEditing(false);
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };
  
  const handleLogout = async () => {
    try {
      await axios.post(`${API}/auth/logout`);
      localStorage.removeItem('session_token');
      navigate('/');
    } catch (error) {
      localStorage.removeItem('session_token');
      navigate('/');
    }
  };
  
  return (
    <div className="min-h-screen bg-[#E0FBFC]" data-testid="profile-page">
      {/* Header */}
      <header className="bg-white border-b-3 border-[#1D3557]">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="p-2 rounded-xl border-2 border-[#1D3557] hover:bg-[#E0FBFC]">
              <ChevronLeft className="w-5 h-5 text-[#1D3557]" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#FFD23F] rounded-xl border-3 border-[#1D3557] flex items-center justify-center">
                <User className="w-6 h-6 text-[#1D3557]" />
              </div>
              <h1 className="text-2xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>My Profile</h1>
            </div>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6 max-w-xl">
        {/* Profile Card */}
        <div className="card-playful p-8 text-center mb-6 animate-bounce-in">
          <div className="relative inline-block">
            <img 
              src={user?.picture || 'https://via.placeholder.com/120'} 
              alt={user?.name}
              className="w-24 h-24 rounded-full border-4 border-[#1D3557] mx-auto"
            />
            <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-[#06D6A0] rounded-full border-2 border-[#1D3557] flex items-center justify-center">
              <span className="text-lg">
                {user?.role === 'child' ? '🧒' : user?.role === 'parent' ? '👨‍👩‍👧' : '👩‍🏫'}
              </span>
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-[#1D3557] mt-4 mb-1" style={{ fontFamily: 'Fredoka' }}>
            {user?.name}
          </h2>
          <p className="text-[#3D5A80]">{user?.email}</p>
          
          <div className="flex justify-center gap-4 mt-4">
            <div className="bg-[#FFD23F]/20 px-4 py-2 rounded-xl border-2 border-[#1D3557]">
              <p className="text-xs text-[#3D5A80]">Role</p>
              <p className="font-bold text-[#1D3557] capitalize">{user?.role || 'Not set'}</p>
            </div>
            <div className="bg-[#06D6A0]/20 px-4 py-2 rounded-xl border-2 border-[#1D3557]">
              <p className="text-xs text-[#3D5A80]">Streak</p>
              <p className="font-bold text-[#1D3557]">{user?.streak_count || 0} days 🔥</p>
            </div>
          </div>
        </div>
        
        {/* Grade Settings */}
        <div className="card-playful p-6 mb-6 animate-bounce-in stagger-1">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <GraduationCap className="w-6 h-6 text-[#3D5A80]" />
              <h3 className="text-lg font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>Grade Level</h3>
            </div>
            {/* Only non-child users can edit grade */}
            {!editing && user?.role !== 'child' && (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1 text-[#3D5A80] hover:text-[#1D3557]"
              >
                <Edit2 className="w-4 h-4" /> Edit
              </button>
            )}
          </div>
          
          {editing && user?.role !== 'child' ? (
            <div className="space-y-4">
              <Select value={grade} onValueChange={setGrade}>
                <SelectTrigger className="border-3 border-[#1D3557] rounded-xl">
                  <SelectValue placeholder="Select grade" />
                </SelectTrigger>
                <SelectContent>
                  {grades.map((g) => (
                    <SelectItem key={g.value} value={g.value}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setEditing(false)}
                  className="flex-1 py-2 font-bold rounded-xl border-3 border-[#1D3557] bg-white text-[#1D3557] hover:bg-[#E0FBFC]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 btn-primary py-2 flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-[#E0FBFC] rounded-xl p-4 border-2 border-[#1D3557]">
              <p className="text-lg font-bold text-[#1D3557]">
                {gradeNames[user?.grade] || 'Not set'}
              </p>
              <p className="text-sm text-[#3D5A80]">
                Content is personalized for your grade level
              </p>
            </div>
          )}
        </div>
        
        {/* My Connections - Only for Child */}
        {user?.role === 'child' && (
          <div className="card-playful p-6 mb-6 animate-bounce-in stagger-1">
            <h3 className="text-lg font-bold text-[#1D3557] mb-4" style={{ fontFamily: 'Fredoka' }}>
              <Users className="w-5 h-5 inline mr-2" />
              My Connections
            </h3>
            
            {/* Parents Section */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-base font-medium text-[#3D5A80]">My Parents</p>
                {parents.length < 2 && (
                  <button 
                    onClick={() => setShowAddParent(true)}
                    className="text-sm text-[#06D6A0] hover:text-[#05b88a] flex items-center gap-1"
                  >
                    <UserPlus className="w-4 h-4" /> Add Parent
                  </button>
                )}
              </div>
              {parents.length === 0 ? (
                <div className="bg-[#FFD23F]/10 rounded-xl p-4 border-2 border-dashed border-[#FFD23F] text-center">
                  <p className="text-[#3D5A80] text-sm">No parents linked yet</p>
                  <button 
                    onClick={() => setShowAddParent(true)}
                    className="mt-2 text-sm font-bold text-[#FFD23F] hover:underline"
                  >
                    + Add your parent email
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {parents.map((parent) => (
                    <div key={parent.user_id} className="flex items-center gap-3 bg-[#E0FBFC] rounded-xl p-3 border-2 border-[#1D3557]">
                      <img 
                        src={parent.picture || 'https://via.placeholder.com/40'} 
                        alt={parent.name}
                        className="w-10 h-10 rounded-full border-2 border-[#1D3557]"
                      />
                      <div>
                        <p className="font-bold text-[#1D3557]">{parent.name}</p>
                        <p className="text-xs text-[#3D5A80]">{parent.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Classroom Section */}
            <div className="pt-4 border-t border-[#1D3557]/20">
              <div className="flex items-center justify-between mb-2">
                <p className="text-base font-medium text-[#3D5A80]">My Classroom</p>
                {classrooms.length === 0 && (
                  <button 
                    onClick={() => setShowJoinClass(true)}
                    className="text-sm text-[#06D6A0] hover:text-[#05b88a] flex items-center gap-1"
                  >
                    <School className="w-4 h-4" /> Join Class
                  </button>
                )}
              </div>
              {classrooms.length === 0 ? (
                <div className="bg-[#3D5A80]/10 rounded-xl p-4 border-2 border-dashed border-[#3D5A80] text-center">
                  <p className="text-[#3D5A80] text-sm">Not in a classroom yet</p>
                  <button 
                    onClick={() => setShowJoinClass(true)}
                    className="mt-2 text-sm font-bold text-[#3D5A80] hover:underline"
                  >
                    + Enter invite code to join
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {classrooms.map((classroom) => (
                    <div key={classroom.classroom_id} className="bg-[#06D6A0]/10 rounded-xl p-3 border-2 border-[#06D6A0]">
                      <p className="font-bold text-[#1D3557]">{classroom.name}</p>
                      <p className="text-sm text-[#3D5A80]">Teacher: {classroom.teacher_name}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Announcements */}
            {announcements.length > 0 && (
              <div className="pt-4 mt-4 border-t border-[#1D3557]/20">
                <p className="text-base font-medium text-[#3D5A80] mb-2 flex items-center gap-1">
                  <Megaphone className="w-4 h-4" /> Announcements
                </p>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {announcements.slice(0, 3).map((ann) => (
                    <div key={ann.announcement_id} className="bg-[#FFD23F]/20 rounded-xl p-3 border-2 border-[#FFD23F]">
                      <p className="font-bold text-[#1D3557] text-sm">{ann.title}</p>
                      <p className="text-xs text-[#3D5A80] mt-1">{ann.message}</p>
                      <p className="text-xs text-[#3D5A80]/60 mt-1">
                        From: {ann.classroom_name} • {new Date(ann.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Account Info */}
        <div className="card-playful p-6 mb-6 animate-bounce-in stagger-3">
          <h3 className="text-lg font-bold text-[#1D3557] mb-4" style={{ fontFamily: 'Fredoka' }}>
            Account Info
          </h3>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-[#1D3557]/20">
              <span className="text-[#3D5A80]">Member since</span>
              <span className="font-bold text-[#1D3557]">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-[#1D3557]/20">
              <span className="text-[#3D5A80]">User ID</span>
              <span className="font-mono text-xs text-[#3D5A80]">{user?.user_id?.slice(0, 12)}...</span>
            </div>
          </div>
        </div>
        
        {/* Logout Button */}
        <button
          onClick={handleLogout}
          data-testid="logout-btn"
          className="w-full py-4 font-bold rounded-xl border-3 border-[#EE6C4D] bg-white text-[#EE6C4D] hover:bg-[#EE6C4D] hover:text-white transition-colors flex items-center justify-center gap-2"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </main>
      
      {/* Add Parent Dialog */}
      <Dialog open={showAddParent} onOpenChange={setShowAddParent}>
        <DialogContent className="bg-white border-3 border-[#1D3557] rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
              <UserPlus className="w-5 h-5 inline mr-2" />
              Add a Parent
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-[#3D5A80]">
              Enter your parent email address. They need to have signed up as a parent first!
            </p>
            <Input
              type="email"
              placeholder="parent@example.com"
              value={parentEmail}
              onChange={(e) => setParentEmail(e.target.value)}
              className="border-3 border-[#1D3557] rounded-xl text-lg py-3"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowAddParent(false)}
                className="flex-1 py-3 font-bold rounded-xl border-3 border-[#1D3557] bg-white text-[#1D3557] hover:bg-[#E0FBFC]"
              >
                Cancel
              </button>
              <button
                onClick={handleAddParent}
                disabled={submitting}
                className="flex-1 btn-primary py-3"
              >
                {submitting ? 'Adding...' : 'Add Parent'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Join Classroom Dialog */}
      <Dialog open={showJoinClass} onOpenChange={setShowJoinClass}>
        <DialogContent className="bg-white border-3 border-[#1D3557] rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
              <School className="w-5 h-5 inline mr-2" />
              Join a Classroom
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-[#3D5A80]">
              Ask your teacher for the classroom invite code!
            </p>
            <Input
              type="text"
              placeholder="Enter code (e.g. ABC123)"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              maxLength={10}
              className="border-3 border-[#1D3557] rounded-xl text-lg py-3 text-center tracking-wider font-mono"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowJoinClass(false)}
                className="flex-1 py-3 font-bold rounded-xl border-3 border-[#1D3557] bg-white text-[#1D3557] hover:bg-[#E0FBFC]"
              >
                Cancel
              </button>
              <button
                onClick={handleJoinClassroom}
                disabled={submitting}
                className="flex-1 btn-primary py-3"
              >
                {submitting ? 'Joining...' : 'Join Class'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
