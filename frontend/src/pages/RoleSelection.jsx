import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { GraduationCap, Users, UserCircle, ChevronRight } from 'lucide-react';

export default function RoleSelection({ user, setUser }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [selectedRole, setSelectedRole] = useState(null);
  const [selectedGrade, setSelectedGrade] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const roles = [
    { id: 'child', label: 'I\'m a Kid', icon: '🧒', description: 'Play games, earn ₹, and learn about money!', color: '#FFD23F' },
    { id: 'parent', label: 'I\'m a Parent', icon: '👨‍👩‍👧', description: 'Track your child\'s progress and give rewards', color: '#06D6A0' },
    { id: 'teacher', label: 'I\'m a Teacher', icon: '👩‍🏫', description: 'Set up classroom economies and track students', color: '#EE6C4D' },
  ];
  
  const grades = [
    { value: 0, label: 'Kindergarten', age: '5-6 years' },
    { value: 1, label: '1st Grade', age: '6-7 years' },
    { value: 2, label: '2nd Grade', age: '7-8 years' },
    { value: 3, label: '3rd Grade', age: '8-9 years' },
    { value: 4, label: '4th Grade', age: '9-10 years' },
    { value: 5, label: '5th Grade', age: '10-11 years' },
  ];
  
  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    if (role === 'child') {
      setStep(2);
    } else {
      handleSubmit(role, null);
    }
  };
  
  const handleSubmit = async (role, grade) => {
    setLoading(true);
    try {
      const response = await axios.put(`${API}/auth/profile`, {
        role: role || selectedRole,
        grade: grade !== null ? grade : selectedGrade
      });
      
      setUser(response.data);
      toast.success('Profile setup complete!');
      navigate('/dashboard', { state: { user: response.data } });
    } catch (error) {
      toast.error('Failed to update profile');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-[#E0FBFC] flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8 animate-bounce-in">
          <h1 className="text-4xl font-bold text-[#1D3557] mb-2" style={{ fontFamily: 'Fredoka' }}>
            Welcome, {user?.name?.split(' ')[0] || 'Friend'}! 
          </h1>
          <p className="text-xl text-[#3D5A80]">Let's set up your PocketQuest profile</p>
        </div>
        
        {step === 1 && (
          <div className="animate-bounce-in stagger-1">
            <h2 className="text-2xl font-bold text-[#1D3557] text-center mb-6" style={{ fontFamily: 'Fredoka' }}>
              Who are you?
            </h2>
            
            <div className="grid gap-4">
              {roles.map((role, index) => (
                <button
                  key={role.id}
                  data-testid={`role-${role.id}-btn`}
                  onClick={() => handleRoleSelect(role.id)}
                  disabled={loading}
                  className="card-playful p-6 text-left hover:bg-[#FFD23F]/10 transition-colors flex items-center gap-4 group"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div 
                    className="w-16 h-16 rounded-2xl border-3 border-[#1D3557] flex items-center justify-center text-3xl"
                    style={{ backgroundColor: role.color }}
                  >
                    {role.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>{role.label}</h3>
                    <p className="text-[#3D5A80]">{role.description}</p>
                  </div>
                  <ChevronRight className="w-6 h-6 text-[#1D3557] group-hover:translate-x-1 transition-transform" />
                </button>
              ))}
            </div>
          </div>
        )}
        
        {step === 2 && (
          <div className="animate-bounce-in">
            <button 
              onClick={() => setStep(1)}
              className="text-[#3D5A80] mb-4 flex items-center gap-2 hover:text-[#1D3557]"
            >
              ← Back
            </button>
            
            <h2 className="text-2xl font-bold text-[#1D3557] text-center mb-6" style={{ fontFamily: 'Fredoka' }}>
              What grade are you in?
            </h2>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {grades.map((grade, index) => (
                <button
                  key={grade.value}
                  data-testid={`grade-${grade.value}-btn`}
                  onClick={() => {
                    setSelectedGrade(grade.value);
                    handleSubmit(selectedRole, grade.value);
                  }}
                  disabled={loading}
                  className={`card-playful p-4 text-center hover:bg-[#FFD23F]/10 transition-colors ${selectedGrade === grade.value ? 'bg-[#FFD23F]' : ''}`}
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <GraduationCap className={`w-8 h-8 mx-auto mb-2 ${selectedGrade === grade.value ? 'text-[#1D3557]' : 'text-[#3D5A80]'}`} />
                  <h3 className="font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>{grade.label}</h3>
                  <p className="text-sm text-[#3D5A80]">{grade.age}</p>
                </button>
              ))}
            </div>
          </div>
        )}
        
        {loading && (
          <div className="mt-8 text-center">
            <div className="w-12 h-12 mx-auto border-4 border-[#1D3557] border-t-[#FFD23F] rounded-full animate-spin"></div>
            <p className="mt-4 text-[#3D5A80]">Setting up your profile...</p>
          </div>
        )}
      </div>
    </div>
  );
}
