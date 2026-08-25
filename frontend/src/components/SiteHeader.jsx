import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { SchoolEnquiryDialog } from '@/components/SchoolEnquiryDialog';

const NAV_LINKS = [
  { label: 'Workshop', path: '/entrepreneurship-workshop', testId: 'workshop' },
  { label: 'Platform', path: '/financial-literacy', testId: 'platform' },
  { label: 'For Schools', path: '/school-login', testId: 'for-schools' },
];

const CTA_BY_PATH = {
  '/entrepreneurship-workshop': { label: 'Book a Free Trial' },
  '/financial-literacy': { label: 'Sign Up' },
  '/school-login': { label: 'Enquire Now' },
};

export function SiteHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showSchoolEnquiry, setShowSchoolEnquiry] = useState(false);

  const cta = CTA_BY_PATH[location.pathname] || { label: 'Sign In' };

  const handleCtaClick = () => {
    if (location.pathname === '/entrepreneurship-workshop') {
      navigate('/entrepreneurship-workshop?trial=1');
    } else if (location.pathname === '/financial-literacy') {
      navigate('/signup');
    } else if (location.pathname === '/school-login') {
      setShowSchoolEnquiry(true);
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="bg-[#FDF6E3] border-b-2 border-[#1D3557]/10" data-testid="site-header">
      <div className="container mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <img
          src="/coinquest-logo.png"
          alt="CoinQuest by Learners' Planet"
          data-testid="site-header-logo"
          onClick={() => navigate('/')}
          className="h-11 w-auto cursor-pointer order-1"
        />
        <nav className="flex items-center gap-5 sm:gap-8 order-3 sm:order-2 w-full sm:w-auto justify-center sm:justify-start">
          {NAV_LINKS.map((link) => (
            <button
              key={link.path}
              data-testid={`site-header-nav-${link.testId}`}
              onClick={() => navigate(link.path)}
              className={`font-bold text-base sm:text-lg transition-colors ${
                location.pathname === link.path
                  ? 'text-[#EE6C4D]'
                  : 'text-[#1D3557] hover:text-[#5B21B6]'
              }`}
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

