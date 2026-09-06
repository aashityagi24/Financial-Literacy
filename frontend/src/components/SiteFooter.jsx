import { useNavigate } from 'react-router-dom';

const QUICK_LINKS = [
  { label: 'Financial Literacy Platform', path: '/', testId: 'platform' },
  { label: 'Entrepreneurship Workshop', path: '/entrepreneurship-workshop', testId: 'workshop' },
  { label: 'For Schools', path: '/for-schools', testId: 'for-schools' },
];

export function SiteFooter() {
  const navigate = useNavigate();

  return (
    <footer className="bg-[#1D3557] py-8" data-testid="site-footer">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-start">
          <div className="flex flex-col items-center md:items-start">
            <img
              src="https://customer-assets.emergentagent.com/job_6e7204b4-e7e4-42b3-b74e-111b68302b75/artifacts/ul81dgc9_Friendly%20%27Money%20Matter%27%20Logo%20Design%20%281%29.png"
              alt="CoinQuest Logo"
              className="h-36 w-auto"
            />
          </div>

          <div className="flex flex-col items-center md:items-start gap-3">
            <h3 className="text-white font-bold text-lg" style={{ fontFamily: 'Fredoka' }}>Quick Links</h3>
            {QUICK_LINKS.map((link) => (
              <button
                key={link.path}
                data-testid={`site-footer-link-${link.testId}`}
                onClick={() => navigate(link.path)}
                className="text-[#98C1D9] hover:text-white transition-colors text-left"
              >
                {link.label}
              </button>
            ))}
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
              data-testid="site-footer-learners-planet-link"
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
  );
}
