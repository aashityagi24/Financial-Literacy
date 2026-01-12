import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';

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
        navigate('/');
        return;
      }
      
      const sessionId = sessionIdMatch[1];
      
      try {
        // Exchange session_id for session data
        const response = await axios.post(`${API}/auth/session`, {
          session_id: sessionId
        });
        
        const { user } = response.data;
        
        // Clear the hash from URL
        window.history.replaceState(null, '', window.location.pathname);
        
        // Navigate based on user role
        if (!user.role) {
          navigate('/role-selection', { state: { user } });
        } else {
          navigate('/dashboard', { state: { user } });
        }
      } catch (error) {
        console.error('Auth error:', error);
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
          Welcome to PocketQuest!
        </h2>
        <p className="text-[#3D5A80]">Setting up your account...</p>
      </div>
    </div>
  );
}
