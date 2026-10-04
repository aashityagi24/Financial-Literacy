import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { SchoolEnquiryDialog } from '@/components/SchoolEnquiryDialog';
import { smoothScrollToElement } from '@/utils/smoothScroll';

const SECTION_LINKS = [
  { label: 'How It Works', sectionId: 'how-it-works', testId: 'how-it-works' },
  { label: 'Pricing', sectionId: 'pricing', testId: 'pricing' },
];

export function SiteHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showSchoolEnquiry, setShowSchoolEnquiry] = useState(false);

  const isSchoolsPage = location.pathname === '/for-schools';
  const isWorkshopPage = location.pathname === '/entrepreneurship-workshop';

  const scrollToSection = (sectionId) => {
    if (location.pathname !== '/') {
      navigate('/');
      setTimeout(() => smoothScrollToElement(sectionId), 450);
    } else {
      smoothScrollToElement(sectionId);
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
        <div className="flex items-center gap-2 sm:gap-3 order-2 sm:order-3">
          {isSchoolsPage ? (
            <button
              data-testid="site-header-cta-btn"
              onClick={() => setShowSchoolEnquiry(true)}
              className="btn-primary px-6 py-2.5 text-base"
            >
              Enquire Now
            </button>
          ) : (
            <>
              {isWorkshopPage && (
                <button
                  data-testid="site-header-cta-btn"
                  onClick={() => navigate('/entrepreneurship-workshop?trial=1')}
                  className="hidden sm:inline-block font-bold text-base text-[#5B21B6] hover:text-[#1D3557] px-3 py-2 transition-colors"
                >
                  Book a Free Trial
                </button>
              )}
              <button
                data-testid="site-header-login-btn"
                onClick={() => navigate('/login')}
                className="px-5 py-2.5 text-base font-bold text-[#1D3557] bg-white border-2 border-[#1D3557] rounded-full hover:bg-[#E0FBFC] transition-colors"
              >
                Login
              </button>
              <button
                data-testid="site-header-register-btn"
                onClick={() => navigate('/register')}
                className="btn-primary px-6 py-2.5 text-base"
              >
                Register
              </button>
            </>
          )}
        </div>
      </div>
      <SchoolEnquiryDialog open={showSchoolEnquiry} onOpenChange={setShowSchoolEnquiry} />
    </div>
  );
}
