import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';

export default function AuthCallback() {
  const navigate = useNavigate();
  const hasProcessed = useRef(false);
  
  useEffect(() => {
    // Use ref to prevent double processing (React StrictMode)
    if (hasProcessed.current) return;
    hasProcessed.current = true;
    
    const processSession = async () => {
      // Extract session_id from URL fragment
      const hash = window.location.hash;
      const sessionIdMatch = hash.match(/session_id=([^&]+)/);
      
      if (!sessionIdMatch) {
        console.log('No session_id found in URL');
        toast.error('No session found. Please try signing in again.');
        navigate('/');
        return;
      }
      
      const sessionId = sessionIdMatch[1];
      
      console.log('Processing session_id:', sessionId.substring(0, 10) + '...');
      
      try {
        // Exchange session_id for session data
        const response = await axios.post(`${API}/auth/session`, {
          session_id: sessionId
        }, { withCredentials: true });
        
        console.log('Session response:', response.data);
        
        const { user, session_token } = response.data;
        
        // Store session token in localStorage as backup for cookie
        if (session_token) {
          localStorage.setItem('session_token', session_token);
        }
        
        // Clear the hash from URL
        window.history.replaceState(null, '', window.location.pathname);
        
        toast.success(`Welcome${user.name ? ', ' + user.name : ''}!`);
        
        // Navigate based on user role - use replace to avoid back-button issues
        if (!user.role) {
          navigate('/role-selection', { state: { user }, replace: true });
        } else {
          navigate('/dashboard', { state: { user }, replace: true });
        }
      } catch (error) {
        console.error('Auth error:', error.response?.data || error.message);
        toast.error(error.response?.data?.detail || 'Sign in failed. Please try again.');
        // Clear the hash and redirect to landing
        window.history.replaceState(null, '', '/');
        navigate('/');
      }
    };
    
    processSession();
  }, [navigate]);
  
  return (
    <div className="min-h-screen bg-[#E0FBFC] flex items-center justify-center">
      <div className="text-center">
        <div className="w-20 h-20 mx-auto mb-6 border-4 border-[#1D3557] border-t-[#FFD23F] rounded-full animate-spin"></div>
        <h2 className="text-2xl font-bold text-[#1D3557] mb-2" style={{ fontFamily: 'Fredoka' }}>
          Welcome to CoinQuest!
        </h2>
        <p className="text-[#3D5A80]">Setting up your account...</p>
      </div>
    </div>
  );
}
