import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  PiggyBank, Rocket, TrendingUp, CalendarDays, Users, GraduationCap, ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { BookCallButton } from '@/components/BookCallDialog';

const PARENT_AVATARS = [
  'https://static.prod-images.emergentagent.com/jobs/5f108aa9-f735-40f8-8a41-389db6115b0a/images/6e9d1b311fdb60b83fdafadb83d0334b813d041063d07092835b78881ba6ce8f.jpeg',
  'https://static.prod-images.emergentagent.com/jobs/5f108aa9-f735-40f8-8a41-389db6115b0a/images/ba64de098a72d6e31c0770b900cf8a37f452d73edb6609a7f16e887f5837b63c.jpeg',
  'https://static.prod-images.emergentagent.com/jobs/5f108aa9-f735-40f8-8a41-389db6115b0a/images/01574c1a7f85463d429c8a5f8ec66559da0901760c7f95f48cc8a73ddae1541b.jpeg',
];

const workshopSteps = [
  { color: '#FFD23F', title: 'Book a free trial class', description: 'Pick a slot. Your child joins a live class with kids their own age — no payment up front.' },
  { color: '#06D6A0', title: 'Join their age batch', description: 'Weekly live classes, plus platform games and worksheets between sessions to keep it going.' },
  { color: '#F4A9B7', title: 'Watch them run a venture', description: "By the end of the batch they've earned, budgeted, priced and sold something themselves." },
];

const platformSteps = [
  { color: '#FFD23F', title: 'Pick a plan & grade', description: "Choose a subscription plan and your child's grade — content adapts automatically from KG to Class 5." },
  { color: '#06D6A0', title: 'Watch them learn', description: 'Every topic mixes videos, games, quizzes, live sessions and hands-on activities — so it never feels like a textbook.' },
  { color: '#F4A9B7', title: 'Implement at home', description: "Set up chores, allowance and savings goals so lessons turn into real money habits you can track together." },
];

function HowItWorks({ id, testId, eyebrow, title, steps, bg }) {
  return (
    <section id={id} className="py-16" style={{ backgroundColor: bg }} data-testid={testId}>
      <div className="container mx-auto px-6">
        <div className="text-center mb-14">
          {eyebrow && (
            <span className="inline-block bg-white text-[#1D3557] font-bold text-sm px-4 py-1.5 rounded-full border-2 border-[#1D3557] mb-4">{eyebrow}</span>
          )}
          <h2 className="text-4xl lg:text-5xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>{title}</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-8 md:gap-4 max-w-4xl mx-auto relative">
          {steps.map((step, idx) => (
            <div key={idx} className="relative text-center px-2">
              {idx < steps.length - 1 && (
                <div className="hidden md:block absolute top-7 left-[calc(50%+32px)] right-[calc(-50%+32px)] border-t-2 border-dashed border-[#1D3557]/30"></div>
              )}
              <div
                className="relative z-10 w-14 h-14 mx-auto mb-4 rounded-full border-3 border-[#1D3557] shadow-[3px_3px_0px_0px_rgba(29,53,87,0.3)] flex items-center justify-center text-xl font-bold text-[#1D3557]"
                style={{ backgroundColor: step.color, fontFamily: 'Fredoka' }}
              >
                {idx + 1}
              </div>
              <h3 className="text-lg font-bold text-[#1D3557] mb-2" style={{ fontFamily: 'Fredoka' }}>{step.title}</h3>
              <p className="text-[#3D5A80] text-sm leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('session_expired') === 'true') {
      toast.error('Your session has ended. You may have logged in on another device.', {
        duration: 5000
      });
      window.history.replaceState({}, '', '/');
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-[#E0FBFC]">
      {/* Nav + Hero */}
      <header
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(120deg, #EAF7EE 0%, #FDF6E3 45%, #FDE9C8 100%)' }}
      >
        <div className="absolute top-32 right-20 w-16 h-16 bg-[#EE6C4D] rounded-full opacity-30 animate-float stagger-2"></div>
        <div className="absolute bottom-20 left-1/4 w-12 h-12 bg-[#06D6A0] rounded-full opacity-30 animate-float stagger-3"></div>

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
            <button
              data-testid="login-btn-nav"
              onClick={() => navigate('/login')}
              className="btn-primary px-6 py-3 text-lg"
            >
              Sign In
            </button>
          </nav>

          <div className="max-w-2xl animate-bounce-in pb-12">
            <h1 className="text-5xl lg:text-6xl font-bold text-[#1D3557] mb-6 leading-tight" style={{ fontFamily: 'Fredoka' }}>
              Nurture the{' '}
              <span className="relative inline-block">
                <span className="relative z-10 text-[#EE6C4D]">founder</span>
                <span className="absolute left-[-4px] right-[-4px] bottom-[6px] h-3 bg-[#FFD23F] -rotate-1 -z-0"></span>
              </span>{' '}
              in your child.
            </h1>
            <p className="text-xl text-[#3D5A80] mb-10 leading-relaxed" data-testid="hub-hero-subtext">
              No one is born an entrepreneur — they're raised as one. 30 live classes where your child learns to earn, price, pitch and sell for real.
            </p>
            <div className="flex flex-wrap gap-4 mb-6">
              <BookCallButton
                className="bg-[#EE6C4D] text-white font-bold px-7 py-4 text-lg rounded-full shadow-[0_6px_16px_rgba(238,108,77,0.4)] hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(238,108,77,0.5)] transition-all"
              />
            </div>

            {/* Trust element */}
            <div className="flex items-center gap-3" data-testid="trust-element">
              <div className="flex -space-x-3">
                <img src={PARENT_AVATARS[0]} alt="Parent" className="w-9 h-9 rounded-full border-2 border-white object-cover" />
                <img src={PARENT_AVATARS[1]} alt="Parent" className="w-9 h-9 rounded-full border-2 border-white object-cover" />
                <img src={PARENT_AVATARS[2]} alt="Parent" className="w-9 h-9 rounded-full border-2 border-white object-cover" />
              </div>
              <span className="text-[#3D5A80] font-medium">Trusted by hundreds of children & parents across India</span>
            </div>
          </div>
        </div>
      </header>

      {/* Programs Section */}
      <section id="programs" className="py-16 bg-white">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl lg:text-5xl font-bold text-[#1D3557] mb-4" style={{ fontFamily: 'Fredoka' }}>
              Choose Your Child's Adventure
            </h2>
            <p className="text-xl text-[#3D5A80]">Two focused programs — pick one, or give your child both</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto items-stretch">
            {/* Entrepreneurship Workshop card */}
            <div
              data-testid="ew-product-card"
              className="card-playful p-8 bg-[#F3E8FF] flex flex-col animate-bounce-in cursor-pointer group"
              onClick={() => navigate('/entrepreneurship-workshop')}
            >
              <div className="w-16 h-16 rounded-2xl border-3 border-[#1D3557] shadow-[3px_3px_0px_0px_#1D3557] flex items-center justify-center mb-5 bg-[#5B21B6]">
                <Rocket className="w-9 h-9 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-[#1D3557] mb-2" style={{ fontFamily: 'Fredoka' }}>Entrepreneurship Workshop</h3>
              <p className="text-[#3D5A80] mb-5">A grade-specific, batch-based program with live classes where kids pitch ideas, run mini ventures, and build a business mindset.</p>
              <ul className="space-y-2 mb-6 text-sm text-[#3D5A80]">
                <li className="flex items-center gap-2"><CalendarDays className="w-4 h-4 text-[#5B21B6]" /> Dated batches with live classes included</li>
                <li className="flex items-center gap-2"><Rocket className="w-4 h-4 text-[#5B21B6]" /> Idea pitching & mini-venture simulations</li>
                <li className="flex items-center gap-2"><Users className="w-4 h-4 text-[#5B21B6]" /> Book a free trial to get started</li>
              </ul>
              <button
                data-testid="explore-ew-btn"
                className="mt-auto flex items-center justify-center gap-2 bg-[#5B21B6] text-white font-bold px-6 py-3 rounded-full group-hover:-translate-y-1 transition-all"
              >
                Guided Workshop <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Financial Literacy Platform card */}
            <div
              data-testid="fl-product-card"
              className="card-playful p-8 bg-[#FFF9E8] flex flex-col animate-bounce-in stagger-2 cursor-pointer group"
              onClick={() => navigate('/financial-literacy')}
            >
              <div className="w-16 h-16 rounded-2xl border-3 border-[#1D3557] shadow-[3px_3px_0px_0px_#1D3557] flex items-center justify-center mb-5 bg-[#FFD23F]">
                <PiggyBank className="w-9 h-9 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-[#1D3557] mb-2" style={{ fontFamily: 'Fredoka' }}>Financial Literacy Platform</h3>
              <p className="text-[#3D5A80] mb-5">Digital wallet, Money Garden, quests and badges that teach earning, saving, sharing and investing — grade by grade, KG through Class 5.</p>
              <ul className="space-y-2 mb-6 text-sm text-[#3D5A80]">
                <li className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-[#FFD23F]" /> Game-based money lessons</li>
                <li className="flex items-center gap-2"><Users className="w-4 h-4 text-[#FFD23F]" /> Parent dashboard, chores & allowance</li>
                <li className="flex items-center gap-2"><GraduationCap className="w-4 h-4 text-[#FFD23F]" /> Plans from ₹49</li>
              </ul>
              <button
                data-testid="explore-fl-btn"
                className="mt-auto flex items-center justify-center gap-2 bg-[#1D3557] text-white font-bold px-6 py-3 rounded-full group-hover:-translate-y-1 transition-all"
              >
                DIY Platform <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* How the Workshop Works */}
      <HowItWorks
        id="how-workshop-works"
        testId="how-workshop-works-section"
        eyebrow="ENTREPRENEURSHIP WORKSHOP"
        title="How the Workshop Works"
        steps={workshopSteps}
        bg="#FDF6E3"
      />

      {/* How the Platform Works */}
      <HowItWorks
        id="how-platform-works"
        testId="how-platform-works-section"
        eyebrow="FINANCIAL LITERACY PLATFORM"
        title="How the Platform Works"
        steps={platformSteps}
        bg="#F3F9FB"
      />

      {/* For Parents & Schools Section */}
      <section className="py-20 bg-[#3D5A80]">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-4" style={{ fontFamily: 'Fredoka' }}>
              For Parents & Schools
            </h2>
            <p className="text-xl text-[#98C1D9]">Both programs, built to fit however you want to bring them in</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-white rounded-3xl border-3 border-[#1D3557] shadow-[6px_6px_0px_0px_#1D3557] p-8 text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-[#06D6A0] rounded-full border-3 border-[#1D3557] flex items-center justify-center overflow-hidden p-2">
                <img src="https://customer-assets.emergentagent.com/job_coinquest-kids-2/artifacts/u42iscql_family.png" alt="Family" className="w-full h-full object-contain" />
              </div>
              <h3 className="text-2xl font-bold text-[#1D3557] mb-3" style={{ fontFamily: 'Fredoka' }}>Parents</h3>
              <p className="text-[#3D5A80]">Give your child a lifetime advantage. Let them explore money skills at their own pace on the Financial Literacy Platform, or join live, guided sessions in the Entrepreneurship Workshop — pick one or both, and track everything from a single parent dashboard.</p>
            </div>

            <div className="bg-white rounded-3xl border-3 border-[#1D3557] shadow-[6px_6px_0px_0px_#1D3557] p-8 text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-[#EE6C4D] rounded-full border-3 border-[#1D3557] flex items-center justify-center overflow-hidden p-2">
                <img src="https://customer-assets.emergentagent.com/job_coinquest-kids-2/artifacts/reffqcdx_school.png" alt="School" className="w-full h-full object-contain" />
              </div>
              <h3 className="text-2xl font-bold text-[#1D3557] mb-3" style={{ fontFamily: 'Fredoka' }}>Schools</h3>
              <p className="text-[#3D5A80]">Bring both programs into your classroom: the self-paced Financial Literacy Platform for daily lessons with automatic assessments, and the live Entrepreneurship Workshop for hands-on venture-building — with detailed analytics for every student either way.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6">
          <div className="card-playful p-12 bg-[#E0FBFC] text-center">
            <h2 className="text-4xl lg:text-5xl font-bold text-[#1D3557] mb-6" style={{ fontFamily: 'Fredoka' }}>
              Ready to Start the Adventure?
            </h2>
            <p className="text-xl text-[#1D3557] mb-8 max-w-2xl mx-auto">
              Explore either program in detail and find the right fit for your child.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <button
                data-testid="cta-explore-ew-btn"
                onClick={() => navigate('/entrepreneurship-workshop')}
                className="bg-[#5B21B6] text-white font-bold text-lg px-8 py-4 rounded-full border-3 border-[#1D3557] shadow-[4px_4px_0px_0px_#1D3557] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#1D3557] transition-all"
              >
                Entrepreneurship Workshop
              </button>
              <button
                data-testid="cta-explore-fl-btn"
                onClick={() => navigate('/financial-literacy')}
                className="bg-[#FFD23F] text-[#1D3557] font-bold text-lg px-8 py-4 rounded-full border-3 border-[#1D3557] shadow-[4px_4px_0px_0px_#1D3557] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#1D3557] transition-all"
              >
                Financial Literacy Platform
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#1D3557] py-8">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
            <div className="flex flex-col items-center md:items-start">
              <img
                src="https://customer-assets.emergentagent.com/job_6e7204b4-e7e4-42b3-b74e-111b68302b75/artifacts/ul81dgc9_Friendly%20%27Money%20Matter%27%20Logo%20Design%20%281%29.png"
                alt="CoinQuest Logo"
                className="h-36 w-auto"
              />
            </div>

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

