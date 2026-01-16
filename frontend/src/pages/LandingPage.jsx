import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coins, BookOpen, Users, Sparkles, TrendingUp, Gift, Star, Trophy, Shield, X } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function LandingPage() {
  const navigate = useNavigate();
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  const handleLogin = () => {
    const redirectUrl = window.location.origin + '/dashboard';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
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
            <div className="flex items-center gap-3">
              <img 
                src="https://customer-assets.emergentagent.com/job_6e7204b4-e7e4-42b3-b74e-111b68302b75/artifacts/ul81dgc9_Friendly%20%27Money%20Matter%27%20Logo%20Design%20%281%29.png" 
                alt="CoinQuest Logo" 
                className="h-72 w-auto"
              />
            </div>
            <div className="flex items-center gap-3">
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
      
      {/* Grade Levels Section */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-[#1D3557] mb-4" style={{ fontFamily: 'Fredoka' }}>
              Tailored for Every Grade Level
            </h2>
            <p className="text-xl text-[#3D5A80]">Content adapts to your child's age and learning level</p>
          </div>
          
          <div className="flex flex-wrap justify-center gap-4">
            {grades.map((grade, index) => (
              <div 
                key={index}
                className="card-playful px-6 py-4 hover:bg-[#FFD23F] transition-colors cursor-pointer"
              >
                <span className="text-lg font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>{grade}</span>
              </div>
            ))}
          </div>
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
                <span className="text-4xl">👨‍👩‍👧</span>
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
      <footer className="bg-[#1D3557] py-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-3 mb-6 md:mb-0">
              <img 
                src="https://customer-assets.emergentagent.com/job_6e7204b4-e7e4-42b3-b74e-111b68302b75/artifacts/ul81dgc9_Friendly%20%27Money%20Matter%27%20Logo%20Design%20%281%29.png" 
                alt="CoinQuest Logo" 
                className="h-48 w-auto"
              />
            </div>
            <p className="text-[#98C1D9]">© Learners' Planet. Educating kids in fun and interactive ways to get them future-ready!</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
