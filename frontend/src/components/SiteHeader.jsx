import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
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
  const [menuOpen, setMenuOpen] = useState(false);

  const isSchoolsPage = location.pathname === '/for-schools';
  const isWorkshopPage = location.pathname === '/entrepreneurship-workshop';

  const scrollToSection = (sectionId) => {
    setMenuOpen(false);
    if (location.pathname !== '/') {
      navigate('/');
      setTimeout(() => smoothScrollToElement(sectionId), 450);
    } else {
      smoothScrollToElement(sectionId);
    }
  };

  const go = (path) => {
    setMenuOpen(false);
    navigate(path);
  };

  return (
    <div className="sticky top-0 z-50 bg-[#FDF6E3] border-b-2 border-[#1D3557]/10 shadow-[0_2px_10px_rgba(29,53,87,0.08)]" data-testid="site-header">
      <div className="container mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <img
          src="/coinquest-logo.png"
          alt="CoinQuest by Learners' Planet"
          data-testid="site-header-logo"
          onClick={() => go('/')}
          className="h-10 sm:h-11 w-auto cursor-pointer flex-shrink-0"
        />

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {SECTION_LINKS.map((link) => (
            <button
              key={link.sectionId}
              data-testid={`site-header-nav-${link.testId}`}
              onClick={() => scrollToSection(link.sectionId)}
              className="font-bold text-lg text-[#1D3557] hover:text-[#5B21B6] transition-colors"
            >
              {link.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {isSchoolsPage ? (
            <button
              data-testid="site-header-cta-btn"
              onClick={() => setShowSchoolEnquiry(true)}
              className="btn-primary px-5 sm:px-6 py-2.5 text-sm sm:text-base"
            >
              Enquire Now
            </button>
          ) : (
            <>
              {isWorkshopPage && (
                <button
                  data-testid="site-header-cta-btn"
                  onClick={() => go('/entrepreneurship-workshop?trial=1')}
                  className="hidden md:inline-block font-bold text-base text-[#5B21B6] hover:text-[#1D3557] px-3 py-2 transition-colors"
                >
                  Book a Free Trial
                </button>
              )}
              <button
                data-testid="site-header-login-btn"
                onClick={() => go('/login')}
                className="px-4 sm:px-5 py-2 sm:py-2.5 text-sm sm:text-base font-bold text-[#1D3557] bg-white border-2 border-[#1D3557] rounded-full hover:bg-[#E0FBFC] transition-colors"
              >
                Login
              </button>
              <button
                data-testid="site-header-register-btn"
                onClick={() => go('/register')}
                className="btn-primary px-6 py-2.5 text-base hidden md:inline-block"
              >
                Register
              </button>
            </>
          )}

          {/* Mobile hamburger */}
          <button
            data-testid="site-header-menu-toggle"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden w-10 h-10 flex items-center justify-center rounded-xl border-2 border-[#1D3557] text-[#1D3557] bg-white"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu panel */}
      {menuOpen && (
        <div className="md:hidden border-t-2 border-[#1D3557]/10 bg-[#FDF6E3] px-4 pb-4 pt-2" data-testid="site-header-mobile-menu">
          <div className="flex flex-col">
            {SECTION_LINKS.map((link) => (
              <button
                key={link.sectionId}
                data-testid={`site-header-mobile-nav-${link.testId}`}
                onClick={() => scrollToSection(link.sectionId)}
                className="text-left font-bold text-base text-[#1D3557] py-3 border-b border-[#1D3557]/10"
              >
                {link.label}
              </button>
            ))}
            {isWorkshopPage && (
              <button
                data-testid="site-header-mobile-trial-btn"
                onClick={() => go('/entrepreneurship-workshop?trial=1')}
                className="text-left font-bold text-base text-[#5B21B6] py-3 border-b border-[#1D3557]/10"
              >
                Book a Free Trial
              </button>
            )}
            {isSchoolsPage ? (
              <button
                data-testid="site-header-mobile-enquiry-btn"
                onClick={() => { setMenuOpen(false); setShowSchoolEnquiry(true); }}
                className="btn-primary mt-4 w-full py-3 text-base"
              >
                Enquire Now
              </button>
            ) : (
              <button
                data-testid="site-header-mobile-register-btn"
                onClick={() => go('/register')}
                className="btn-primary mt-4 w-full py-3 text-base"
              >
                Register
              </button>
            )}
          </div>
        </div>
      )}

      <SchoolEnquiryDialog open={showSchoolEnquiry} onOpenChange={setShowSchoolEnquiry} />
    </div>
  );
}
