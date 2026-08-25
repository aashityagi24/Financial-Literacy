import { useState } from 'react';
import {
  UserCheck, BookOpen, CalendarDays, Target, Printer,
  Mic, Briefcase, Tag, Tent, ArrowRight, Sparkles,
} from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';
import { SchoolEnquiryDialog } from '@/components/SchoolEnquiryDialog';

const FL_CARDS = [
  { icon: UserCheck, label: 'Who delivers it', desc: 'Your teachers. We equip them fully, so there is no dependency on external facilitators for every session.' },
  { icon: BookOpen, label: 'What we provide', desc: 'Complete curriculum, lesson plans, activities and assessment materials — ready to teach, no prep required from your staff.' },
  { icon: CalendarDays, label: 'How it fits your schedule', desc: 'A dedicated period, an after-school club or a term-long elective — the structure adapts to however you run co-curricular time.' },
  { icon: Target, label: 'What students walk away with', desc: 'Practical money skills — saving, budgeting and spending decisions — built through activities, not lectures.' },
  { icon: Printer, label: 'Everything print-ready', desc: 'Worksheets, activity sheets and assignments print straight from the lesson, or go out digitally to the class.' },
];

const EW_CARDS = [
  { icon: Mic, label: 'Who delivers it', desc: 'Our facilitators run every session. Your teachers can be as involved or as hands-off as you would like.' },
  { icon: Briefcase, label: 'What we provide', desc: 'Structured weekly sessions, all materials and a facilitator-led format — fully managed from our end.' },
  { icon: CalendarDays, label: 'How it fits your schedule', desc: 'A weekly workshop slot — activity period, elective hour or after-school program.' },
  { icon: Tag, label: 'What students walk away with', desc: 'A real product, priced and pitched, with an actual sale made — a tangible outcome by the end of the program.' },
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

function ProgramCard({ icon: Icon, label, desc }) {
  return (
    <div className="bg-white rounded-2xl border-2 border-[#1D3557] p-5" data-testid={`program-card-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="w-11 h-11 rounded-xl border-2 border-[#1D3557] bg-[#E0FBFC] flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-[#1D3557]" />
      </div>
      <p className="text-xs font-bold uppercase tracking-wide text-[#3D5A80] mb-1.5">{label}</p>
      <p className="text-[#1D3557] text-sm leading-relaxed">{desc}</p>
    </div>
  );
}

function ProgramSection({
  testId, sectionBg, programLabel, badgeBg, badgeTextColor, title, titleColor,
  subtitle, ctaLabel, ctaBg, ctaTextColor, onCtaClick, cards,
}) {
  return (
    <section className={sectionBg} data-testid={testId}>
      <div className="container mx-auto px-6 py-14">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6 mb-8">
          <div
            className="rounded-2xl border-3 border-[#1D3557] shadow-[4px_4px_0px_0px_#1D3557] px-6 py-4 flex-shrink-0"
            style={{ backgroundColor: badgeBg }}
          >
            <span
              className="inline-block text-xs font-bold tracking-wide px-2 py-0.5 rounded-md mb-1"
              style={{ backgroundColor: titleColor === 'white' ? 'rgba(255,255,255,0.2)' : 'rgba(29,53,87,0.1)', color: badgeTextColor }}
            >
              {programLabel}
            </span>
            <h3 className="text-2xl lg:text-3xl font-bold" style={{ fontFamily: 'Fredoka', color: titleColor }}>
              {title}
            </h3>
          </div>
          <p className="text-[#3D5A80] leading-relaxed flex-1">{subtitle}</p>
          <button
            data-testid={`${testId}-cta-btn`}
            onClick={onCtaClick}
            className="flex items-center gap-2 font-bold px-6 py-3 rounded-full border-3 border-[#1D3557] shadow-[4px_4px_0px_0px_#1D3557] hover:-translate-y-1 transition-all whitespace-nowrap flex-shrink-0"
            style={{ backgroundColor: ctaBg, color: ctaTextColor }}
          >
            {ctaLabel} <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {cards.map((c) => <ProgramCard key={c.label} {...c} />)}
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
              <h1 className="text-4xl lg:text-5xl font-bold text-[#1D3557] mb-6 leading-tight" style={{ fontFamily: 'Fredoka' }}>
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
        programLabel="PROGRAM ONE"
        badgeBg="#FFD23F"
        badgeTextColor="#1D3557"
        title="Financial Literacy"
        titleColor="#1D3557"
        subtitle="School-led · 36 hours · Flexible scheduling. Your teachers deliver it — we equip them fully, so no session depends on an external facilitator."
        ctaLabel="Get Teacher Access"
        ctaBg="#1D3557"
        ctaTextColor="#FFFFFF"
        onCtaClick={() => setShowEnquiry(true)}
        cards={FL_CARDS}
      />

      {/* Program 2: Entrepreneurship Workshop */}
      <ProgramSection
        testId="program-entrepreneurship-workshop"
        sectionBg="bg-[#FDF6E3]"
        programLabel="PROGRAM TWO"
        badgeBg="#5B21B6"
        badgeTextColor="#FFFFFF"
        title="Entrepreneurship Workshop"
        titleColor="white"
        subtitle="CoinQuest-facilitated · 30 hours · Weekly sessions. Fully managed from our end, ending in a culmination showcase on your campus."
        ctaLabel="Request a Pilot"
        ctaBg="#5B21B6"
        ctaTextColor="#FFFFFF"
        onCtaClick={() => setShowEnquiry(true)}
        cards={EW_CARDS}
      />

      {/* Comparison table */}
      <section className="bg-white py-16" data-testid="program-comparison-section">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl lg:text-4xl font-bold text-[#1D3557] text-center mb-10" style={{ fontFamily: 'Fredoka' }}>
            Which one fits your school?
          </h2>
          <div className="max-w-4xl mx-auto rounded-2xl border-3 border-[#1D3557] overflow-hidden shadow-[4px_4px_0px_0px_rgba(29,53,87,0.15)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1D3557] text-white">
                  <th className="text-left py-4 px-5 font-bold" style={{ fontFamily: 'Fredoka' }}></th>
                  <th className="text-left py-4 px-5 font-bold" style={{ fontFamily: 'Fredoka' }}>Financial Literacy</th>
                  <th className="text-left py-4 px-5 font-bold" style={{ fontFamily: 'Fredoka' }}>Entrepreneurship Workshop</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, idx) => (
                  <tr key={row.label} className={idx % 2 === 0 ? 'bg-[#FDF6E3]' : 'bg-white'}>
                    <td className="py-4 px-5 font-bold text-[#1D3557] whitespace-nowrap">{row.label}</td>
                    <td className="py-4 px-5 text-[#3D5A80]">{row.fl}</td>
                    <td className="py-4 px-5 text-[#3D5A80]">{row.ew}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-center text-[#3D5A80] text-sm mt-6 max-w-xl mx-auto">
            Running both is common: financial literacy across the primary years, the workshop as a flagship for a senior grade.
          </p>
        </div>
      </section>

      {/* Get started CTA */}
      <section className="bg-[#E0FBFC] py-16" data-testid="for-schools-final-cta">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-[#1D3557] mb-4" style={{ fontFamily: 'Fredoka' }}>
            Get Started Now
          </h2>
          <p className="text-[#3D5A80] mb-8 max-w-xl mx-auto">
            Tell us about your school and we&apos;ll take it from there — no commitment required to have the conversation.
          </p>
          <button
            data-testid="for-schools-final-cta-btn"
            onClick={() => setShowEnquiry(true)}
            className="bg-[#EE6C4D] text-white font-bold px-8 py-4 text-lg rounded-full border-3 border-[#1D3557] shadow-[4px_4px_0px_0px_#1D3557] hover:-translate-y-1 transition-all inline-flex items-center gap-2"
          >
            <Sparkles className="w-5 h-5" /> Enquire Now
          </button>
        </div>
      </section>

      <SchoolEnquiryDialog open={showEnquiry} onOpenChange={setShowEnquiry} />
    </div>
  );
}
