import { useState } from 'react';
import {
  UserCheck, BookOpen, CalendarDays, Target, Printer,
  Mic, Briefcase, Tag, Tent, Sparkles,
} from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';
import { SchoolEnquiryDialog } from '@/components/SchoolEnquiryDialog';

const FL_CARDS = [
  { icon: Target, label: 'What students walk away with', desc: 'Practical money skills — saving, budgeting and spending decisions — built through activities, not lectures.', wide: true },
  { icon: UserCheck, label: 'Who delivers it', desc: 'Your teachers. We equip them fully, so there is no dependency on external facilitators for every session.' },
  { icon: BookOpen, label: 'What we provide', desc: 'Complete curriculum, lesson plans, activities and assessment materials — ready to teach, no prep required from your staff.' },
  { icon: CalendarDays, label: 'How it fits your schedule', desc: 'A dedicated period, an after-school club or a term-long elective — the structure adapts to however you run co-curricular time.' },
  { icon: Printer, label: 'Everything print-ready', desc: 'Worksheets, activity sheets and assignments print straight from the lesson, or go out digitally to the class.' },
];

const EW_CARDS = [
  { icon: Tag, label: 'What students walk away with', desc: 'A real product, priced and pitched, with an actual sale made — a tangible outcome by the end of the program.', wide: true },
  { icon: Mic, label: 'Who delivers it', desc: 'Our facilitators run every session. Your teachers can be as involved or as hands-off as you would like.' },
  { icon: Briefcase, label: 'What we provide', desc: 'Structured weekly sessions, all materials and a facilitator-led format — fully managed from our end.' },
  { icon: CalendarDays, label: 'How it fits your schedule', desc: 'A weekly workshop slot — activity period, elective hour or after-school program.' },
  { icon: Tent, label: 'Culmination day on campus', desc: 'We come to your school for a showcase: stalls, pitches and real selling, with parents and leadership invited.' },
];

const COMPARISON_ROWS = [
  { label: 'Who teaches', fl: 'Your own teachers, equipped by us', ew: 'Our facilitators, every session' },
  { label: 'Hours', fl: '36 hours', ew: '30 hours' },
  { label: 'Scheduling', fl: 'Flexible — period, club or elective', ew: 'A weekly workshop slot' },
  { label: 'What we provide', fl: 'Curriculum, lesson plans, activities, assessments', ew: 'Sessions, all materials, facilitation' },
  { label: 'Prep for your staff', fl: 'None — ready to teach', ew: 'None — teachers can stay hands-off' },
  { label: 'Students walk away with', fl: 'Saving, budgeting and spending skills', ew: 'A real product, priced, pitched and sold' },
  { label: 'Best for', fl: 'Everyday financial literacy, school-wide', ew: 'A flagship program for one grade' },
];

function ProgramCard({ icon: Icon, label, desc, wide, iconBg, iconColor }) {
  return (
    <div
      className={`bg-white rounded-2xl border-[3px] border-[#1D3557] p-6 shadow-[4px_4px_0px_0px_#1D3557] hover:shadow-[6px_6px_0px_0px_#1D3557] hover:-translate-y-1 transition-all duration-200 ${wide ? 'md:col-span-2' : 'md:col-span-1'}`}
      data-testid={`program-card-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div
        className="w-12 h-12 rounded-xl border-2 border-[#1D3557] flex items-center justify-center mb-4 shadow-[2px_2px_0px_0px_#1D3557]"
        style={{ backgroundColor: iconBg }}
      >
        <Icon className="w-6 h-6" style={{ color: iconColor }} strokeWidth={2.25} />
      </div>
      <p className="text-sm font-bold uppercase tracking-wide text-[#1D3557] mb-2" style={{ fontFamily: 'Fredoka' }}>{label}</p>
      <p className="text-[#3D5A80] leading-relaxed">{desc}</p>
    </div>
  );
}

function ProgramSection({
  testId, sectionBg, programLabel, badgeBg, badgeTextColor, badgeRotate, title, titleColor,
  subtitle, cards, cardIconBg, cardIconColor,
}) {
  return (
    <section className={sectionBg} data-testid={testId}>
      <div className="container mx-auto px-6 py-16 md:py-20">
        <div className="mb-12">
          <span
            className={`inline-block font-bold text-sm uppercase tracking-widest px-4 py-2 rounded-full border-[3px] border-[#1D3557] shadow-[3px_3px_0px_0px_#1D3557] mb-4 ${badgeRotate}`}
            style={{ backgroundColor: badgeBg, color: badgeTextColor, fontFamily: 'Fredoka' }}
          >
            {programLabel}
          </span>
          <h3 className="text-4xl md:text-5xl font-bold mb-4" style={{ fontFamily: 'Fredoka', color: titleColor }}>
            {title}
          </h3>
          <p className="text-lg text-[#3D5A80] leading-relaxed max-w-2xl">{subtitle}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cards.map((c) => <ProgramCard key={c.label} {...c} iconBg={cardIconBg} iconColor={cardIconColor} />)}
        </div>
      </div>
    </section>
  );
}

export default function ForSchoolsPage() {
  const [showEnquiry, setShowEnquiry] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />

      {/* Hero */}
      <header
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(120deg, #EAF7EE 0%, #FDF6E3 45%, #FDE9C8 100%)' }}
        data-testid="for-schools-hero"
      >
        <div className="container mx-auto px-6 py-16 lg:py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="animate-bounce-in">
              <h1 className="text-5xl md:text-6xl font-bold text-[#1D3557] mb-6 leading-tight" style={{ fontFamily: 'Fredoka' }}>
                Beyond academics: raise students who{' '}
                <span className="relative inline-block">
                  <span className="relative z-10 text-[#EE6C4D]">understand money and think like builders.</span>
                  <span className="absolute left-[-4px] right-[-4px] bottom-[4px] h-3 bg-[#FFD23F] -rotate-1 -z-0"></span>
                </span>
              </h1>
              <p className="text-lg text-[#3D5A80] mb-8 leading-relaxed" data-testid="for-schools-hero-subtext">
                CoinQuest brings financial literacy and entrepreneurship programs into your school — hands-on, outcome-driven, and built to complement your existing curriculum.
              </p>
              <button
                data-testid="for-schools-hero-cta-btn"
                onClick={() => setShowEnquiry(true)}
                className="bg-[#EE6C4D] text-white font-bold px-8 py-4 text-lg rounded-full border-3 border-[#1D3557] shadow-[4px_4px_0px_0px_#1D3557] hover:-translate-y-1 transition-all flex items-center gap-2"
              >
                <Sparkles className="w-5 h-5" /> Enquire Now
              </button>
            </div>

            {/* Image placeholder — to be added later */}
            <div className="hidden lg:block" data-testid="for-schools-hero-image-placeholder"></div>
          </div>
        </div>
      </header>

      {/* Program 1: Financial Literacy */}
      <ProgramSection
        testId="program-financial-literacy"
        sectionBg="bg-white"
        programLabel="Program 1"
        badgeBg="#06D6A0"
        badgeTextColor="#1D3557"
        badgeRotate="-rotate-2"
        title="Financial Literacy"
        titleColor="#1D3557"
        subtitle="School-led · 36 hours · Flexible scheduling. Your teachers deliver it — we equip them fully, so no session depends on an external facilitator."
        cards={FL_CARDS}
        cardIconBg="#06D6A0"
        cardIconColor="#1D3557"
      />

      {/* Program 2: Entrepreneurship Workshop */}
      <ProgramSection
        testId="program-entrepreneurship-workshop"
        sectionBg="bg-[#FDF6E3]"
        programLabel="Program 2"
        badgeBg="#EE6C4D"
        badgeTextColor="#FFFFFF"
        badgeRotate="rotate-2"
        title="Entrepreneurship Workshop"
        titleColor="#5B21B6"
        subtitle="CoinQuest-facilitated · 30 hours · Weekly sessions. Fully managed from our end, ending in a culmination showcase on your campus."
        cards={EW_CARDS}
        cardIconBg="#EE6C4D"
        cardIconColor="#1D3557"
      />

      {/* Comparison table */}
      <section className="bg-white py-16 md:py-20" data-testid="program-comparison-section">
        <div className="container mx-auto px-6">
          <h2 className="text-4xl md:text-5xl font-bold text-[#1D3557] text-center mb-12" style={{ fontFamily: 'Fredoka' }}>
            Which one fits your school?
          </h2>
          <div className="max-w-4xl mx-auto rounded-2xl border-[3px] border-[#1D3557] overflow-hidden shadow-[8px_8px_0px_0px_#1D3557]">
            <table className="w-full text-sm md:text-base">
              <thead>
                <tr className="bg-[#1D3557] text-white">
                  <th className="text-left py-5 px-5 font-bold" style={{ fontFamily: 'Fredoka' }}></th>
                  <th className="text-left py-5 px-5 font-bold text-[#06D6A0]" style={{ fontFamily: 'Fredoka' }}>Financial Literacy</th>
                  <th className="text-left py-5 px-5 font-bold text-[#FFD23F]" style={{ fontFamily: 'Fredoka' }}>Entrepreneurship Workshop</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, idx) => (
                  <tr key={row.label} className={`border-b-2 border-[#1D3557]/10 last:border-b-0 ${idx % 2 === 0 ? 'bg-[#FDF6E3]' : 'bg-white'}`}>
                    <td className="py-5 px-5 font-bold text-[#1D3557] whitespace-nowrap">{row.label}</td>
                    <td className="py-5 px-5 text-[#3D5A80]">{row.fl}</td>
                    <td className="py-5 px-5 text-[#3D5A80]">{row.ew}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-center text-[#3D5A80] mt-6 max-w-xl mx-auto">
            Running both is common: financial literacy across the primary years, the workshop as a flagship for a senior grade.
          </p>
        </div>
      </section>

      {/* Get started CTA */}
      <section className="bg-[#E0FBFC] py-20 md:py-28" data-testid="for-schools-final-cta">
        <div className="container mx-auto px-6 text-center max-w-3xl">
          <h2 className="text-4xl md:text-5xl font-bold text-[#1D3557] mb-5" style={{ fontFamily: 'Fredoka' }}>
            Get Started Now
          </h2>
          <p className="text-lg text-[#3D5A80] mb-10 max-w-xl mx-auto">
            Tell us about your school and we&apos;ll take it from there — no commitment required to have the conversation.
          </p>
          <button
            data-testid="for-schools-final-cta-btn"
            onClick={() => setShowEnquiry(true)}
            className="bg-[#FFD23F] text-[#1D3557] font-bold px-10 py-5 text-xl rounded-full border-[3px] border-[#1D3557] shadow-[6px_6px_0px_0px_#1D3557] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_#1D3557] transition-all inline-flex items-center gap-2"
          >
            <Sparkles className="w-6 h-6" /> Enquire Now
          </button>
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
              <a href="mailto:hello@coinquest.co.in" className="text-[#98C1D9] hover:text-white transition-colors">hello@coinquest.co.in</a>
              <a href="tel:+919924117051" className="text-[#98C1D9] hover:text-white transition-colors">+91 9924117051</a>
            </div>
            <div className="flex flex-col items-center md:items-end gap-3">
              <p className="text-[#98C1D9] text-sm text-center md:text-right mt-2">
                © Learners' Planet<br/>
                Educating kids in fun and interactive ways!
              </p>
            </div>
          </div>
        </div>
      </footer>

      <SchoolEnquiryDialog open={showEnquiry} onOpenChange={setShowEnquiry} />
    </div>
  );
}
