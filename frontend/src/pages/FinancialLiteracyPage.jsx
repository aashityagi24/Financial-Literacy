import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Coins, BookOpen, Users, Sparkles, TrendingUp, Gift, Star, Trophy, School, Play, PiggyBank, HandCoins, ArrowLeft } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import PricingSection from '@/components/PricingSection';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { ExitIntentPopup } from '@/components/ExitIntentPopup';
import { trackMetaPixelPageView } from '@/utils/metaPixel';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const getAssetUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('/api/')) return `${BACKEND_URL}${path}`;
  return `${BACKEND_URL}/api/uploads/${path}`;
};

export default function FinancialLiteracyPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [walkthroughVideos, setWalkthroughVideos] = useState(null);
  const [selectedVideoTab, setSelectedVideoTab] = useState('child');
  const [selectedGrade, setSelectedGrade] = useState("Ages 7–8");
  const [trialPrice, setTrialPrice] = useState(49);

  useEffect(() => { trackMetaPixelPageView(); }, []);

  useEffect(() => {
    if (searchParams.get('session_expired') === 'true') {
      toast.error('Your session has ended. You may have logged in on another device.', {
        duration: 5000
      });
      window.history.replaceState({}, '', '/');
    }
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get('no_subscription') === 'true') {
      toast.error('You need an active subscription to access CoinQuest. Please purchase a plan below.', {
        duration: 8000
      });
      window.history.replaceState({}, '', '/');
      setTimeout(() => {
        document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
      }, 500);
    }

    const fetchWalkthroughVideos = async () => {
      try {
        const response = await axios.get(`${API}/admin/settings/walkthrough-video`);
        if (response.data.child?.url || response.data.parent?.url || response.data.teacher?.url) {
          setWalkthroughVideos(response.data);
        }
      } catch (error) {
        console.log('No walkthrough video configured');
      }
    };
    fetchWalkthroughVideos();

    // Keep the "Start/Try for ₹X" marketing CTAs (hero button + exit-intent
    // popup) in sync with the real 1-day trial price an admin sets in the
    // Subscription plan-config, instead of a hardcoded number drifting apart.
    const fetchTrialPrice = async () => {
      try {
        const response = await axios.get(`${API}/subscriptions/plans`);
        const price = response.data?.plans?.single_parent?.['1_day']?.base_price;
        if (price) setTrialPrice(price);
      } catch (error) {
        console.log('Could not fetch trial price, using default');
      }
    };
    fetchTrialPrice();
  }, [searchParams]);

  const handleLogin = () => {
    navigate('/login');
  };

  const features = [
    { icon: Coins, title: "Digital Wallet", description: "Learn how to manage and allocate money for Spending, Saving, Sharing and Investing.", color: "#FFD23F" },
    { icon: TrendingUp, title: "Money Garden", description: "Plant seeds, water your garden, and sell vegetables at the market to earn and grow your money.", color: "#06D6A0" },
    { icon: Gift, title: "Money Around Me", description: "Learn everything about money - currencies, history, real-world usage, and more.", color: "#EE6C4D" },
    { icon: Trophy, title: "Quests & Badges", description: "Complete challenges and chores to earn money and badges.", color: "#3D5A80" },
  ];

  const grades = [
    "Ages 5–6",
    "Ages 7–8",
    "Ages 9–10",
    // "Ages 11–12",  // uncomment when Grade 3 content is added to the app
  ];

  // Icon shown in the expanded card header
  const gradeIcon = { "Ages 5–6": "K", "Ages 7–8": "1", "Ages 9–10": "2", "Ages 11–12": "3" };

  const gradeDescriptions = {
    "Ages 5–6": {
      title: "Introduction to Money",
      skills: [
        "Recognise and count Indian coins and notes",
        "Where money comes from and how it reaches home",
        "Different ways people pay for things",
        "Earn, spend and save through fun tasks and games",
      ],
      color: "#FFD23F"
    },
    "Ages 7–8": {
      title: "Learning about value creation",
      skills: [
        "Indian and world currencies",
        "How jobs create value",
        "Saving and simple budgets",
        "Needs and wants",
        "Ways to pay: cash, cards and UPI",
      ],
      color: "#06D6A0"
    },
    // Grade 2 — uncomment "Ages 9–10" in the grades array above to show this tab
    "Ages 9–10": {
      title: "Learning to save and budget",
      skills: [
        "How to be a smart shopper",
        "Planning and budgeting",
        "Borrowing and lending",
        "How jobs and businesses work",
      ],
      color: "#EE6C4D"
    },
    // Grade 3 — uncomment "Ages 11–12" in the grades array above to show this tab
    "Ages 11–12": {
      title: "Employment and consumption",
      skills: [
        "Different types of jobs and employment",
        "How India's banking system works",
        "Risk, reward and patience",
        "Consumer rights and responsibilities",
        "Currency conversions",
      ],
      color: "#3D5A80"
    },
  };

  return (
    <div className="min-h-screen bg-[#E0FBFC]">
      <SiteHeader />
      <ExitIntentPopup trialPrice={trialPrice} />

      {/* Hero Section */}
      <header className="relative overflow-hidden">
        <div className="absolute top-32 right-20 w-16 h-16 bg-[#EE6C4D] rounded-full opacity-60 animate-float stagger-2"></div>
        <div className="absolute bottom-20 left-1/4 w-12 h-12 bg-[#06D6A0] rounded-full opacity-60 animate-float stagger-3"></div>

        <div className="container mx-auto px-6 pb-6 pt-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="animate-bounce-in">
              <h1 className="text-5xl lg:text-7xl font-bold text-[#1D3557] mb-6 leading-tight" style={{ fontFamily: 'Fredoka' }}>
                Money lessons your 5–10-year-old will <span className="text-[#EE6C4D]">actually look forward to.</span>
              </h1>
              <p className="text-xl text-[#3D5A80] mb-8 leading-relaxed">
                Stories, games and real jobs at home that teach your child to earn, save, spend and share. 10 minutes a day, from KG to Class 5.
              </p>
              <div className="flex flex-col gap-3">
                <div>
                  <button
                    data-testid="get-started-btn"
                    onClick={() => window.dispatchEvent(new CustomEvent('coinquest:buy-now', { detail: { duration: '1_day' } }))}
                    className="btn-primary px-8 py-4 text-xl flex items-center gap-2"
                  >
                    <Sparkles className="w-6 h-6" />
                    Try a day for ₹{trialPrice}
                  </button>
                  <p className="mt-2 text-sm text-[#1D3557]/70">
                    One-time payment · No auto-renewal · UPI or card
                  </p>
                </div>
                <button
                  onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
                  className="self-start flex items-center gap-1.5 text-base font-semibold text-[#1D3557] hover:text-[#EE6C4D] transition-colors"
                  data-testid="hero-watch-tour-btn"
                >
                  <span className="text-[#EE6C4D]">▶</span> Watch a 2-minute tour
                </button>
              </div>
            </div>

            <div className="relative animate-bounce-in stagger-2">
              <div className="card-playful p-8 bg-white">
                <img
                  data-testid="hero-image"
                  src="https://customer-assets-lxgj4vgw.emergentagent.net/job_0398c744-4209-4c10-8036-86989679bc23/artifacts/js5jy0cl_1.png"
                  alt="Child learning about money with CoinQuest"
                  className="w-full h-64 object-cover rounded-2xl border-3 border-[#1D3557]"
                />
                <div className="mt-6 grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-[#FFD23F]/20 rounded-xl border-2 border-[#1D3557]">
                    <PiggyBank className="w-8 h-8 mx-auto text-[#FFD23F]" />
                    <p className="text-sm font-bold text-[#1D3557] mt-1">Saving Money</p>
                  </div>
                  <div className="text-center p-3 bg-[#EE6C4D]/20 rounded-xl border-2 border-[#1D3557]">
                    <HandCoins className="w-8 h-8 mx-auto text-[#EE6C4D]" />
                    <p className="text-sm font-bold text-[#1D3557] mt-1">Earning Money</p>
                  </div>
                  <div className="text-center p-3 bg-[#06D6A0]/20 rounded-xl border-2 border-[#1D3557]">
                    <TrendingUp className="w-8 h-8 mx-auto text-[#06D6A0]" />
                    <p className="text-sm font-bold text-[#1D3557] mt-1">Growing Money</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Video Walkthrough Section */}
      {walkthroughVideos?.child?.url && (
        <section id="how-it-works" className="py-20 bg-[#F8F9FA]" data-testid="walkthrough-video-section">
          <div className="container mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-4xl lg:text-5xl font-bold text-[#1D3557] mb-4" style={{ fontFamily: 'Fredoka' }}>
                {walkthroughVideos.global?.title || 'See exactly what your child will do'}
              </h2>
              <p className="text-xl text-[#3D5A80] max-w-2xl mx-auto">
                {walkthroughVideos.global?.description || 'A 2-minute look inside CoinQuest: the stories and games your child plays, and what you see on your dashboard.'}
              </p>
            </div>

            <div className="max-w-4xl mx-auto">
              <div className="flex flex-wrap justify-center gap-4 mb-8">
                <button
                  onClick={() => setSelectedVideoTab('child')}
                  data-testid="video-tab-child"
                  className={`flex items-center gap-2 px-6 py-3 rounded-full border-2 transition-all cursor-pointer ${
                    selectedVideoTab === 'child'
                      ? 'bg-[#06D6A0] border-[#1D3557] shadow-[3px_3px_0px_0px_#1D3557] text-white'
                      : 'bg-white border-[#1D3557] hover:shadow-[2px_2px_0px_0px_#1D3557] text-[#1D3557]'
                  }`}
                >
                  <Play className={`w-4 h-4 ${selectedVideoTab === 'child' ? 'text-white' : 'text-[#06D6A0]'}`} />
                  <span className="text-sm font-bold">What your child does</span>
                </button>

                {walkthroughVideos.parent?.url && (
                  <button
                    onClick={() => setSelectedVideoTab('parent')}
                    data-testid="video-tab-parent"
                    className={`flex items-center gap-2 px-6 py-3 rounded-full border-2 transition-all cursor-pointer ${
                      selectedVideoTab === 'parent'
                        ? 'bg-[#FFD23F] border-[#1D3557] shadow-[3px_3px_0px_0px_#1D3557] text-[#1D3557]'
                        : 'bg-white border-[#1D3557] hover:shadow-[2px_2px_0px_0px_#1D3557] text-[#1D3557]'
                    }`}
                  >
                    <Star className={`w-4 h-4 ${selectedVideoTab === 'parent' ? 'text-[#1D3557]' : 'text-[#FFD23F]'}`} />
                    <span className="text-sm font-bold">What you see</span>
                  </button>
                )}

                {walkthroughVideos.teacher?.url && (
                  <button
                    onClick={() => setSelectedVideoTab('teacher')}
                    data-testid="video-tab-teacher"
                    className={`flex items-center gap-2 px-6 py-3 rounded-full border-2 transition-all cursor-pointer ${
                      selectedVideoTab === 'teacher'
                        ? 'bg-[#EE6C4D] border-[#1D3557] shadow-[3px_3px_0px_0px_#1D3557] text-white'
                        : 'bg-white border-[#1D3557] hover:shadow-[2px_2px_0px_0px_#1D3557] text-[#1D3557]'
                    }`}
                  >
                    <Trophy className={`w-4 h-4 ${selectedVideoTab === 'teacher' ? 'text-white' : 'text-[#EE6C4D]'}`} />
                    <span className="text-sm font-bold">For teachers</span>
                  </button>
                )}
              </div>

              <div className="card-playful p-4 bg-white">
                <div className="relative rounded-2xl overflow-hidden border-3 border-[#1D3557] bg-black aspect-video">
                  <video
                    key={selectedVideoTab}
                    controls
                    className="w-full h-full"
                    poster={walkthroughVideos[selectedVideoTab]?.poster ? getAssetUrl(walkthroughVideos[selectedVideoTab].poster) : undefined}
                    preload="metadata"
                    playsInline
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

      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-[#1D3557] mb-4" style={{ fontFamily: 'Fredoka' }}>
              Everything Kids Need to Learn About Money
            </h2>
            <p className="text-xl text-[#3D5A80]">Age-appropriate money lessons for ages 5–12, KG to Class 5.</p>
          </div>

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

      {/* Grade Levels Section */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-[#1D3557] mb-4" style={{ fontFamily: 'Fredoka' }}>
              Tailored for Every Age
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

          {selectedGrade && gradeDescriptions[selectedGrade] && (
            <div className="max-w-3xl mx-auto animate-in slide-in-from-top-4 duration-300">
              <div
                className="bg-white rounded-3xl border-3 border-[#1D3557] shadow-[6px_6px_0px_0px_#1D3557] p-8 overflow-hidden"
                style={{ borderLeftWidth: '6px', borderLeftColor: gradeDescriptions[selectedGrade].color }}
              >
                <div className="flex items-center gap-4 mb-6">
                  <div
                    className="w-16 h-16 rounded-full border-3 border-[#1D3557] flex items-center justify-center text-2xl font-bold text-white"
                    style={{ backgroundColor: gradeDescriptions[selectedGrade].color, fontFamily: 'Fredoka' }}
                  >
                    {gradeIcon[selectedGrade] || selectedGrade.charAt(0)}
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
                  onClick={() => window.dispatchEvent(new CustomEvent('coinquest:buy-now', { detail: { duration: '1_day' } }))}
                  className="mt-6 w-full py-3 rounded-xl font-bold text-white transition-all hover:-translate-y-1"
                  style={{ backgroundColor: gradeDescriptions[selectedGrade].color }}
                  data-testid="grade-cta-btn"
                >
                  Try a day for ₹{trialPrice}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6">
          <div className="card-playful p-12 bg-[#E0FBFC] text-center">
            <h2 className="text-4xl lg:text-5xl font-bold text-[#1D3557] mb-6" style={{ fontFamily: 'Fredoka' }}>
              Give it one day.
            </h2>
            <p className="text-xl text-[#1D3557] mb-8 max-w-2xl mx-auto">
              For ₹{trialPrice} your child gets every story, game and quest for a day. No auto-renewal.
            </p>
            <button
              data-testid="cta-get-started-btn"
              onClick={() => window.dispatchEvent(new CustomEvent('coinquest:buy-now', { detail: { duration: '1_day' } }))}
              className="bg-[#1D3557] text-white font-bold text-xl px-10 py-5 rounded-full border-3 border-[#1D3557] shadow-[4px_4px_0px_0px_#FFD23F] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#FFD23F] transition-all"
            >
              Try a day for ₹{trialPrice}
            </button>
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
              <div className="w-20 h-20 mx-auto mb-4 bg-[#FFD23F] rounded-full border-3 border-[#1D3557] flex items-center justify-center overflow-hidden p-2">
                <img src="https://customer-assets.emergentagent.com/job_coinquest-kids-2/artifacts/hnfemth6_children.png" alt="Kids" className="w-full h-full object-contain" />
              </div>
              <h3 className="text-2xl font-bold text-[#1D3557] mb-3" style={{ fontFamily: 'Fredoka' }}>For your child</h3>
              <p className="text-[#3D5A80]">Grow a money garden, run a market stall and finish quests. Short, playful lessons made for ages 5–12.</p>
            </div>

            <div className="bg-white rounded-3xl border-3 border-[#1D3557] shadow-[6px_6px_0px_0px_#1D3557] p-8 text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-[#06D6A0] rounded-full border-3 border-[#1D3557] flex items-center justify-center overflow-hidden p-2">
                <img src="https://customer-assets.emergentagent.com/job_coinquest-kids-2/artifacts/u42iscql_family.png" alt="Family" className="w-full h-full object-contain" />
              </div>
              <h3 className="text-2xl font-bold text-[#1D3557] mb-3" style={{ fontFamily: 'Fredoka' }}>For you</h3>
              <p className="text-[#3D5A80]">A dashboard that shows what your child learnt today, plus chores and pocket money you can set up together.</p>
            </div>

            <div className="bg-white rounded-3xl border-3 border-[#1D3557] shadow-[6px_6px_0px_0px_#1D3557] p-8 text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-[#EE6C4D] rounded-full border-3 border-[#1D3557] flex items-center justify-center overflow-hidden p-2">
                <img src="https://customer-assets.emergentagent.com/job_coinquest-kids-2/artifacts/reffqcdx_school.png" alt="School" className="w-full h-full object-contain" />
              </div>
              <h3 className="text-2xl font-bold text-[#1D3557] mb-3" style={{ fontFamily: 'Fredoka' }}>For schools</h3>
              <p className="text-[#3D5A80]">A ready-to-teach classroom programme with assessments and reports.</p>
              <button
                data-testid="see-school-plan-link"
                onClick={() => navigate('/for-schools')}
                className="mt-3 text-[#EE6C4D] font-semibold hover:underline text-sm"
              >
                See the school plan →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <PricingSection />

      {/* Footer */}
      <SiteFooter />
    </div>
  );
}
