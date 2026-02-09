import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coins, BookOpen, Users, Sparkles, TrendingUp, Gift, Star, Trophy, Shield, X, School, Play, Pause } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Helper to get asset URL
const getAssetUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('/api/')) return `${BACKEND_URL}${path}`;
  return `${BACKEND_URL}/api/uploads/${path}`;
};

export default function LandingPage() {
  const navigate = useNavigate();
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [walkthroughVideo, setWalkthroughVideo] = useState(null);
  const [selectedGrade, setSelectedGrade] = useState(null);

  useEffect(() => {
    // Fetch walkthrough video settings
    const fetchWalkthroughVideo = async () => {
      try {
        const response = await axios.get(`${API}/admin/settings/walkthrough-video`);
        if (response.data.url) {
          setWalkthroughVideo(response.data);
        }
      } catch (error) {
        console.log('No walkthrough video configured');
      }
    };
    fetchWalkthroughVideo();
  }, []);
  
  // Use custom Google OAuth
  const handleLogin = () => {
    // Redirect to our backend Google OAuth endpoint
    window.location.href = `${BACKEND_URL}/api/auth/google/login`;
  };
  
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const response = await axios.post(`${BACKEND_URL}/api/auth/admin-login`, {
        email: adminEmail,
        password: adminPassword
      }, { withCredentials: true });
      
      toast.success('Admin login successful!');
      // Redirect admin directly to admin dashboard
      navigate('/admin', { state: { user: response.data.user } });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid credentials');
    } finally {
      setIsLoading(false);
    }
  };
  
  const features = [
    { icon: Coins, title: "Digital Wallet", description: "Learn to manage money with 4 account types: Spending, Savings, Investing & Gifting", color: "#FFD23F" },
    { icon: TrendingUp, title: "Investment Zone", description: "Grow your money! Gardening simulator for K-2, Stock market simulator for 3-5 graders", color: "#06D6A0" },
    { icon: Gift, title: "Virtual Store", description: "Spend your money on your needs and wants and enhance your collection!", color: "#EE6C4D" },
    { icon: Trophy, title: "Quests & Achievements", description: "Complete fun challenges and chores to earn money and badges", color: "#3D5A80" },
  ];
  
  const grades = ["Kindergarten", "1st Grade", "2nd Grade", "3rd Grade", "4th Grade", "5th Grade"];
  
  const gradeDescriptions = {
    "Kindergarten": {
      title: "Money Basics & Counting",
      skills: [
        "Identify and count coins (₹1, ₹2, ₹5, ₹10)",
        "Understand needs vs. wants through fun stories",
        "Money Garden: Plant seeds and watch them grow!",
        "Learn saving through piggy bank activities",
        "Simple earning through fun classroom tasks"
      ],
      color: "#FFD23F"
    },
    "1st Grade": {
      title: "Earning & Saving Foundations",
      skills: [
        "Count money up to ₹100",
        "Complete simple chores to earn coins",
        "Set saving goals for small rewards",
        "Money Garden: Grow vegetables and fruits",
        "Introduction to sharing and giving"
      ],
      color: "#06D6A0"
    },
    "2nd Grade": {
      title: "Smart Spending Decisions",
      skills: [
        "Compare prices and find best deals",
        "Budget for small purchases",
        "Money Garden: Harvest crops and sell at market",
        "Understand simple interest on savings",
        "Create wish lists and prioritize wants"
      ],
      color: "#EE6C4D"
    },
    "3rd Grade": {
      title: "Introduction to Investing",
      skills: [
        "Understand how businesses make money",
        "Stock Market Basics: Buy your first stocks",
        "Learn about risk and reward",
        "Track investments over time",
        "Introduction to compound growth"
      ],
      color: "#3D5A80"
    },
    "4th Grade": {
      title: "Portfolio Building",
      skills: [
        "Diversify investments across industries",
        "Read market news and make predictions",
        "Understand dividends and earnings",
        "Set long-term financial goals",
        "Learn about entrepreneurship basics"
      ],
      color: "#9B5DE5"
    },
    "5th Grade": {
      title: "Advanced Financial Planning",
      skills: [
        "Create comprehensive budgets",
        "Analyze stock performance and trends",
        "Understand economic concepts (inflation, supply/demand)",
        "Plan for bigger goals (college savings simulation)",
        "Charitable giving and social responsibility"
      ],
      color: "#F15BB5"
    }
  };
  
  return (
    <div className="min-h-screen bg-[#E0FBFC]">
      {/* Admin Login Modal */}
      {showAdminLogin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl border-3 border-[#1D3557] shadow-[6px_6px_0px_0px_#1D3557] p-8 w-full max-w-md mx-4 relative">
            <button 
              onClick={() => setShowAdminLogin(false)}
              className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full"
            >
              <X className="w-5 h-5 text-[#1D3557]" />
            </button>
            
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-[#1D3557] rounded-2xl border-3 border-[#1D3557] flex items-center justify-center">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>Admin Login</h2>
              <p className="text-[#3D5A80] text-sm mt-1">Access the admin dashboard</p>
            </div>
            
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-[#1D3557] mb-1">Email</label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full px-4 py-3 rounded-xl border-3 border-[#1D3557] focus:outline-none focus:ring-2 focus:ring-[#FFD23F]"
                  required
                  data-testid="admin-email-input"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-[#1D3557] mb-1">Password</label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full px-4 py-3 rounded-xl border-3 border-[#1D3557] focus:outline-none focus:ring-2 focus:ring-[#FFD23F]"
                  required
                  data-testid="admin-password-input"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full btn-primary py-3 text-lg disabled:opacity-50"
                data-testid="admin-login-submit"
              >
                {isLoading ? 'Signing in...' : 'Sign In as Admin'}
              </button>
            </form>
          </div>
        </div>
      )}
      
      {/* Hero Section */}
      <header className="relative overflow-hidden">
        {/* Decorative elements - positioned to avoid logo area */}
        <div className="absolute top-32 right-20 w-16 h-16 bg-[#EE6C4D] rounded-full opacity-60 animate-float stagger-2"></div>
        <div className="absolute bottom-20 left-1/4 w-12 h-12 bg-[#06D6A0] rounded-full opacity-60 animate-float stagger-3"></div>
        
        <div className="container mx-auto px-6 pb-6">
          <nav className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3 -mt-12">
              <img 
                src="https://customer-assets.emergentagent.com/job_6e7204b4-e7e4-42b3-b74e-111b68302b75/artifacts/ul81dgc9_Friendly%20%27Money%20Matter%27%20Logo%20Design%20%281%29.png" 
                alt="CoinQuest Logo" 
                className="h-72 w-auto cursor-pointer"
                onClick={() => window.location.reload()}
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                data-testid="school-login-btn"
                onClick={() => navigate('/school-login')}
                className="px-4 py-2 text-[#3D5A80] hover:text-[#1D3557] text-sm font-medium flex items-center gap-1"
              >
                <School className="w-4 h-4" />
                School
              </button>
              <button
                data-testid="admin-login-btn"
                onClick={() => setShowAdminLogin(true)}
                className="px-4 py-2 text-[#3D5A80] hover:text-[#1D3557] text-sm font-medium flex items-center gap-1"
              >
                <Shield className="w-4 h-4" />
                Admin
              </button>
              <button
                data-testid="login-btn-nav"
                onClick={handleLogin}
                className="btn-primary px-6 py-3 text-lg"
              >
                Sign In
              </button>
            </div>
          </nav>
          
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="animate-bounce-in">
              <h1 className="text-5xl lg:text-7xl font-bold text-[#1D3557] mb-6 leading-tight" style={{ fontFamily: 'Fredoka' }}>
                Learn Money Skills <span className="text-[#EE6C4D]">While Having Fun!</span>
              </h1>
              <p className="text-xl text-[#3D5A80] mb-8 leading-relaxed">
                CoinQuest teaches K-5 kids about saving, spending, investing, and gifting through exciting games, quests, and real-world simulations!
              </p>
              <div className="flex flex-wrap gap-4">
                <button
                  data-testid="get-started-btn"
                  onClick={handleLogin}
                  className="btn-primary px-8 py-4 text-xl flex items-center gap-2"
                >
                  <Sparkles className="w-6 h-6" />
                  Start Your Adventure
                </button>
                <a
                  href="#features"
                  className="btn-secondary px-8 py-4 text-xl flex items-center gap-2"
                >
                  <BookOpen className="w-6 h-6" />
                  Learn More
                </a>
              </div>
            </div>
            
            <div className="relative animate-bounce-in stagger-2">
              <div className="card-playful p-8 bg-white">
                <img 
                  src="https://images.pexels.com/photos/1602726/pexels-photo-1602726.jpeg" 
                  alt="Piggy Bank" 
                  className="w-full h-64 object-cover rounded-2xl border-3 border-[#1D3557]"
                />
                <div className="mt-6 grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-[#FFD23F]/20 rounded-xl border-2 border-[#1D3557]">
                    <Star className="w-8 h-8 mx-auto text-[#FFD23F]" />
                    <p className="text-sm font-bold text-[#1D3557] mt-1">Fun Quests</p>
                  </div>
                  <div className="text-center p-3 bg-[#06D6A0]/20 rounded-xl border-2 border-[#1D3557]">
                    <TrendingUp className="w-8 h-8 mx-auto text-[#06D6A0]" />
                    <p className="text-sm font-bold text-[#1D3557] mt-1">Grow Money</p>
                  </div>
                  <div className="text-center p-3 bg-[#EE6C4D]/20 rounded-xl border-2 border-[#1D3557]">
                    <Trophy className="w-8 h-8 mx-auto text-[#EE6C4D]" />
                    <p className="text-sm font-bold text-[#1D3557] mt-1">Win Badges</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>
      
      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-[#1D3557] mb-4" style={{ fontFamily: 'Fredoka' }}>
              Everything Kids Need to Learn About Money
            </h2>
            <p className="text-xl text-[#3D5A80]">Age-appropriate financial education from Kindergarten to 5th Grade</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="card-playful p-6 animate-bounce-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div 
                  className="w-16 h-16 rounded-2xl border-3 border-[#1D3557] shadow-[3px_3px_0px_0px_#1D3557] flex items-center justify-center mb-4"
                  style={{ backgroundColor: feature.color }}
                >
                  <feature.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-[#1D3557] mb-2" style={{ fontFamily: 'Fredoka' }}>{feature.title}</h3>
                <p className="text-[#3D5A80]">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* Video Walkthrough Section */}
      {walkthroughVideo?.url && (
        <section className="py-20 bg-[#F8F9FA]" data-testid="walkthrough-video-section">
          <div className="container mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-4xl lg:text-5xl font-bold text-[#1D3557] mb-4" style={{ fontFamily: 'Fredoka' }}>
                {walkthroughVideo.title || 'See CoinQuest in Action'}
              </h2>
              <p className="text-xl text-[#3D5A80] max-w-2xl mx-auto">
                {walkthroughVideo.description || 'Watch how kids learn financial literacy through fun games and activities'}
              </p>
            </div>
            
            <div className="max-w-4xl mx-auto">
              <div className="card-playful p-4 bg-white">
                <div className="relative rounded-2xl overflow-hidden border-3 border-[#1D3557] bg-black aspect-video">
                  <video
                    controls
                    className="w-full h-full"
                    poster=""
                    data-testid="walkthrough-video-player"
                  >
                    <source src={getAssetUrl(walkthroughVideo.url)} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                </div>
              </div>
              
              {/* Video highlight badges */}
              <div className="flex flex-wrap justify-center gap-4 mt-8">
                <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border-2 border-[#1D3557] shadow-[2px_2px_0px_0px_#1D3557]">
                  <Play className="w-4 h-4 text-[#06D6A0]" />
                  <span className="text-sm font-bold text-[#1D3557]">Interactive Demos</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border-2 border-[#1D3557] shadow-[2px_2px_0px_0px_#1D3557]">
                  <Star className="w-4 h-4 text-[#FFD23F]" />
                  <span className="text-sm font-bold text-[#1D3557]">Real Features</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border-2 border-[#1D3557] shadow-[2px_2px_0px_0px_#1D3557]">
                  <Trophy className="w-4 h-4 text-[#EE6C4D]" />
                  <span className="text-sm font-bold text-[#1D3557]">Fun Learning</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
      
      {/* Grade Levels Section */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-[#1D3557] mb-4" style={{ fontFamily: 'Fredoka' }}>
              Tailored for Every Grade Level
            </h2>
            <p className="text-xl text-[#3D5A80]">Content adapts to your child's age and learning level</p>
          </div>
          
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            {grades.map((grade, index) => (
              <div 
                key={index}
                onClick={() => setSelectedGrade(selectedGrade === grade ? null : grade)}
                className={`card-playful px-6 py-4 cursor-pointer transition-all duration-300 ${
                  selectedGrade === grade 
                    ? 'bg-[#FFD23F] scale-105 shadow-[8px_8px_0px_0px_#1D3557]' 
                    : 'hover:bg-[#FFD23F]/50'
                }`}
                style={selectedGrade === grade ? { borderColor: gradeDescriptions[grade].color } : {}}
              >
                <span className="text-lg font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>{grade}</span>
              </div>
            ))}
          </div>
          
          {/* Expandable Grade Description */}
          {selectedGrade && gradeDescriptions[selectedGrade] && (
            <div 
              className="max-w-3xl mx-auto animate-in slide-in-from-top-4 duration-300"
            >
              <div 
                className="bg-white rounded-3xl border-3 border-[#1D3557] shadow-[6px_6px_0px_0px_#1D3557] p-8 overflow-hidden"
                style={{ borderLeftWidth: '6px', borderLeftColor: gradeDescriptions[selectedGrade].color }}
              >
                <div className="flex items-center gap-4 mb-6">
                  <div 
                    className="w-16 h-16 rounded-full border-3 border-[#1D3557] flex items-center justify-center text-2xl font-bold text-white"
                    style={{ backgroundColor: gradeDescriptions[selectedGrade].color, fontFamily: 'Fredoka' }}
                  >
                    {selectedGrade === "Kindergarten" ? "K" : selectedGrade.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
                      {selectedGrade}
                    </h3>
                    <p className="text-lg text-[#3D5A80] font-medium">{gradeDescriptions[selectedGrade].title}</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-[#1D3557] uppercase tracking-wide">What Your Child Will Learn:</p>
                  <ul className="space-y-2">
                    {gradeDescriptions[selectedGrade].skills.map((skill, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <span 
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold mt-0.5 flex-shrink-0"
                          style={{ backgroundColor: gradeDescriptions[selectedGrade].color }}
                        >
                          ✓
                        </span>
                        <span className="text-[#3D5A80]">{skill}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <button
                  onClick={handleLogin}
                  className="mt-6 w-full py-3 rounded-xl font-bold text-white transition-all hover:-translate-y-1"
                  style={{ backgroundColor: gradeDescriptions[selectedGrade].color }}
                >
                  Start Learning for {selectedGrade}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
      
      {/* User Types Section */}
      <section className="py-20 bg-[#3D5A80]">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-4" style={{ fontFamily: 'Fredoka' }}>
              For Kids, Parents & Teachers
            </h2>
            <p className="text-xl text-[#98C1D9]">Everyone plays a role in building financial literacy</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white rounded-3xl border-3 border-[#1D3557] shadow-[6px_6px_0px_0px_#1D3557] p-8 text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-[#FFD23F] rounded-full border-3 border-[#1D3557] flex items-center justify-center">
                <span className="text-4xl">🧒</span>
              </div>
              <h3 className="text-2xl font-bold text-[#1D3557] mb-3" style={{ fontFamily: 'Fredoka' }}>Kids</h3>
              <p className="text-[#3D5A80]">Learn money skills through games! Grow gardens, start businesses, earn rewards. No boring stuff—just fun!</p>
            </div>
            
            <div className="bg-white rounded-3xl border-3 border-[#1D3557] shadow-[6px_6px_0px_0px_#1D3557] p-8 text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-[#06D6A0] rounded-full border-3 border-[#1D3557] flex items-center justify-center">
                <span className="text-4xl">👨‍👩‍👧‍👦</span>
              </div>
              <h3 className="text-2xl font-bold text-[#1D3557] mb-3" style={{ fontFamily: 'Fredoka' }}>Parents</h3>
              <p className="text-[#3D5A80]">Give your child a lifetime advantage with money skills learned early. Fun games, parent dashboard, setting-up chores and allowance and more!</p>
            </div>
            
            <div className="bg-white rounded-3xl border-3 border-[#1D3557] shadow-[6px_6px_0px_0px_#1D3557] p-8 text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-[#EE6C4D] rounded-full border-3 border-[#1D3557] flex items-center justify-center">
                <span className="text-4xl">👩‍🏫</span>
              </div>
              <h3 className="text-2xl font-bold text-[#1D3557] mb-3" style={{ fontFamily: 'Fredoka' }}>Schools</h3>
              <p className="text-[#3D5A80]">Engage students with game-based financial lessons. Complete curriculum, automatic assessments, and detailed analytics. No preparation needed—just click and teach.</p>
            </div>
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <div className="card-playful p-12 bg-[#FFD23F] text-center">
            <h2 className="text-4xl lg:text-5xl font-bold text-[#1D3557] mb-6" style={{ fontFamily: 'Fredoka' }}>
              Ready to Start the Adventure?
            </h2>
            <p className="text-xl text-[#1D3557] mb-8 max-w-2xl mx-auto">
              Join thousands of kids learning financial literacy through play. It's free to start!
            </p>
            <button
              data-testid="cta-get-started-btn"
              onClick={handleLogin}
              className="bg-[#1D3557] text-white font-bold text-xl px-10 py-5 rounded-full border-3 border-[#1D3557] shadow-[4px_4px_0px_0px_white] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_white] transition-all"
            >
              Sign Up with Google
            </button>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="bg-[#1D3557] py-8">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
            {/* Logo */}
            <div className="flex flex-col items-center md:items-start">
              <img 
                src="https://customer-assets.emergentagent.com/job_6e7204b4-e7e4-42b3-b74e-111b68302b75/artifacts/ul81dgc9_Friendly%20%27Money%20Matter%27%20Logo%20Design%20%281%29.png" 
                alt="CoinQuest Logo" 
                className="h-36 w-auto"
              />
            </div>
            
            {/* Contact Info */}
            <div className="flex flex-col items-center md:items-start gap-3">
              <h3 className="text-white font-bold text-lg" style={{ fontFamily: 'Fredoka' }}>Contact Us</h3>
              <a href="mailto:hello@learnersplanet.com" className="text-[#98C1D9] hover:text-white transition-colors flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                hello@learnersplanet.com
              </a>
              <a href="tel:+919924117051" className="text-[#98C1D9] hover:text-white transition-colors flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                +91 9924117051
              </a>
            </div>
            
            {/* Links */}
            <div className="flex flex-col items-center md:items-end gap-3">
              <a 
                href="https://learnersplanet.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-[#FFD23F] text-[#1D3557] font-bold px-6 py-2 rounded-full hover:bg-[#E0FBFC] transition-colors flex items-center gap-2"
              >
                Visit Learners' Planet
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
              </a>
              <p className="text-[#98C1D9] text-sm text-center md:text-right mt-2">
                © Learners' Planet<br/>
                Educating kids in fun and interactive ways!
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
