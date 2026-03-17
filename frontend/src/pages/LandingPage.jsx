import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Coins, BookOpen, Users, Sparkles, TrendingUp, Gift, Star, Trophy, School, Play, Pause } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import PricingSection from '@/components/PricingSection';

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
  const [searchParams] = useSearchParams();
  const [walkthroughVideos, setWalkthroughVideos] = useState(null);
  const [selectedVideoTab, setSelectedVideoTab] = useState('child');
  const [selectedGrade, setSelectedGrade] = useState(null);

  useEffect(() => {
    // Check if redirected due to session expiry
    if (searchParams.get('session_expired') === 'true') {
      toast.error('Your session has ended. You may have logged in on another device.', {
        duration: 5000
      });
      window.history.replaceState({}, '', '/');
    }
    
    // Check if redirected due to no subscription
    if (searchParams.get('no_subscription') === 'true') {
      toast.error('You need an active subscription to access CoinQuest. Please purchase a plan below.', {
        duration: 8000
      });
      window.history.replaceState({}, '', '/');
      setTimeout(() => {
        document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
      }, 500);
    }
    
    // Fetch walkthrough video settings
    const fetchWalkthroughVideos = async () => {
      try {
        const response = await axios.get(`${API}/admin/settings/walkthrough-video`);
        // Check if any video exists
        if (response.data.child?.url || response.data.parent?.url || response.data.teacher?.url) {
          setWalkthroughVideos(response.data);
        }
      } catch (error) {
        console.log('No walkthrough video configured');
      }
    };
    fetchWalkthroughVideos();
  }, [searchParams]);
  
  // Use custom Google OAuth
  const handleLogin = () => {
    navigate('/login');
  };
  
  const features = [
    { icon: Coins, title: "Digital Wallet", description: "Learn to manage money with 4 account types: Spending, Piggy Bank, Investing & Gifting", color: "#FFD23F" },
    { icon: TrendingUp, title: "Money Garden", description: "Grow your money! Plant seeds, water your garden, and sell vegetables at the market", color: "#06D6A0" },
    { icon: Gift, title: "Virtual Store", description: "Spend your money on your needs and wants and enhance your collection!", color: "#EE6C4D" },
    { icon: Trophy, title: "Quests & Achievements", description: "Complete fun challenges and chores to earn money and badges", color: "#3D5A80" },
  ];
  
  const grades = ["Kindergarten", "1st Grade", "2nd Grade"];
  
  const gradeDescriptions = {
    "Kindergarten": {
      title: "Money Basics & Counting",
      skills: [
        "Identify and count coins (₹1, ₹2, ₹5, ₹10)",
        "Understand needs vs. wants through fun stories",
        "Learn saving through piggy bank activities",
        "Simple earning through fun tasks and activities"
      ],
      color: "#FFD23F"
    },
    "1st Grade": {
      title: "Earning & Saving",
      skills: [
        "Recognising and using coins & notes up to ₹500",
        "Learn how money is earned and used",
        "Setting saving goals and working towards them",
        "Understanding the difference between goods & services",
        "Introduction to sharing and giving"
      ],
      color: "#06D6A0"
    },
    "2nd Grade": {
      title: "Sharing & Investing",
      skills: [
        "Learn the history and evolution of money",
        "Budgeting basics in play for small and big purchases",
        "Harvest vegetables and sell them at the market for profit",
        "Create wish lists and prioritize wants"
      ],
      color: "#EE6C4D"
    },
    "3rd Grade": {
      title: "Employement & Consumption",
      skills: [
        "Understand about different forms of employment",
        "Introduction to the Banking system of India",
        "Learn about risks, rewards and patience",
        "Introduction to Consumer Rights & Responsibilities",
        "Stock Market Basics: Buy your first stocks"
      ],
      color: "#3D5A80"
    },
    "4th Grade": {
      title: "Banking & Investing",
      skills: [
        "Introduction to money in the digital age",
        "Basics on bank accounts & types of loans",
        "Read about different types of investments",
        "Understand how deals, sales and discounts work",
        "Learn about entrepreneurship basics"
      ],
      color: "#9B5DE5"
    },
    "5th Grade": {
      title: "Advanced Financial Planning",
      skills: [
        "Learn about currencies and their conversions",
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
                data-testid="login-btn-nav"
                onClick={() => navigate('/login')}
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
                CoinQuest teaches K-2 kids about saving, spending, investing, and gifting through exciting games, quests, and real-world simulations!
              </p>
              <div className="flex flex-wrap gap-4">
                <button
                  data-testid="get-started-btn"
                  onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
                  className="btn-primary px-8 py-4 text-xl flex items-center gap-2"
                >
                  <Sparkles className="w-6 h-6" />
                  View Plans
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
            <p className="text-xl text-[#3D5A80]">Age-appropriate financial education from Kindergarten to 2nd Grade</p>
          </div>
          
          {/* 2x2 grid for 4 feature cards */}
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
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
      {walkthroughVideos?.child?.url && (
        <section className="py-20 bg-[#F8F9FA]" data-testid="walkthrough-video-section">
          <div className="container mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-4xl lg:text-5xl font-bold text-[#1D3557] mb-4" style={{ fontFamily: 'Fredoka' }}>
                {walkthroughVideos.global?.title || 'See CoinQuest in Action'}
              </h2>
              <p className="text-xl text-[#3D5A80] max-w-2xl mx-auto">
                {walkthroughVideos.global?.description || 'Watch how kids learn financial literacy through fun games and activities'}
              </p>
            </div>
            
            <div className="max-w-4xl mx-auto">
              {/* User Type Tabs */}
              <div className="flex flex-wrap justify-center gap-4 mb-8">
                <button
                  onClick={() => setSelectedVideoTab('child')}
                  className={`flex items-center gap-2 px-6 py-3 rounded-full border-2 transition-all cursor-pointer ${
                    selectedVideoTab === 'child'
                      ? 'bg-[#06D6A0] border-[#1D3557] shadow-[3px_3px_0px_0px_#1D3557] text-white'
                      : 'bg-white border-[#1D3557] hover:shadow-[2px_2px_0px_0px_#1D3557] text-[#1D3557]'
                  }`}
                >
                  <Play className={`w-4 h-4 ${selectedVideoTab === 'child' ? 'text-white' : 'text-[#06D6A0]'}`} />
                  <span className="text-sm font-bold">Child</span>
                </button>
                
                {walkthroughVideos.parent?.url && (
                  <button
                    onClick={() => setSelectedVideoTab('parent')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-full border-2 transition-all cursor-pointer ${
                      selectedVideoTab === 'parent'
                        ? 'bg-[#FFD23F] border-[#1D3557] shadow-[3px_3px_0px_0px_#1D3557] text-[#1D3557]'
                        : 'bg-white border-[#1D3557] hover:shadow-[2px_2px_0px_0px_#1D3557] text-[#1D3557]'
                    }`}
                  >
                    <Star className={`w-4 h-4 ${selectedVideoTab === 'parent' ? 'text-[#1D3557]' : 'text-[#FFD23F]'}`} />
                    <span className="text-sm font-bold">Parent</span>
                  </button>
                )}
                
                {walkthroughVideos.teacher?.url && (
                  <button
                    onClick={() => setSelectedVideoTab('teacher')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-full border-2 transition-all cursor-pointer ${
                      selectedVideoTab === 'teacher'
                        ? 'bg-[#EE6C4D] border-[#1D3557] shadow-[3px_3px_0px_0px_#1D3557] text-white'
                        : 'bg-white border-[#1D3557] hover:shadow-[2px_2px_0px_0px_#1D3557] text-[#1D3557]'
                    }`}
                  >
                    <Trophy className={`w-4 h-4 ${selectedVideoTab === 'teacher' ? 'text-white' : 'text-[#EE6C4D]'}`} />
                    <span className="text-sm font-bold">Teacher</span>
                  </button>
                )}
              </div>
              
              {/* Video Player */}
              <div className="card-playful p-4 bg-white">
                <div className="relative rounded-2xl overflow-hidden border-3 border-[#1D3557] bg-black aspect-video">
                  <video
                    key={selectedVideoTab}
                    controls
                    className="w-full h-full"
                    poster=""
                    data-testid="walkthrough-video-player"
                  >
                    <source src={getAssetUrl(walkthroughVideos[selectedVideoTab]?.url || walkthroughVideos.child?.url)} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
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
              <div className="w-20 h-20 mx-auto mb-4 bg-[#FFD23F] rounded-full border-3 border-[#1D3557] flex items-center justify-center overflow-hidden p-2">
                <img src="https://customer-assets.emergentagent.com/job_coinquest-kids-2/artifacts/hnfemth6_children.png" alt="Kids" className="w-full h-full object-contain" />
              </div>
              <h3 className="text-2xl font-bold text-[#1D3557] mb-3" style={{ fontFamily: 'Fredoka' }}>Kids</h3>
              <p className="text-[#3D5A80]">Learn money skills through games! Grow gardens, start businesses, earn rewards. No boring stuff—just fun!</p>
            </div>
            
            <div className="bg-white rounded-3xl border-3 border-[#1D3557] shadow-[6px_6px_0px_0px_#1D3557] p-8 text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-[#06D6A0] rounded-full border-3 border-[#1D3557] flex items-center justify-center overflow-hidden p-2">
                <img src="https://customer-assets.emergentagent.com/job_coinquest-kids-2/artifacts/u42iscql_family.png" alt="Family" className="w-full h-full object-contain" />
              </div>
              <h3 className="text-2xl font-bold text-[#1D3557] mb-3" style={{ fontFamily: 'Fredoka' }}>Parents</h3>
              <p className="text-[#3D5A80]">Give your child a lifetime advantage with money skills learned early. Fun games, parent dashboard, setting-up chores and allowance and more!</p>
            </div>
            
            <div className="bg-white rounded-3xl border-3 border-[#1D3557] shadow-[6px_6px_0px_0px_#1D3557] p-8 text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-[#EE6C4D] rounded-full border-3 border-[#1D3557] flex items-center justify-center overflow-hidden p-2">
                <img src="https://customer-assets.emergentagent.com/job_coinquest-kids-2/artifacts/reffqcdx_school.png" alt="School" className="w-full h-full object-contain" />
              </div>
              <h3 className="text-2xl font-bold text-[#1D3557] mb-3" style={{ fontFamily: 'Fredoka' }}>Schools</h3>
              <p className="text-[#3D5A80]">Engage students with game-based financial lessons. Complete curriculum, automatic assessments, and detailed analytics. No preparation needed—just click and teach.</p>
            </div>
          </div>
        </div>
      </section>
      
      {/* Pricing Section */}
      <PricingSection />
      
      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <div className="card-playful p-12 bg-[#FFD23F] text-center">
            <h2 className="text-4xl lg:text-5xl font-bold text-[#1D3557] mb-6" style={{ fontFamily: 'Fredoka' }}>
              Ready to Start the Adventure?
            </h2>
            <p className="text-xl text-[#1D3557] mb-8 max-w-2xl mx-auto">
              Give your child the gift of financial literacy. Try our 1-day plan to explore!
            </p>
            <button
              data-testid="cta-get-started-btn"
              onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
              className="bg-[#1D3557] text-white font-bold text-xl px-10 py-5 rounded-full border-3 border-[#1D3557] shadow-[4px_4px_0px_0px_white] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_white] transition-all"
            >
              Choose a Plan
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
              <a href="mailto:hello@coinquest.co.in" className="text-[#98C1D9] hover:text-white transition-colors flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                hello@coinquest.co.in
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
