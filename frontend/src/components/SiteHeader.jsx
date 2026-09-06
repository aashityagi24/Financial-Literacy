import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { SchoolEnquiryDialog } from '@/components/SchoolEnquiryDialog';

const SECTION_LINKS = [
  { label: 'Pricing', sectionId: 'pricing', testId: 'pricing' },
  { label: 'How It Works', sectionId: 'how-it-works', testId: 'how-it-works' },
];

const CTA_BY_PATH = {
  '/entrepreneurship-workshop': { label: 'Book a Free Trial' },
  '/': { label: 'Sign Up' },
  '/for-schools': { label: 'Enquire Now' },
};

export function SiteHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showSchoolEnquiry, setShowSchoolEnquiry] = useState(false);

  const cta = CTA_BY_PATH[location.pathname] || { label: 'Sign In' };

  const handleCtaClick = () => {
    if (location.pathname === '/entrepreneurship-workshop') {
      navigate('/entrepreneurship-workshop?trial=1');
    } else if (location.pathname === '/') {
      navigate('/signup');
    } else if (location.pathname === '/for-schools') {
      setShowSchoolEnquiry(true);
    } else {
      navigate('/login');
    }
  };

  const scrollToSection = (sectionId) => {
    if (location.pathname !== '/') {
      navigate('/');
      setTimeout(() => document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' }), 400);
    } else {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="sticky top-0 z-50 bg-[#FDF6E3] border-b-2 border-[#1D3557]/10 shadow-[0_2px_10px_rgba(29,53,87,0.08)]" data-testid="site-header">
      <div className="container mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <img
          src="/coinquest-logo.png"
          alt="CoinQuest by Learners' Planet"
          data-testid="site-header-logo"
          onClick={() => navigate('/')}
          className="h-11 w-auto cursor-pointer order-1"
        />
        <nav className="flex items-center gap-5 sm:gap-8 order-3 sm:order-2 w-full sm:w-auto justify-center sm:justify-start">
          {SECTION_LINKS.map((link) => (
            <button
              key={link.sectionId}
              data-testid={`site-header-nav-${link.testId}`}
              onClick={() => scrollToSection(link.sectionId)}
              className="font-bold text-base sm:text-lg text-[#1D3557] hover:text-[#5B21B6] transition-colors"
            >
              {link.label}
            </button>
          ))}
        </nav>
        <button
          data-testid="site-header-cta-btn"
          onClick={handleCtaClick}
          className="btn-primary px-6 py-2.5 text-base order-2 sm:order-3"
        >
          {cta.label}
        </button>
      </div>
      <SchoolEnquiryDialog open={showSchoolEnquiry} onOpenChange={setShowSchoolEnquiry} />
    </div>
  );
}

