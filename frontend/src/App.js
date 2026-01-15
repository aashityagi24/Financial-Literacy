import { useEffect, useRef, useState } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { Toaster } from "@/components/ui/sonner";

// Pages
import LandingPage from "@/pages/LandingPage";
import AuthCallback from "@/pages/AuthCallback";
import RoleSelection from "@/pages/RoleSelection";
import Dashboard from "@/pages/Dashboard";
import WalletPage from "@/pages/WalletPage";
import StorePage from "@/pages/StorePage";
import InvestmentPage from "@/pages/InvestmentPage";
import QuestsPage from "@/pages/QuestsPage";
import AchievementsPage from "@/pages/AchievementsPage";
import ChatBuddy from "@/pages/ChatBuddy";
import ProfilePage from "@/pages/ProfilePage";
import LearnPage from "@/pages/LearnPage";
import TopicPage from "@/pages/TopicPage";
import LessonPage from "@/pages/LessonPage";
import AdminPage from "@/pages/AdminPage";
import TeacherDashboard from "@/pages/TeacherDashboard";
import ParentDashboard from "@/pages/ParentDashboard";
import ContentManagement from "@/pages/ContentManagement";
import AdminStoreManagement from "@/pages/AdminStoreManagement";
import AdminInvestmentManagement from "@/pages/AdminInvestmentManagement";
import ClassmatesPage from "@/pages/ClassmatesPage";
import SavingsGoalsPage from "@/pages/SavingsGoalsPage";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// Helper to build full URL for uploaded assets (thumbnails, pdfs, etc.)
export const getAssetUrl = (path) => {
  if (!path) return null;
  // If already a full URL, return as is
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  // If it's a relative path starting with /api/uploads, prepend backend URL
  if (path.startsWith('/api/')) return `${BACKEND_URL}${path}`;
  // Otherwise, assume it's a path needing the full uploads prefix
  return `${BACKEND_URL}/api/uploads/${path}`;
};

// Configure axios defaults
axios.defaults.withCredentials = true;

// Protected Route Component
export const ProtectedRoute = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  
  // If user data was passed from AuthCallback, use it directly
  useEffect(() => {
    if (location.state?.user) {
      setUser(location.state.user);
      setIsAuthenticated(true);
      return;
    }
    
    const checkAuth = async () => {
      try {
        const response = await axios.get(`${API}/auth/me`);
        setUser(response.data);
        setIsAuthenticated(true);
        
        // If user has no role, redirect to role selection
        if (!response.data.role && location.pathname !== '/role-selection') {
          navigate('/role-selection', { state: { user: response.data } });
        }
      } catch (error) {
        setIsAuthenticated(false);
        navigate('/');
      }
    };
    
    checkAuth();
  }, [navigate, location.state, location.pathname]);
  
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-[#E0FBFC] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 border-4 border-[#1D3557] border-t-[#FFD23F] rounded-full animate-spin"></div>
          <p className="text-xl font-bold text-[#1D3557]">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return null;
  }
  
  // Clone children with user prop
  return children({ user, setUser });
};

// App Router with session_id detection
function AppRouter() {
  const location = useLocation();
  
  // CRITICAL: Check for session_id synchronously during render (not in useEffect)
  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }
  
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/role-selection" element={
        <ProtectedRoute>
          {({ user, setUser }) => <RoleSelection user={user} setUser={setUser} />}
        </ProtectedRoute>
      } />
      <Route path="/dashboard" element={
        <ProtectedRoute>
          {({ user, setUser }) => <Dashboard user={user} setUser={setUser} />}
        </ProtectedRoute>
      } />
      <Route path="/wallet" element={
        <ProtectedRoute>
          {({ user }) => <WalletPage user={user} />}
        </ProtectedRoute>
      } />
      <Route path="/store" element={
        <ProtectedRoute>
          {({ user }) => <StorePage user={user} />}
        </ProtectedRoute>
      } />
      <Route path="/investments" element={
        <ProtectedRoute>
          {({ user }) => <InvestmentPage user={user} />}
        </ProtectedRoute>
      } />
      <Route path="/quests" element={
        <ProtectedRoute>
          {({ user }) => <QuestsPage user={user} />}
        </ProtectedRoute>
      } />
      <Route path="/achievements" element={
        <ProtectedRoute>
          {({ user }) => <AchievementsPage user={user} />}
        </ProtectedRoute>
      } />
      <Route path="/chat" element={
        <ProtectedRoute>
          {({ user }) => <ChatBuddy user={user} />}
        </ProtectedRoute>
      } />
      <Route path="/profile" element={
        <ProtectedRoute>
          {({ user, setUser }) => <ProfilePage user={user} setUser={setUser} />}
        </ProtectedRoute>
      } />
      <Route path="/learn" element={
        <ProtectedRoute>
          {({ user }) => <LearnPage user={user} />}
        </ProtectedRoute>
      } />
      <Route path="/learn/topic/:topicId" element={
        <ProtectedRoute>
          {({ user }) => <TopicPage user={user} />}
        </ProtectedRoute>
      } />
      <Route path="/learn/lesson/:lessonId" element={
        <ProtectedRoute>
          {({ user }) => <LessonPage user={user} />}
        </ProtectedRoute>
      } />
      <Route path="/admin" element={
        <ProtectedRoute>
          {({ user, setUser }) => <AdminPage user={user} setUser={setUser} />}
        </ProtectedRoute>
      } />
      <Route path="/teacher-dashboard" element={
        <ProtectedRoute>
          {({ user }) => <TeacherDashboard user={user} />}
        </ProtectedRoute>
      } />
      <Route path="/parent-dashboard" element={
        <ProtectedRoute>
          {({ user }) => <ParentDashboard user={user} />}
        </ProtectedRoute>
      } />
      <Route path="/classmates" element={
        <ProtectedRoute>
          {({ user }) => <ClassmatesPage user={user} />}
        </ProtectedRoute>
      } />
      <Route path="/savings-goals" element={
        <ProtectedRoute>
          {({ user }) => <SavingsGoalsPage user={user} />}
        </ProtectedRoute>
      } />
      <Route path="/admin/content" element={
        <ProtectedRoute>
          {({ user }) => <ContentManagement user={user} />}
        </ProtectedRoute>
      } />
      <Route path="/admin/store" element={
        <ProtectedRoute>
          {({ user }) => <AdminStoreManagement user={user} />}
        </ProtectedRoute>
      } />
      <Route path="/admin/investments" element={
        <ProtectedRoute>
          {({ user }) => <AdminInvestmentManagement user={user} />}
        </ProtectedRoute>
      } />
    </Routes>
  );
}

function App() {
  return (
    <div className="min-h-screen">
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </div>
  );
}

export default App;
